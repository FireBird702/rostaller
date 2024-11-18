import path from "path"
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "fs"
import { red, yellow, green, cyan } from "../output/colors"
import { validateJson, validateToml } from "../validator/validator"
import { getAsync } from "../httpGet"
import { config, defaultProjectJsonName, downloadStats, manifestFileNames, defaultFolderNames } from "../configs/mainConfig"
import { debugLog } from "../output/output"
import { renameFile } from "../renameFile"
import { getPackageFolderPath } from "../packageFolderPath"
import { clean, rcompare, maxSatisfying } from "semver"
import { rimraf } from "rimraf"
import AdmZip from "adm-zip"

const UTF8 = new TextDecoder("utf-8")

var metadataCache = {}

/**
 * @param {string} scope - The owning author or organization of the package
 * @param {string} name - The search query as a series of characters
 */
async function getPackageVersions(scope, name) {
	const metadata = await getMetadata(scope, name)

	let versions = []

	for (const versionData of metadata) {
		const cleanVersion = clean(versionData.tag_name, { loose: true })

		if (!cleanVersion) {
			continue
		}

		versions.push(cleanVersion)
	}

	versions.sort((v1, v2) => rcompare(v1, v2))
	return versions
}

/**
 * Returns package version that matches the requirement
 * @param {*} rawDependencyLink
 * @returns
 */
async function resolveRequirement(rawDependencyLink) {
	const dependencyLinkData = rawDependencyLink.split("@")
	const ScopeAndName = dependencyLinkData[0].split("/")
	const availableVersions = await getPackageVersions(ScopeAndName[0], ScopeAndName[1])

	debugLog(`Checking versions from ${dependencyLinkData[0]}`)
	debugLog(availableVersions)

	const PATTERN = /[<>=^~]/
	var range = dependencyLinkData[1]

	if (!range.match(PATTERN)) {
		range = `^${range}`
	}

	const validVersion = maxSatisfying(availableVersions, range, { loose: true })

	if (!validVersion) {
		debugLog(`Could not satisfy requirement - ${range}`)
		return null
	}

	return validVersion
}

/**
 * @param {string} scope - The owning author or organization of the package
 * @param {string} name - The search query as a series of characters
 */
async function getMetadata(scope, name) {
	if (metadataCache[`${scope}/${name}`])
		return metadataCache[`${scope}/${name}`]

	const response = await getAsync(`https://api.github.com/repos/${scope}/${name}/releases`, {
		Accept: "application/vnd.github+json",
		Authorization: config.auth.githubAccessToken != "" && "Bearer " + config.auth.githubAccessToken,
		["X-GitHub-Api-Version"]: "2022-11-28"
	}, "json")

	if (!response || (response.status && response.status == "404"))
		throw "Failed to get list of releases"

	if (response.status && (response.status == "403" || response.status == "429"))
		throw "API rate limit exceeded. Create a github personal access token to get a higher rate limit."

	metadataCache[`${scope}/${name}`] = response
	return metadataCache[`${scope}/${name}`]
}

/**
 * @param {string} scope - The owning author or organization of the package
 * @param {string} name - The search query as a series of characters
 * @param {string} version
 */
async function getVersionMetadata(scope, name, version) {
	const allVersionsMetaData = await getMetadata(scope, name)

	for (const versionData of allVersionsMetaData) {
		if (versionData.tag_name.match(version))
			return versionData
	}

	return null
}

/**
 * @param {string} alias
 * @param {string} dependencyLink
 * @param {any} tree
 * @param {any?} parentDependencies
 * @param {boolean?} realmOverwrite
 */
export async function githubDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite) {
	try {
		var packageVersion = "latest"
		var tag = packageVersion

		const packageLink = dependencyLink.split("@")
		const owner_repo = packageLink[0].split("/")
		const owner = owner_repo[0]
		const repo = owner_repo[1]

		if (packageLink[1]) {
			const version = await resolveRequirement(dependencyLink)
			const versionMetadata = await getVersionMetadata(owner, repo, version)
			packageVersion = (versionMetadata && clean(versionMetadata.tag_name, { loose: true })) || "latest"
			tag = (versionMetadata && versionMetadata.tag_name) || "latest"
		}

		var formatedDependencyLink = `${packageLink[0]}@${packageVersion}`
		var assetPath = `${getPackageFolderPath(realmOverwrite || "shared")}/${defaultFolderNames.indexFolder}/${owner.toLowerCase()}_${repo.toLowerCase()}`
		var assetFolder = assetPath + `@${packageVersion}`

		if (parentDependencies && !parentDependencies[formatedDependencyLink])
			parentDependencies[formatedDependencyLink] = { alias: alias }

		if (!existsSync(assetFolder) || packageVersion == "latest") {
			// get release info

			debugLog(`Getting version from ${green(dependencyLink)} ...`)

			const release = await getAsync(`https://api.github.com/repos/${owner}/${repo}/releases/${tag == "latest" && tag || `tags/${tag}`}`, {
				Accept: "application/vnd.github+json",
				Authorization: config.auth.githubAccessToken != "" && "Bearer " + config.auth.githubAccessToken,
				["X-GitHub-Api-Version"]: "2022-11-28"
			}, "json")

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(formatedDependencyLink)} already exists`)
				return
			}

			if (release.status && (release.status == "403" || release.status == "429"))
				throw "API rate limit exceeded. Create a github personal access token to get a higher rate limit."

			if (!release || !("id" in release))
				throw "Failed to get release info"

			if (packageVersion == "latest") {
				packageVersion = clean(release.tag_name, { loose: true }) || packageVersion
				assetFolder = assetPath + `@${packageVersion}`
				formatedDependencyLink = `${packageLink[0]}@${packageVersion}`
			}

			// download release repo

			debugLog(`Downloading ${green(formatedDependencyLink)} ...`)

			const asset = await getAsync(release.zipball_url, {
				Accept: "application/vnd.github+json",
				Authorization: config.auth.githubAccessToken != "" && "Bearer " + config.auth.githubAccessToken,
				["X-GitHub-Api-Version"]: "2022-11-28"
			})

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(formatedDependencyLink)} already exists`)
				return
			}

			if (UTF8.decode(asset.subarray(0, 2)) != "PK")
				throw "Failed to download release files"

			const assetZip = assetFolder + ".zip"
			const assetUnzip = assetFolder + "-unzipped"

			mkdirSync(assetUnzip, { recursive: true })
			writeFileSync(assetZip, asset)

			var zip = new AdmZip(assetZip)
			zip.extractAllTo(path.resolve(assetUnzip), true)

			let assetFile = assetFolder + `/${repo.toLowerCase()}`

			mkdirSync(assetFolder, { recursive: true })

			const dirContent = readdirSync(assetUnzip)

			for (const i in dirContent) {
				await renameFile(path.resolve(assetUnzip, dirContent[i]), assetFile)
			}

			await rimraf(assetZip)
			await rimraf(assetUnzip)

			if (!tree[formatedDependencyLink])
				tree[formatedDependencyLink] = { dependencies: {} }

			if (!tree[formatedDependencyLink].alias)
				tree[formatedDependencyLink].alias = !parentDependencies && alias || undefined

			tree[formatedDependencyLink].package = {
				owner: owner,
				name: repo,
				version: packageVersion,
				realm: realmOverwrite,
				realmOverwrite: realmOverwrite,
				type: "github",
			}

			// check package data and sub packages
			const content = readdirSync(assetFile)

			let projectFile

			for (const key in content) {
				if (content[key] == defaultProjectJsonName) {
					const projectPath = assetFile + `/${defaultProjectJsonName}`
					projectFile = validateJson("Project", projectPath, readFileSync(projectPath))
				}

				if (!realmOverwrite) {
					if (content[key] == manifestFileNames.rostallerManifest) {
						const packagePath = assetFile + `/${manifestFileNames.rostallerManifest}`

						let packageFile = validateToml("SubPackage", packagePath, readFileSync(packagePath).toString())
						tree[formatedDependencyLink].package.realm = packageFile.package.realm
					}

					if (content[key] == manifestFileNames.wallyManifest) {
						const packagePath = assetFile + `/${manifestFileNames.wallyManifest}`

						let packageFile = validateToml("SubPackage", packagePath, readFileSync(packagePath).toString())
						tree[formatedDependencyLink].package.realm = packageFile.package.realm
					}
				}
			}

			if (!tree[formatedDependencyLink].package.realm) {
				debugLog(`${cyan(assetFile)} is missing "${manifestFileNames.rostallerManifest}" file. Realm set to ${green("shared")}`)
				tree[formatedDependencyLink].package.realm = "shared"
			}

			if (!projectFile) {
				throw `[${manifestFileNames.rostallerManifest}] is invalid`
			}

			// rename project name
			const projectPath = assetFile + `/${defaultProjectJsonName}`

			if (projectFile.name != repo.toLowerCase()) {
				debugLog("Renaming", cyan(projectPath))

				projectFile.name = repo.toLowerCase()
				writeFileSync(projectPath, JSON.stringify(projectFile, null, "\t"))
			}

			// update realm
			if (!realmOverwrite && tree[formatedDependencyLink].package.realm != "shared") {
				assetPath = `${getPackageFolderPath(tree[formatedDependencyLink].package.realm)}/${defaultFolderNames.indexFolder}`

				if (!existsSync(assetPath))
					mkdirSync(assetPath, { recursive: true })

				const newPath = assetPath + `/${owner.toLowerCase()}_${repo.toLowerCase()}@${packageVersion}`

				await renameFile(assetFolder, newPath)

				assetFolder = newPath
				assetFile = assetFolder + `/${repo.toLowerCase()}`
			}

			downloadStats.success += 1
			console.log(`Downloaded ${green(formatedDependencyLink)} from github`)

			// check dependencies
			var manifestFile

			for (const key in content) {
				if (content[key] == manifestFileNames.rostallerManifest)
					manifestFile = `${assetFile}/${manifestFileNames.rostallerManifest}`
				else if (content[key] == manifestFileNames.wallyManifest)
					manifestFile = `${assetFile}/${manifestFileNames.wallyManifest}`

				if (manifestFile)
					break
			}

			return {
				packageLink: formatedDependencyLink,
				manifestFile: manifestFile,
			}
		} else {
			debugLog(`Package ${green(formatedDependencyLink)} already exists`)
		}
	} catch (err) {
		downloadStats.fail += 1
		console.error(red("Failed to download github package"), green(dependencyLink) + red(":"), yellow(err))
	}
}

/**
 * @param {string} alias
 * @param {string} dependencyLink
 * @param {any} tree
 * @param {any?} parentDependencies
 * @param {boolean?} realmOverwrite
 */
export async function githubDeepDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite) {
	try {
		const result = await githubDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite)

		if (!result)
			return
		if (!result.manifestFile)
			return

		const downloadManifestDependencies = (await import("../manifest")).downloadManifestDependencies
		await downloadManifestDependencies(result.manifestFile, tree, tree[result.packageLink].dependencies)
	} catch (err) {
		console.error(red("Failed to check github package dependencies"), green(dependencyLink) + red(":"), yellow(err))
	}
}

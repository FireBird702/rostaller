import path from "path"
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "fs"
import { red, yellow, green, cyan } from "../output/colors"
import { validateJson } from "../validator/validator"
import { getAsync } from "../httpGet"
import { config, defaultProjectJsonName, downloadStats, manifestFileNames, defaultFolderNames } from "../configs/mainConfig"
import { debugLog } from "../output/output"
import { getPackageFolderPath } from "../packageFolderPath"
import { clean, rcompare, maxSatisfying } from "semver"
import { rimraf } from "rimraf"
import AdmZip from "adm-zip"

var metadataCache = {}

/**
 * @param {string} scope - The owning author or organization of the package
 * @param {string} name - The search query as a series of characters
 */
async function getPackageVersions(scope, name) {
	const metadata = await getMetadata(scope, name)

	let versions = []

	for (const versionData of metadata) {
		versions.push(clean(versionData.package.version, { loose: true }))
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

	const response = await getAsync(`https://api.wally.run/v1/package-metadata/${scope}/${name}`, {
		Authorization: config.auth.wallyAccessToken != "" && "Bearer " + config.auth.wallyAccessToken,
		["Wally-Version"]: "0.3.2"
	}, "json")

	if (!response || !response.versions)
		throw "Failed to get package metadata"

	metadataCache[`${scope}/${name}`] = response.versions
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
		if (versionData.package.version == version)
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
export async function wallyDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite) {
	try {
		const packageVersion = await resolveRequirement(dependencyLink)

		const packageLink = dependencyLink.split("@")
		const owner_repo = packageLink[0].split("/")
		const owner = owner_repo[0]
		const repo = owner_repo[1]

		const formatedDependencyLink = `${packageLink[0]}@${packageVersion}`
		const versionMetadata = await getVersionMetadata(owner, repo, packageVersion)

		const realm = realmOverwrite || versionMetadata.package.realm

		const assetPath = `${getPackageFolderPath(realm)}/${defaultFolderNames.indexFolder}/${owner.toLowerCase()}_${repo.toLowerCase()}`

		if (!tree[formatedDependencyLink])
			tree[formatedDependencyLink] = { dependencies: {} }

		if (!tree[formatedDependencyLink].alias)
			tree[formatedDependencyLink].alias = !parentDependencies && alias || undefined

		tree[formatedDependencyLink].package = {
			owner: owner,
			name: repo,
			version: packageVersion,
			realm: realm,
			realmOverwrite: realmOverwrite,
			type: "wally",
		}

		if (parentDependencies && !parentDependencies[formatedDependencyLink])
			parentDependencies[formatedDependencyLink] = { alias: alias }

		let assetFolder = assetPath + `@${packageVersion}`

		if (!existsSync(assetFolder)) {
			// download release repo

			debugLog(`Downloading ${green(formatedDependencyLink)} ...`)

			const asset = await getAsync(`https://api.wally.run/v1/package-contents/${owner}/${repo}/${packageVersion}`, {
				Authorization: config.auth.wallyAccessToken != "" && "Bearer " + config.auth.wallyAccessToken,
				["Wally-Version"]: "0.3.2",
			}, "wally")

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(formatedDependencyLink)} already exists`)
				return
			}

			if (asset.toString().substring(0, 2) != "PK")
				throw "Failed to download release files"

			const assetZip = assetFolder + ".zip"

			mkdirSync(assetFolder, { recursive: true })

			writeFileSync(assetZip, asset)

			let assetFile = assetFolder + `/${repo.toLowerCase()}`

			var zip = new AdmZip(assetZip)
			zip.extractAllTo(path.resolve(assetFile), true)

			await rimraf(assetZip)

			// check package data
			const content = readdirSync(assetFile)

			for (const key in content) {
				if (content[key] == defaultProjectJsonName) { // change default.project.json name to match package folder name
					const projectPath = assetFile + `/${defaultProjectJsonName}`
					const defaultProjectFile = validateJson("Project", projectPath, readFileSync(projectPath))

					if (defaultProjectFile.name != repo.toLowerCase()) {
						debugLog("Renaming", cyan(projectPath))

						defaultProjectFile.name = repo.toLowerCase()
						writeFileSync(projectPath, JSON.stringify(defaultProjectFile, null, "\t"))
					}
				}
			}

			downloadStats.success += 1
			console.log(`Downloaded ${green(formatedDependencyLink)} from wally`)

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
		console.error(red("Failed to download wally package"), green(dependencyLink) + red(":"), yellow(err))
	}
}

/**
 * @param {string} alias
 * @param {string} dependencyLink
 * @param {any} tree
 * @param {any?} parentDependencies
 * @param {boolean?} realmOverwrite
 */
export async function wallyDeepDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite) {
	try {
		const result = await wallyDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite)

		if (!result)
			return
		if (!result.manifestFile)
			return

		const downloadManifestDependencies = (await import("../manifest")).downloadManifestDependencies
		await downloadManifestDependencies(result.manifestFile, tree, tree[result.packageLink].dependencies)
	} catch (err) {
		console.error(red("Failed to check wally package dependencies"), green(dependencyLink) + red(":"), yellow(err))
	}
}

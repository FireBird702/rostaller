import path from "path"
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "fs"
import { red, yellow, green, cyan } from "../output/colors.js"
import { validateJson, validateToml } from "../validator/validator.js"
import { getAsync } from "../httpGet.js"
import { defaultProjectJsonName, downloadStats, manifestFileNames, defaultFolderNames, auth, xGitHubApiVersion } from "../configs/mainConfig.js"
import { debugLog } from "../output/output.js"
import { renameFile } from "../renameFile.js"
import * as packageFolderPaths from "../packageFolderPaths.js"
import * as syncConfigGenerator from "../syncConfigGenerator.js"
import * as semver from "semver"
import { rimraf } from "rimraf"
import AdmZip from "adm-zip"

const UTF8 = new TextDecoder("utf-8")

/**
 * @typedef { object } dependency
 * @property { string } alias
 * @property { string } name
 * @property { string } version
 * @property { ("shared" | "server" | "dev")? } environmentOverwrite
 * @property { "github" } type
 */

/**
 * @typedef { object } package
 * @property { string } alias
 * @property { string } scope
 * @property { string } name
 * @property { string } version
 * @property { ("shared" | "server" | "dev")? } environmentOverwrite
 * @property { "github" } type
 */

/**
 * @param { dependency } dependency
 * @returns { package }
 */
function packageEntryFromDependency(dependency) {
	const scope_name = dependency.name.split("/")

	const packageEntry = {
		alias: dependency.alias,
		scope: scope_name[0],
		name: scope_name[1],
		version: dependency.version,
		environmentOverwrite: dependency.environmentOverwrite,
		type: dependency.type
	}

	return packageEntry
}

/**
 * @param { * } packageData
 * @param { { version: string?, ignoreType: boolean? }? } overwrites
 * @returns { string }
 */
function getFullPackageName(packageData, overwrites) {
	let packageString = ""

	if (!overwrites || !overwrites.ignoreType)
		packageString += `${packageData.type}#`

	packageString += `${packageData.scope}/${packageData.name}@${(overwrites && overwrites.version) || packageData.version}`
	return packageString
}

let metadataCache = {}

/**
 * @param { string } scope - The owning author or organization of the package
 * @param { string } name - The search query as a series of characters
 */
async function getMetadata(scope, name) {
	if (metadataCache[`${scope}/${name}`])
		return metadataCache[`${scope}/${name}`]

	const response = await getAsync(`https://api.github.com/repos/${scope}/${name}/releases`, {
		Accept: "application/vnd.github+json",
		Authorization: auth.github != "" && "Bearer " + auth.github,
		["X-GitHub-Api-Version"]: xGitHubApiVersion
	}, "json")

	if (!response || (response.status && response.status == "404"))
		throw "Failed to get list of releases"

	if (response.status && (response.status == "403" || response.status == "429"))
		throw "API rate limit exceeded. Create a github personal access token to get a higher rate limit."

	metadataCache[`${scope}/${name}`] = response
	return metadataCache[`${scope}/${name}`]
}

/**
 * @param { string } scope - The owning author or organization of the package
 * @param { string } name - The search query as a series of characters
 */
async function getPackageVersions(scope, name) {
	const metadata = await getMetadata(scope, name)

	let versions = []

	for (const versionData of metadata) {
		const cleanVersion = semver.clean(versionData.tag_name, { loose: true })

		if (!cleanVersion) {
			continue
		}

		versions.push(cleanVersion)
	}

	versions.sort((v1, v2) => semver.rcompare(v1, v2))
	return versions
}

/**
 * Returns package version that matches the requirement
 * @param { package } packageEntry
 * @returns
 */
async function resolveRequirement(packageEntry) {
	debugLog(`Checking versions for ${getFullPackageName(packageEntry)} ...`)

	const availableVersions = await getPackageVersions(packageEntry.scope, packageEntry.name)
	debugLog(availableVersions)

	const PATTERN = /[<>=^~]/
	let range = packageEntry.version

	if (!range.match(PATTERN)) {
		range = `^${range}`
	}

	const includePrerelease = semver.prerelease(packageEntry.version, { loose: true }) || false
	const validVersion = semver.maxSatisfying(availableVersions, range, { loose: true, includePrerelease: includePrerelease })

	if (!validVersion) {
		debugLog(`Could not satisfy requirement - ${range}`)
		return null
	}

	return validVersion
}

/**
 * @param { string } scope - The owning author or organization of the package
 * @param { string } name - The search query as a series of characters
 * @param { string } version
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
 * @param { string } packageString
 * @param { any } parentDependencies
 * @param { string } alias
 */
function addDependencyAlias(packageString, parentDependencies, alias) {
	if (parentDependencies && !parentDependencies[packageString])
		parentDependencies[packageString] = { alias: alias }
}

/**
 * @param { string } packageString
 * @param { any } tree
 * @param { any } parentDependencies
 * @param { string } alias
 */
function addAlias(packageString, tree, parentDependencies, alias) {
	if (parentDependencies)
		return

	if (!tree[packageString])
		tree[packageString] = { dependencies: {} }

	if (tree[packageString] && !tree[packageString].alias)
		tree[packageString].alias = alias || undefined
}

/**
 * @param { { package: dependency, tree: any, parentDependencies: any? } } args
 */
export async function download(args) {
	try {
		let packageVersion = "latest"
		let tag = packageVersion

		const packageEntry = packageEntryFromDependency(args.package)

		if (packageEntry.version) {
			const version = await resolveRequirement(packageEntry)
			const versionMetadata = await getVersionMetadata(packageEntry.scope, packageEntry.name, version)

			packageVersion = (versionMetadata && semver.clean(versionMetadata.tag_name, { loose: true })) || "latest"
			tag = (versionMetadata && versionMetadata.tag_name) || "latest"
		}

		let packageString = getFullPackageName(packageEntry, { version: packageVersion })
		let assetPath = `${packageFolderPaths.get(packageEntry.environmentOverwrite || "shared")}/${defaultFolderNames.indexFolder}/${packageEntry.scope.toLowerCase()}_${packageEntry.name.toLowerCase()}`
		let assetFolder = assetPath + `@${packageVersion}`

		if (packageVersion != "latest") {
			addDependencyAlias(packageString, args.parentDependencies, packageEntry.alias)
			addAlias(packageString, args.tree, args.parentDependencies, packageEntry.alias)
		}

		if (!existsSync(assetFolder) || packageVersion == "latest") {
			// get release info

			debugLog(`Getting version for ${green(packageString)} ...`)

			const release = await getAsync(`https://api.github.com/repos/${packageEntry.scope}/${packageEntry.name}/releases/${tag == "latest" && tag || `tags/${tag}`}`, {
				Accept: "application/vnd.github+json",
				Authorization: auth.github != "" && "Bearer " + auth.github,
				["X-GitHub-Api-Version"]: xGitHubApiVersion
			}, "json")

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(packageString)} already exists`)
				return
			}

			if (!release)
				throw "Failed to get release info"

			if (release.status && (release.status == "403" || release.status == "429"))
				throw "API rate limit exceeded. Create a github personal access token to get a higher rate limit."

			if (!("id" in release))
				throw "Failed to get release info"

			if (packageVersion == "latest") {
				packageVersion = semver.clean(release.tag_name, { loose: true }) || packageVersion
				assetFolder = assetPath + `@${packageVersion}`

				const newPackageString = getFullPackageName(packageEntry, { version: packageVersion })

				debugLog(`Updated package version from ${green(packageString)} to ${green(newPackageString)}`)

				packageString = newPackageString
			}

			addDependencyAlias(packageString, args.parentDependencies, packageEntry.alias)
			addAlias(packageString, args.tree, args.parentDependencies, packageEntry.alias)

			// download release repo

			debugLog(`Downloading ${green(packageString)} ...`)

			const asset = await getAsync(release.zipball_url, {
				Accept: "application/vnd.github+json",
				Authorization: auth.github != "" && "Bearer " + auth.github,
				["X-GitHub-Api-Version"]: xGitHubApiVersion
			})

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(packageString)} already exists`)
				return
			}

			if (UTF8.decode(asset.subarray(0, 2)) != "PK")
				throw "Failed to download release files"

			const assetUnzip = assetFolder + "-unzipped"
			mkdirSync(assetUnzip, { recursive: true })

			const assetZip = assetFolder + ".zip"
			writeFileSync(assetZip, asset)

			const zip = new AdmZip(assetZip)
			zip.extractAllTo(path.resolve(assetUnzip), true)

			mkdirSync(assetFolder, { recursive: true })

			let assetFile = assetFolder + `/${packageEntry.name.toLowerCase()}`
			const dirContent = readdirSync(assetUnzip)

			for (const i in dirContent) {
				await renameFile(path.resolve(assetUnzip, dirContent[i]), assetFile)
			}

			await rimraf(assetZip)
			await rimraf(assetUnzip)

			if (!args.tree[packageString])
				args.tree[packageString] = { dependencies: {} }

			addAlias(packageString, args.tree, args.parentDependencies, packageEntry.alias)

			args.tree[packageString].package = {
				scope: packageEntry.scope,
				name: packageEntry.name,
				version: packageVersion,
				environment: packageEntry.environmentOverwrite,
				environmentOverwrite: packageEntry.environmentOverwrite,
				type: packageEntry.type,
			}

			// check package data and sub packages
			const assetDirContent = readdirSync(assetFile)
			let content = {}

			for (const key in assetDirContent)
				content[assetDirContent[key]] = true

			// generate default.project.json if pesde package or if github package has build_files
			if (content[manifestFileNames.rostallerManifest]) {
				const packagePath = assetFile + `/${manifestFileNames.rostallerManifest}`
				const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

				if (!packageFile)
					throw `Failed to validate ${packagePath}`

				if (packageFile.package.build_files) {
					syncConfigGenerator.generate(assetFile, packageFile.package.build_files)
				}

				args.tree[packageString].package.lib = packageFile.package.lib
			} else if (content[manifestFileNames.pesdeManifest]) {
				const packagePath = assetFile + `/${manifestFileNames.pesdeManifest}`
				const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

				if (!packageFile)
					throw `Failed to validate ${packagePath}`

				syncConfigGenerator.generate(assetFile, packageFile.target.build_files || [])
				args.tree[packageString].package.lib = packageFile.target.lib
			}

			// rename default.project.json
			if (content[defaultProjectJsonName]) {
				const projectPath = assetFile + `/${defaultProjectJsonName}`
				let projectFile = validateJson("Project", projectPath, readFileSync(projectPath))

				if (projectFile.name != packageEntry.name.toLowerCase()) {
					debugLog("Renaming", cyan(projectPath))

					projectFile.name = packageEntry.name.toLowerCase()
					writeFileSync(projectPath, JSON.stringify(projectFile, null, "\t"))
				}
			}

			// update environment
			if (!packageEntry.environmentOverwrite) {
				if (content[manifestFileNames.rostallerManifest]) {
					const packagePath = assetFile + `/${manifestFileNames.rostallerManifest}`
					const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

					if (!packageFile)
						throw `Failed to validate ${packagePath}`

					args.tree[packageString].package.environment = packageFile.package.environment
				} else if (content[manifestFileNames.pesdeManifest]) {
					const packagePath = assetFile + `/${manifestFileNames.pesdeManifest}`
					const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

					if (!packageFile)
						throw `Failed to validate ${packagePath}`

					let environment

					const packageTarget = packageFile.target.environment

					if (packageTarget == "roblox_server")
						environment = "server"
					else if (packageTarget == "roblox")
						environment = "shared"
					else if (packageTarget == "luau")
						environment = "shared"

					if (environment)
						args.tree[packageString].package.environment = environment
				} else if (content[manifestFileNames.wallyManifest]) {
					const packagePath = assetFile + `/${manifestFileNames.wallyManifest}`
					const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

					if (!packageFile)
						throw `Failed to validate ${packagePath}`

					args.tree[packageString].package.environment = packageFile.package.realm
				}

				if (!args.tree[packageString].package.environment) {
					debugLog(`${cyan(assetFile)} is missing "${manifestFileNames.rostallerManifest}" file. Environment set to ${green("shared")}`)
					args.tree[packageString].package.environment = "shared"
				}

				if (args.tree[packageString].package.environment != "shared") {
					assetPath = `${packageFolderPaths.get(args.tree[packageString].package.environment)}/${defaultFolderNames.indexFolder}`

					if (!existsSync(assetPath))
						mkdirSync(assetPath, { recursive: true })

					const newPath = assetPath + `/${packageEntry.scope.toLowerCase()}_${packageEntry.name.toLowerCase()}@${rev}`
					await renameFile(assetFolder, newPath)

					assetFolder = newPath
					assetFile = assetFolder + `/${packageEntry.name.toLowerCase()}`
				}
			}

			downloadStats.success += 1
			console.log(`Downloaded ${green(getFullPackageName(packageEntry, { version: packageVersion, ignoreType: true }))} from github`)

			// check dependencies
			let manifest

			if (content[manifestFileNames.rostallerManifest])
				manifest = {
					type: manifestFileNames.rostallerManifest,
					path: `${assetFile}/${manifestFileNames.rostallerManifest}`
				}
			else if (content[manifestFileNames.pesdeManifest])
				manifest = {
					type: manifestFileNames.pesdeManifest,
					path: `${assetFile}/${manifestFileNames.pesdeManifest}`
				}
			else if (content[manifestFileNames.wallyManifest])
				manifest = {
					type: manifestFileNames.wallyManifest,
					path: `${assetFile}/${manifestFileNames.wallyManifest}`
				}

			return {
				packageLink: packageString,
				manifest: manifest,
			}
		} else {
			debugLog(`Package ${green(packageString)} already exists`)
		}
	} catch (err) {
		downloadStats.fail += 1

		const packageEntry = packageEntryFromDependency(args.package)
		const packageString = getFullPackageName(packageEntry, { ignoreType: true })
		console.error(red("Failed to download github package"), green(packageString) + red(":"), yellow(err))
	}
}

/**
 * @param { { package: dependency, tree: any, parentDependencies: any? } } args
 */
export async function deepDownload(args) {
	try {
		const result = await download(args)

		if (!result)
			return
		if (!result.manifest)
			return

		const downloadManifestDependencies = (await import("../universal/manifest.js")).downloadManifestDependencies
		await downloadManifestDependencies(result.manifest, args.tree, args.tree[result.packageLink].dependencies, false)
	} catch (err) {
		const packageEntry = packageEntryFromDependency(args.package)
		const packageString = getFullPackageName(packageEntry, { ignoreType: true })
		console.error(red("Failed to check github package dependencies"), green(packageString) + red(":"), yellow(err))
	}
}

import path from "path"
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "fs"
import { red, yellow, green, cyan } from "../output/colors.js"
import { validateJson } from "../validator/validator.js"
import { getAsync } from "../httpGet.js"
import { defaultProjectJsonName, downloadStats, defaultFolderNames, auth, wallyVersion } from "../configs/mainConfig.js"
import { debugLog } from "../output/output.js"
import * as packageFolderPaths from "../packageFolderPaths.js"
import { getRegistry } from "./registry.js"
import * as semver from "semver"
import { rimraf } from "rimraf"
import AdmZip from "adm-zip"

/**
 * @typedef { object } dependency
 * @property { string } alias
 * @property { string } name
 * @property { string } version
 * @property { string } index
 * @property { ("shared" | "server" | "dev")? } environmentOverwrite
 * @property { "wally" } type
 */

/**
 * @typedef { object } package
 * @property { string } alias
 * @property { string } scope
 * @property { string } name
 * @property { string } version
 * @property { string } index
 * @property { ("shared" | "server" | "dev")? } environmentOverwrite
 * @property { "wally" } type
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
		index: dependency.index,
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

/**
 * @param { string } scope The owning author or organization of the package
 * @param { string } name The search query as a series of characters
 * @param { string } index
 */
async function getPackageMetadata(scope, name, index) {
	return new Promise((resolve, reject) => {
		getRegistry(index)
			.then(async (registry) => {
				const response = await getAsync(`${registry.api}/v1/package-metadata/${scope}/${name}`, {
					Authorization: auth.wally != "" && "Bearer " + auth.wally,
					["Wally-Version"]: wallyVersion
				}, "json")

				if (!response || !response.versions)
					if (registry.fallback_registries) {
						for (const fallback_registry in registry.fallback_registries) {
							const versions = await getPackageMetadata(scope, name, fallback_registry)

							if (versions) {
								resolve(versions)
								break
							}
						}
					} else
						resolve(undefined)

				resolve(response.versions)
			})
			.catch((reason) => {
				reject(reason)
			})

	})
}

let metadataCache = {}

/**
 * @param { string } scope The owning author or organization of the package
 * @param { string } name The search query as a series of characters
 * @param { string } index
 */
async function getMetadata(scope, name, index) {
	if (metadataCache[`${scope}/${name}`])
		return await metadataCache[`${scope}/${name}`]

	metadataCache[`${scope}/${name}`] = getPackageMetadata(scope, name, index)
	return await metadataCache[`${scope}/${name}`]
}

/**
 * @param { string } scope - The owning author or organization of the package
 * @param { string } name - The search query as a series of characters
 * @param { string } index
 */
async function getPackageVersions(scope, name, index) {
	const metadata = await getMetadata(scope, name, index)

	let versions = []

	for (const versionData of metadata) {
		versions.push(semver.clean(versionData.package.version, { loose: true }))
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

	const availableVersions = await getPackageVersions(packageEntry.scope, packageEntry.name, packageEntry.index)
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
 * @param { string } scope The owning author or organization of the package
 * @param { string } name The search query as a series of characters
 * @param { string } version
 * @param { string } index
 */
async function getVersionMetadata(scope, name, version, index) {
	const allVersionsMetaData = await getMetadata(scope, name, index)

	for (const versionData of allVersionsMetaData) {
		if (versionData.package.version == version)
			return versionData
	}

	return null
}

/**
 * @param { * } versionMetadata
 * @returns { Promise<dependency[]> }
 */
async function getDependencies(versionMetadata) {
	let dependencies = []

	function addDependency(alias, dependencyData, environmentOverwrite) {
		const name = dependencyData.split("@")[0]
		const version = dependencyData.split("@")[1]

		const packageEntry = {
			alias: alias,
			name: name,
			version: version,
			index: versionMetadata.package.registry,
			environmentOverwrite: environmentOverwrite,
			type: "wally"
		}

		dependencies.push(packageEntry)
	}

	const packageDependencies = versionMetadata["dependencies"]

	for (const alias in packageDependencies) {
		addDependency(alias, packageDependencies[alias])
	}

	const packageServerDependencies = versionMetadata["server-dependencies"]

	for (const alias in packageServerDependencies) {
		addDependency(alias, packageServerDependencies[alias], "server")
	}

	return dependencies
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
		const packageEntry = packageEntryFromDependency(args.package)
		const packageVersion = await resolveRequirement(packageEntry)
		const packageString = getFullPackageName(packageEntry, { version: packageVersion })
		const versionMetadata = await getVersionMetadata(packageEntry.scope, packageEntry.name, packageVersion, packageEntry.index)

		const environment = packageEntry.environmentOverwrite || versionMetadata.package.realm
		const assetPath = `${packageFolderPaths.get(environment)}/${defaultFolderNames.indexFolder}/${packageEntry.scope.toLowerCase()}_${packageEntry.name.toLowerCase()}`

		let assetFolder = assetPath + `@${packageVersion}`

		addDependencyAlias(packageString, args.parentDependencies, packageEntry.alias)
		addAlias(packageString, args.tree, args.parentDependencies, packageEntry.alias)

		if (!existsSync(assetFolder)) {
			// download release repo

			debugLog(`Downloading ${green(packageString)} ...`)

			const registry = await getRegistry(packageEntry.index)
			const asset = await getAsync(`${registry.api}/v1/package-contents/${packageEntry.scope}/${packageEntry.name}/${packageVersion}`, {
				Authorization: auth.wally != "" && "Bearer " + auth.wally,
				["Wally-Version"]: wallyVersion
			})

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(packageString)} already exists`)
				return
			}

			if (asset.toString().substring(0, 2) != "PK")
				throw "Failed to download release files"

			mkdirSync(assetFolder, { recursive: true })

			const assetZip = assetFolder + ".zip"
			writeFileSync(assetZip, asset)

			let assetFile = assetFolder + `/${packageEntry.name.toLowerCase()}`

			const zip = new AdmZip(assetZip)
			zip.extractAllTo(path.resolve(assetFile), true)

			await rimraf(assetZip)

			if (!args.tree[packageString])
				args.tree[packageString] = { dependencies: {} }

			addAlias(packageString, args.tree, args.parentDependencies, packageEntry.alias)

			args.tree[packageString].package = {
				scope: packageEntry.scope,
				name: packageEntry.name,
				version: packageVersion,
				environment: environment,
				environmentOverwrite: packageEntry.environmentOverwrite,
				type: packageEntry.type,
				index: packageEntry.index
			}

			// check package data and sub packages
			const assetDirContent = readdirSync(assetFile)
			let content = {}

			for (const key in assetDirContent)
				content[assetDirContent[key]] = true

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

			downloadStats.success += 1
			console.log(`Downloaded ${green(getFullPackageName(packageEntry, { version: packageVersion, ignoreType: true }))} from wally`)

			return {
				packageLink: packageString,
				dependencies: await getDependencies(versionMetadata)
			}
		} else {
			debugLog(`Package ${green(packageString)} already exists`)
		}
	} catch (err) {
		downloadStats.fail += 1

		const packageEntry = packageEntryFromDependency(args.package)
		const packageString = getFullPackageName(packageEntry, { ignoreType: true })
		console.error(red("Failed to download wally package"), green(packageString) + red(":"), yellow(err))
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

		const downloadDeepDependencies = (await import("../universal/manifest.js")).downloadDeepDependencies
		await downloadDeepDependencies(result.dependencies, args.tree, args.tree[result.packageLink].dependencies)
	} catch (err) {
		const packageEntry = packageEntryFromDependency(args.package)
		const packageString = getFullPackageName(packageEntry, { ignoreType: true })
		console.error(red("Failed to check wally package dependencies"), green(packageString) + red(":"), yellow(err))
	}
}

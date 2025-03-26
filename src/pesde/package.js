import path from "path"
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "fs"
import { red, yellow, green } from "../output/colors.js"
import { getAsync } from "../httpGet.js"
import { downloadStats, defaultFolderNames, auth, manifestFileNames, defaultProjectJsonName } from "../configs/mainConfig.js"
import { debugLog } from "../output/output.js"
import * as packageFolderPaths from "../packageFolderPaths.js"
import { getRegistry } from "./registry.js"
import { extractTarGz } from "../extractTagGz.js"
import * as semver from "semver"
import { rimraf } from "rimraf"
import * as syncConfigGenerator from "../syncConfigGenerator.js"
import { validateJson, validateToml } from "../validator/validator.js"

/**
 * @typedef { object } dependency
 * @property { string } alias
 * @property { string } name
 * @property { string } version
 * @property { string } index
 * @property { ("shared" | "server" | "dev")? } environmentOverwrite
 * @property { "pesde" } type
 */

/**
 * @typedef { object } package
 * @property { string } alias
 * @property { string } scope
 * @property { string } name
 * @property { string } version
 * @property { string } index
 * @property { ("shared" | "server" | "dev")? } environmentOverwrite
 * @property { "pesde" } type
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
				const response = await getAsync(`${registry.api}/v1/packages/${scope}%2F${name}`, {
					Accept: "application/octet-stream",
					Authorization: auth.pesde != "" && "Bearer " + auth.pesde
				}, "json")

				if (!response || !response.versions)
					if (registry.other_registries_allowed) {
						for (const fallback_registry in registry.other_registries_allowed) {
							const versions = await getPackageMetadata(scope, name, fallback_registry)

							if (versions) {
								resolve(versions)
								break
							}
						}
					} else if (registry.wally_allowed) {
						console.log("WHY??")
						for (const fallback_registry in registry.wally_allowed) {
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
	const validTargets = ["roblox_server", "roblox", "luau"]
	const metadata = await getMetadata(scope, name, index)

	let versions = []

	for (const version in metadata) {
		const targets = metadata[version].targets

		for (const target in targets) {
			/*
			TODO
			Maybe add a way to prevent installing yanked packages if present in root rostaller.toml file

			if (targets[target].yanked)
				continue
			*/

			if (!validTargets.includes(target))
				continue

			versions.push(semver.clean(version, { loose: true }))
			break
		}
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

	for (const otherVersion in allVersionsMetaData) {
		if (otherVersion == version)
			return allVersionsMetaData[otherVersion]
	}

	return null
}

/**
 * @param { * } versionMetadata
 * @param { "roblox_server" | "roblox" | "luau" } packageTarget
 * @returns { Promise<dependency[]> }
 */
async function getDependencies(versionMetadata, packageTarget) {
	let dependencies = []

	function addDependency(alias, dependencyData) {
		if (dependencyData[1] != "standard" && dependencyData[1] != "peer")
			return

		const dependency = dependencyData[0]
		const name = dependency.wally && dependency.wally.replace(/^.+\#/, "") || dependency.name

		const packageEntry = {
			alias: alias,
			name: name,
			version: dependency.version,
			index: dependency.index,
			type: dependency.wally && "wally" || "pesde"
		}

		dependencies.push(packageEntry)
	}

	const packageDependencies = versionMetadata.targets[packageTarget].dependencies

	for (const alias in packageDependencies) {
		addDependency(alias, packageDependencies[alias])
	}

	const packagePeerDependencies = versionMetadata.targets[packageTarget].peer_dependencies

	for (const alias in packagePeerDependencies) {
		addDependency(alias, packagePeerDependencies[alias])
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

		let packageTarget

		if (versionMetadata.targets.roblox_server)
			packageTarget = "roblox_server"
		else if (versionMetadata.targets.roblox)
			packageTarget = "roblox"
		else if (versionMetadata.targets.luau)
			packageTarget = "luau"

		const environment = packageEntry.environmentOverwrite || (packageTarget == "roblox_server" && "server") || "shared"
		const assetPath = `${packageFolderPaths.get(environment)}/${defaultFolderNames.indexFolder}/${packageEntry.scope.toLowerCase()}_${packageEntry.name.toLowerCase()}`

		let assetFolder = assetPath + `@${packageVersion}`

		addDependencyAlias(packageString, args.parentDependencies, packageEntry.alias)
		addAlias(packageString, args.tree, args.parentDependencies, packageEntry.alias)

		if (!existsSync(assetFolder)) {
			// download release repo

			debugLog(`Downloading ${green(packageString)} ...`)

			const registry = await getRegistry(packageEntry.index)
			const asset = await getAsync(`${registry.api}/v1/packages/${packageEntry.scope}%2F${packageEntry.name}/${packageVersion}/${packageTarget}/archive`, {
				Accept: "application/octet-stream",
				Authorization: auth.pesde != "" && "Bearer " + auth.pesde
			})

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(packageString)} already exists`)
				return
			}

			if (!asset)
				throw "Failed to download release files"

			mkdirSync(assetFolder, { recursive: true })

			const assetZip = assetFolder + ".tar.gz"
			writeFileSync(assetZip, asset)

			let assetFile = assetFolder + `/${packageEntry.name.toLowerCase()}`

			await extractTarGz(assetZip, path.resolve(assetFile))
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

			// generate default.project.json if pesde package
			if (content[manifestFileNames.pesdeManifest]) {
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

			downloadStats.success += 1
			console.log(`Downloaded ${green(getFullPackageName(packageEntry, { version: packageVersion, ignoreType: true }))} from pesde`)

			return {
				packageLink: packageString,
				dependencies: await getDependencies(versionMetadata, packageTarget)
			}
		} else {
			debugLog(`Package ${green(packageString)} already exists`)
		}
	} catch (err) {
		downloadStats.fail += 1

		const packageEntry = packageEntryFromDependency(args.package)
		const packageString = getFullPackageName(packageEntry, { ignoreType: true })
		console.error(red("Failed to download pesde package"), green(packageString) + red(":"), yellow(err))
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
		console.error(red("Failed to check pesde package dependencies"), green(packageString) + red(":"), yellow(err))
	}
}

import path from "path"
import { existsSync, readFileSync } from "fs"
import { rootManifestConfig } from "../configs/rootManifestConfig.js"
import { config, lockFileName, mainPath, manifestFileNames } from "../configs/mainConfig.js"
import { validateToml } from "../validator/validator.js"
import { cyan, magenta, yellow } from "../output/colors.js"
import { debugLog } from "../output/output.js"
import { Queue } from "async-await-queue"
import * as download from "../download.js"
import * as githubManifest from "../github/manifest.js"
import * as pesdeManifest from "../pesde/manifest.js"
import * as wallyManifest from "../wally/manifest.js"
import { getPackageType } from "./package.js"

/**
 * @typedef { object } manifest
 * @property { string } path
 * @property { string } type
 */

/**
 * @param { boolean? } forceRostallerManifest
 */
export function getRootManifest(forceRostallerManifest) {
	let manifestName = manifestFileNames.rostallerManifest

	if (!forceRostallerManifest) {
		if (existsSync(`${mainPath}/${manifestFileNames.rostallerManifest}`))
			manifestName = manifestFileNames.rostallerManifest
		else if (existsSync(`${mainPath}/${manifestFileNames.pesdeManifest}`))
			manifestName = manifestFileNames.pesdeManifest
		else if (existsSync(`${mainPath}/${manifestFileNames.wallyManifest}`))
			manifestName = manifestFileNames.wallyManifest
	}

	const manifest = {
		type: manifestName,
		path: `${mainPath}/${manifestName}`
	}

	return manifest
}

/**
 * @param { manifest } manifest
 * @param { boolean? } isRoot
 */
export async function getManifestData(manifest, isRoot) {
	if (!existsSync(manifest.path))
		throw `[${manifest.path}] does not exist`

	debugLog("Loading", cyan(manifest.path))

	const rootPackage = isRoot && { rootType: manifest.type } || undefined
	const manifestData = validateToml(manifest.path, readFileSync(manifest.path).toString(), rootPackage)

	if (!manifestData)
		throw `[${manifest.path}] is invalid`

	process.chdir(path.resolve(manifest.path, ".."))
	return manifestData
}

/**
 * @param { manifest } manifest
 * @param { boolean? } isRoot
 */
async function setConfigFromRootManifest(manifest, isRoot) {
	let allOk = true

	const manifestData = await getManifestData(manifest, isRoot)

	if (manifestData.place) {
		rootManifestConfig.sharedPackages = manifestData.place.shared_packages || rootManifestConfig.sharedPackages
		rootManifestConfig.serverPackages = manifestData.place.server_packages || rootManifestConfig.serverPackages
		rootManifestConfig.devPackages = manifestData.place.dev_packages || rootManifestConfig.devPackages
	}

	if (!rootManifestConfig.sharedPackages || !rootManifestConfig.serverPackages || !rootManifestConfig.devPackages)
		allOk = false

	if (!allOk) {
		console.error(yellow(`
		To link packages correctly you must declare where each
		packages are placed in the Roblox DataModel.

		This typically looks like:

		[place]
		shared_packages = "game.ReplicatedStorage.sharedPackages"
		server_packages = "game.ServerScriptService.serverPackages"
		dev_packages = "game.ReplicatedStorage.devPackages"
		`).replace(/\t/g, ""))

		process.exit(1)
	}
}

/**
 * @param { import("../download.js").unversalDependency[] } dependencies
 * @param { * } tree
 * @param { * } parentDependencies
 * @param { boolean? } isRoot
 */
export async function downloadDeepDependencies(dependencies, tree, parentDependencies, isRoot) {
	const queue = new Queue(config.maxConcurrentDownloads)
	const promises = []

	/**
	 * @param { import("../download.js").unversalDependency } dependency
	 */
	function queueDependency(dependency) {
		promises.push(queue.run(() => download.deep({
			package: dependency,
			parentDependencies: parentDependencies,
			tree: tree,
			isRoot: isRoot
		}).catch((err) => console.error(err))))
	}

	for (const dependency of dependencies) {
		queueDependency(dependency)
	}

	return Promise.all(promises)
}

/**
 * @param { manifest } manifest
 * @param { boolean? } isRoot
 */
export async function getManifestDependencies(manifest, isRoot) {
	let allDependencies = []

	if (manifest.type == manifestFileNames.rostallerManifest)
		allDependencies = await githubManifest.get(manifest, isRoot)
	else if (manifest.type == manifestFileNames.pesdeManifest)
		allDependencies = await pesdeManifest.get(manifest)
	else if (manifest.type == manifestFileNames.wallyManifest)
		allDependencies = await wallyManifest.get(manifest)
	else
		throw `[${manifest.path}] is not a correct manifest file`

	return allDependencies
}

/**
 * @param { manifest } manifest
 * @param { * } tree
 * @param { * } parentDependencies
 * @param { boolean? } isRoot
 */
export async function downloadManifestDependencies(manifest, tree, parentDependencies, isRoot) {
	if (isRoot) {
		await setConfigFromRootManifest(manifest, isRoot)
	}

	const allDependencies = await getManifestDependencies(manifest, isRoot)
	return await downloadDeepDependencies(allDependencies, tree, parentDependencies, isRoot)
}

/**
 * @param { * } lockFileData
 * @param { * } tree
 */
export async function downloadLockDependencies(lockFileData, tree) {
	debugLog(magenta(`Downloading dependencies from ${lockFileName} file ...`, true))

	const manifest = getRootManifest(true)
	await setConfigFromRootManifest(manifest, true)

	const queue = new Queue(config.maxConcurrentDownloads)
	const promises = []

	for (const packageLink in lockFileData) {
		let dependency = lockFileData[packageLink]
		const packageType = getPackageType(dependency)

		dependency.name = dependency[packageType]
		dependency.type = packageType

		promises.push(queue.run(() => download.dependency({
			package: dependency,
			parentDependencies: undefined,
			tree: tree,
			isRoot: dependency.isMainDependency
		}).catch((err) => console.error(err))))
	}

	return Promise.all(promises)
}

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
 * @param { manifest } manifest
 * @param { boolean? } isRoot
 */
export async function getManifestData(manifest, isRoot) {
	if (!existsSync(manifest.path))
		throw `[${manifest.path}] does not exist`

	debugLog("Loading", cyan(manifest.path))

	const manifestData = validateToml(manifest.path, readFileSync(manifest.path).toString(), isRoot)

	if (!manifestData)
		throw `[${manifest.path}] is invalid`

	process.chdir(path.resolve(manifest.path, ".."))
	return manifestData
}

/**
 * @param {*} manifestData
 */
export function setConfigFromRootManifest(manifestData) {
	let allOk = true

	if (manifestData.place) {
		rootManifestConfig.sharedPackages = manifestData.place.shared_packages
		rootManifestConfig.serverPackages = manifestData.place.server_packages
		rootManifestConfig.devPackages = manifestData.place.dev_packages

		if (!manifestData.place.shared_packages)
			allOk = false

		if (!manifestData.place.server_packages)
			allOk = false

		if (!manifestData.place.dev_packages)
			allOk = false
	} else
		allOk = false

	if (!allOk) {
		console.error(yellow(`
		To link packages correctly you must declare where each
		packages are placed in the Roblox DataModel.

		This typically looks like:

		[place]
		shared_packages = "game.ReplicatedStorage.Packages"
		server_packages = "game.ServerScriptService.ServerPackages"
		dev_packages = "game.ReplicatedStorage.DevPackages"
		`).replace(/\t/g, ""))

		process.exit(1)
	}
}

/**
 * @param { import("../download.js").unversalDependency[] } dependencies
 * @param { * } tree
 * @param { * } parentDependencies
 */
export async function downloadDeepDependencies(dependencies, tree, parentDependencies) {
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
		const manifestData = await getManifestData(manifest, isRoot)
		setConfigFromRootManifest(manifestData)
	}

	const allDependencies = await getManifestDependencies(manifest, isRoot)
	return await downloadDeepDependencies(allDependencies, tree, parentDependencies)
}

/**
 * @param { * } lockFileData
 * @param { * } tree
 */
export async function downloadLockDependencies(lockFileData, tree) {
	debugLog(magenta(`Downloading dependencies from ${lockFileName} file ...`, true))

	const manifest = {
		type: manifestFileNames.rostallerManifest,
		path: `${mainPath}/${manifestFileNames.rostallerManifest}`
	}

	const manifestData = await getManifestData(manifest, true)

	setConfigFromRootManifest(manifestData)

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
		}).catch((err) => console.error(err))))
	}

	return Promise.all(promises)
}

import { existsSync, readFileSync } from "fs"
import { resolve, parse } from "path"
import { rootManifestConfig } from "./configs/rootManifestConfig.js"
import { config, manifestFileNames } from "./configs/mainConfig.js"
import { validateToml } from "./validator/validator.js"
import { githubDeepDependency, githubDependency } from "./dependencies/githubDependency.js"
import { githubBranchDeepDependency, githubBranchDependency } from "./dependencies/githubBranchDependency.js"
import { wallyDeepDependency, wallyDependency } from "./dependencies/wallyDependency.js"
import { cyan, yellow, green } from "./output/colors.js"
import { debugLog } from "./output/output.js"
import { Queue } from "async-await-queue"

async function downloadDeepDependency(alias, dependencyLink, fileType, tree, parentDependencies, realmOverwrite) {
	const dependencyLinkSplit = dependencyLink.split("#")
	const packageType = dependencyLinkSplit[0]
	const packageLink = dependencyLinkSplit[1]

	if (packageType == "wally")
		await wallyDeepDependency(alias, packageLink, tree, parentDependencies, realmOverwrite)
	else if (packageType == "github")
		await githubDeepDependency(alias, packageLink, tree, parentDependencies, realmOverwrite)
	else if (packageType == "github-branch")
		await githubBranchDeepDependency(alias, packageLink, tree, parentDependencies, realmOverwrite)
	else {
		if (fileType == "wally") {
			await wallyDeepDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite)
		}
		else if (fileType == "github")
			await githubDeepDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite)
	}
}

async function downloadDependency(alias, dependencyLink, fileType, tree, parentDependencies, realmOverwrite) {
	const dependencyLinkSplit = dependencyLink.split("#")
	const packageType = dependencyLinkSplit[0]
	const packageLink = dependencyLinkSplit[1]

	if (packageType == "wally")
		await wallyDependency(alias, packageLink, tree, parentDependencies, realmOverwrite)
	else if (packageType == "github")
		await githubDependency(alias, packageLink, tree, parentDependencies, realmOverwrite)
	else if (packageType == "github-branch")
		await githubBranchDependency(alias, packageLink, tree, parentDependencies, realmOverwrite)
	else {
		if (fileType == "wally") {
			await wallyDependency(alias, dependencyLink, parentDependencies, tree, realmOverwrite)
		}
		else if (fileType == "github")
			await githubDependency(alias, dependencyLink, parentDependencies, tree, realmOverwrite)
	}
}

/**
 * @param {string} manifestFile
 * @param {boolean?} isRoot
 */
export async function getManifestData(manifestFile, isRoot) {
	if (!existsSync(manifestFile))
		throw `${cyan(manifestFile)} ${yellow("does not exist")}`

	debugLog("Loading", cyan(manifestFile))

	var manifestData = validateToml(isRoot && "RootPackage" || "SubPackage", manifestFile, readFileSync(manifestFile))

	if (!manifestData)
		throw `${cyan(manifestFile)} ${yellow("is invalid")}`

	process.chdir(resolve(manifestFile, ".."))

	return manifestData
}

export function setConfigFromRootManifest(manifestData) {
	if (manifestData.place && manifestData.place["shared-packages"])
		rootManifestConfig.sharedPackages = manifestData.place["shared-packages"]

	if (manifestData.place && manifestData.place["server-packages"])
		rootManifestConfig.serverPackages = manifestData.place["server-packages"]
}

/**
 * @param {string} manifestFile
 * @param {any} tree
 * @param {any} parentDependencies
 * @param {boolean?} isRoot
 */
export async function downloadManifestDependencies(manifestFile, tree, parentDependencies, isRoot) {
	const manifestData = await getManifestData(manifestFile, isRoot)

	debugLog("Mapping", green(parse(process.cwd()).name))

	if (isRoot)
		setConfigFromRootManifest(manifestData)

	const manifestName = parse(manifestFile).base
	var fileType

	if (manifestName == manifestFileNames.wallyManifest)
		fileType = "wally"
	else if (manifestName == manifestFileNames.githubManifest)
		fileType = "github"
	else
		fileType = "unknown"

	if (fileType == "unknown")
		throw `${cyan(manifestFile)} ${yellow("is not the correct manifest file")}`

	const queue = new Queue(config.MaxConcurrentDownloads)
	const promises = []

	const dependencies = manifestData.dependencies

	if (dependencies) {
		for (const dependencyName in dependencies) {
			promises.push(queue.run(() => downloadDeepDependency(dependencyName, dependencies[dependencyName], fileType, tree, parentDependencies).catch((err) => console.error(err))))
		}
	}

	const serverDependencies = manifestData["server-dependencies"]

	if (serverDependencies) {
		for (const dependencyName in serverDependencies) {
			promises.push(queue.run(() => downloadDeepDependency(dependencyName, serverDependencies[dependencyName], fileType, tree, parentDependencies).catch((err) => console.error(err))))
		}
	}

	const sharedDependenciesOverwrite = manifestData["shared-dependencies-overwrite"]

	if (sharedDependenciesOverwrite) {
		for (const dependencyName in sharedDependenciesOverwrite) {
			promises.push(queue.run(() => downloadDeepDependency(dependencyName, sharedDependenciesOverwrite[dependencyName], fileType, tree, parentDependencies, "shared").catch((err) => console.error(err))))
		}
	}

	const serverDependenciesOverwrite = manifestData["server-dependencies-overwrite"]

	if (serverDependenciesOverwrite) {
		for (const dependencyName in serverDependenciesOverwrite) {
			promises.push(queue.run(() => downloadDeepDependency(dependencyName, serverDependenciesOverwrite[dependencyName], fileType, tree, parentDependencies, "server").catch((err) => console.error(err))))
		}
	}

	if (isRoot) {
		const devDependencies = manifestData["dev-dependencies"]

		if (devDependencies) {
			for (const dependencyName in devDependencies) {
				promises.push(queue.run(() => downloadDeepDependency(dependencyName, devDependencies[dependencyName], fileType, tree, parentDependencies, "dev").catch((err) => console.error(err))))
			}
		}
	}

	return Promise.all(promises)
}

/**
 * @param {any} lockFileData
 * @param {any} tree
 */
export async function downloadLockDependencies(lockFileData, tree) {
	const manifestData = await getManifestData(manifestFileNames.githubManifest, true)

	debugLog("Mapping", green(parse(process.cwd()).name))

	setConfigFromRootManifest(manifestData)

	const queue = new Queue(config.MaxConcurrentDownloads)
	const promises = []

	for (const dependencyLink in lockFileData) {
		const dependencyData = lockFileData[dependencyLink]
		const realmOverwrite = dependencyData.realmOverwrite
		promises.push(queue.run(() => downloadDependency(dependencyData.alias, dependencyLink, undefined, tree, undefined, realmOverwrite).catch((err) => console.error(err))))
	}

	return Promise.all(promises)
}

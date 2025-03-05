import { existsSync, mkdirSync, writeFileSync } from "fs"
import { config, defaultFolderNames, mainPath, tempFileNames } from "./configs/mainConfig.js"
import { rootManifestConfig } from "./configs/rootManifestConfig.js"
import { magenta } from "./output/colors.js"
import { debugLog } from "./output/output.js"
import * as packageFolderPaths from "./packageFolderPaths.js"
import { execSync } from "child_process"
import { rimraf } from "rimraf"

const addon = require("..")

/**
 * Removes the `init.lua` or `init.luau` file from the lib
 * @param { string } link
 * @param { string } lib
 */
function updateLink(link, lib) {
	for (const path of lib.replace(/\/?init.luau?$/, "").split("/")) {
		if (path == "")
			continue

		link += `.${path.replace(/.luau?$/, "")}`
	}

	return link
}

/**
 *
 * @param { * } packageData
 */
function getPathName(packageData) {
	if (packageData.type == "github-rev")
		return `${packageData.scope.toLowerCase()}_${packageData.name.toLowerCase()}@${packageData.rev}`
	else
		return `${packageData.scope.toLowerCase()}_${packageData.name.toLowerCase()}@${packageData.version}`
}

/**
 * @param { string } environment
 * @param { string } packageAlias
 * @param { * } packageData
 */
async function createLuauRootFile(environment, packageAlias, packageData) {
	const fullName = getPathName(packageData)
	const shortName = packageData.name.toLowerCase()

	let link = `script.Parent.${defaultFolderNames.indexFolder}["${fullName}"]["${shortName}"]`

	if (packageData.lib)
		link = updateLink(link, packageData.lib)

	const moduleData = `return require(${link})\n`
	writeFileSync(`${packageFolderPaths.get(environment)}/${packageAlias}.luau`, moduleData)
}

/**
 * @param { string } environment
 * @param { string } packageAlias
 * @param { * } packageData
 * @param { string } packageAlias
 * @param { * } parentPackage
 */
async function createLuauDependencyFile(environment, packageAlias, packageData, parentPackageAlias, parentPackage) {
	const parentPackageFullName = getPathName(parentPackage)
	const fullName = getPathName(packageData)
	const shortName = packageData.name.toLowerCase()

	let path = `${packageFolderPaths.get(environment)}/${defaultFolderNames.indexFolder}/${parentPackageFullName}`
	let link

	if (packageData.environment == parentPackage.environment)
		link = `script.Parent.Parent["${fullName}"]["${shortName}"]`
	else if (packageData.environment == "shared" && (parentPackage.environment == "server" || parentPackage.environment == "dev")) {
		// server or dev dependency is depending on a shared dependency

		const sharedPackages = rootManifestConfig.sharedPackages
		link = `${sharedPackages}.${defaultFolderNames.indexFolder}["${fullName}"]["${shortName}"]`
	} else if (packageData.environment == "server" && parentPackage.environment == "dev") {
		// dev dependency is depending on a server dependency

		const serverPackages = rootManifestConfig.serverPackages
		link = `${serverPackages}.${defaultFolderNames.indexFolder}["${fullName}"]["${shortName}"]`
	} else {
		throw `${parentPackageAlias} (${parentPackageFullName}) in "${parentPackage.environment}" environment cannot access ${packageAlias} (${fullName}) in "${packageData.environment}" environment`
	}

	if (packageData.lib)
		link = updateLink(link, packageData.lib)

	const moduleData = `return require(${link})\n`
	writeFileSync(`${path}/${packageAlias}.luau`, moduleData)
}

/**
 * @param { string } environment
 * @param { string } packageAlias
 * @param { * } packageData
 * @param { string } packageAlias
 * @param { * } parentPackage
 */
async function createPesdeLuauDependencyFile(environment, packageAlias, packageData, parentPackageAlias, parentPackage) {
	const parentPackageFullName = getPathName(parentPackage)
	const fullName = getPathName(packageData)
	const shortName = packageData.name.toLowerCase()

	let path = `${packageFolderPaths.get(environment)}/${defaultFolderNames.indexFolder}/${parentPackageFullName}/${parentPackage.name.toLowerCase()}`
	let link

	if (packageData.environment == parentPackage.environment)
		link = `script.Parent.Parent.Parent.Parent["${fullName}"]["${shortName}"]`
	else if (packageData.environment == "shared" && (parentPackage.environment == "server" || parentPackage.environment == "dev")) {
		// server or dev dependency is depending on a shared dependency

		const sharedPackages = rootManifestConfig.sharedPackages
		link = `${sharedPackages}.${defaultFolderNames.indexFolder}["${fullName}"]["${shortName}"]`
	} else if (packageData.environment == "server" && parentPackage.environment == "dev") {
		// dev dependency is depending on a server dependency

		const serverPackages = rootManifestConfig.serverPackages
		link = `${serverPackages}.${defaultFolderNames.indexFolder}["${fullName}"]["${shortName}"]`
	} else {
		throw `${parentPackageAlias} (${parentPackageFullName}) in "${parentPackage.environment}" environment cannot access ${packageAlias} (${fullName}) in "${packageData.environment}" environment`
	}

	if (packageData.lib)
		link = updateLink(link, packageData.lib)

	if (packageData.environment == "server")
		path += "/roblox_server_packages"
	else
		path += "/roblox_packages"

	if (!existsSync(path))
		mkdirSync(path, { recursive: true })

	const moduleData = `return require(${link})\n`
	writeFileSync(`${path}/${packageAlias}.luau`, moduleData)
}

function createJsonPath(fileData, packagesPathString, packagesFolder) {
	const pathElements = packagesPathString.split(".")

	let path = fileData.tree

	for (const i in pathElements) {
		if (pathElements[i] == "game" && parseInt(i) == 0)
			continue

		if (!path[pathElements[i]])
			path[pathElements[i]] = {}

		if (parseInt(i) + 1 == pathElements.length)
			path[pathElements[i]] = {
				$path: packagesFolder
			}

		path = path[pathElements[i]]
	}
}

function createTempProjectJsonFile(map) {
	let packageTypes = {
		sharedPackages: false,
		serverPackages: false,
		devPackages: false
	}

	for (const key in map) {
		const packageData = map[key]

		const environment = packageData.package.environment

		if (environment == "shared")
			packageTypes.sharedPackages = true
		else if (environment == "server")
			packageTypes.serverPackages = true
		else if (environment == "dev")
			packageTypes.devPackages = true

		if (packageTypes.sharedPackages && packageTypes.serverPackages && packageTypes.devPackages)
			break
	}

	const fileData = {
		name: "rostaller",
		tree: {
			$className: "DataModel",
		}
	}

	if (packageTypes.sharedPackages)
		createJsonPath(fileData, rootManifestConfig.sharedPackages, rootManifestConfig.sharedPackagesFolder)

	if (packageTypes.serverPackages)
		createJsonPath(fileData, rootManifestConfig.serverPackages, rootManifestConfig.serverPackagesFolder)

	if (packageTypes.devPackages)
		createJsonPath(fileData, rootManifestConfig.devPackages, rootManifestConfig.devPackagesFolder)

	writeFileSync(tempFileNames.projectJson, JSON.stringify(fileData, null, "\t"))
}

export async function createLuauFiles(map) {
	debugLog(magenta("Creating .luau files ...", true))

	for (const rootPackageLink in map) {
		const packageMetadata = map[rootPackageLink]

		if (packageMetadata.alias)
			await createLuauRootFile(packageMetadata.package.environment, packageMetadata.alias, packageMetadata.package)
		for (const dependencyPackageLink in packageMetadata.dependencies) {
			const packageData = map[dependencyPackageLink].package

			if (packageMetadata.package.type == "pesde")
				await createPesdeLuauDependencyFile(packageMetadata.package.environment, packageMetadata.dependencies[dependencyPackageLink].alias, packageData, packageMetadata.alias, packageMetadata.package)
			else
				await createLuauDependencyFile(packageMetadata.package.environment, packageMetadata.dependencies[dependencyPackageLink].alias, packageData, packageMetadata.alias, packageMetadata.package)
		}
	}

	process.chdir(mainPath)

	debugLog(magenta(`Creating ${tempFileNames.projectJson} file ...`, true))
	createTempProjectJsonFile(map)

	let stdio

	if (!config.debug)
		stdio = "ignore"

	debugLog(magenta(`Creating ${tempFileNames.sourcemap} file ...`, true))
	execSync(`${config.sourcemapGenerator} sourcemap ${tempFileNames.projectJson} --output ${tempFileNames.sourcemap}`, { stdio: stdio })

	debugLog(magenta("Adding types to .luau files ...", true))

	try {
		const packagesPath = packageFolderPaths.get("shared")

		if (existsSync(packagesPath))
			await addon.generate_types(tempFileNames.sourcemap, `${packagesPath}/`)
	} catch (err) { }

	try {
		const packagesPath = packageFolderPaths.get("server")

		if (existsSync(packagesPath))
			await addon.generate_types(tempFileNames.sourcemap, `${packagesPath}/`)
	} catch (err) { }

	try {
		const packagesPath = packageFolderPaths.get("dev")

		if (existsSync(packagesPath))
			await addon.generate_types(tempFileNames.sourcemap, `${packagesPath}/`)
	} catch (err) { }

	debugLog(magenta(`Removing ${tempFileNames.projectJson} file ...`, true))
	await rimraf(tempFileNames.projectJson)

	debugLog(magenta(`Removing ${tempFileNames.sourcemap} file ...`, true))
	await rimraf(tempFileNames.sourcemap)
}

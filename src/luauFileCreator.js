import { existsSync, writeFileSync } from "fs"
import { config, defaultFolderNames, mainPath, tempFileNames } from "./configs/mainConfig"
import { rootManifestConfig } from "./configs/rootManifestConfig"
import { magenta } from "./output/colors"
import { debugLog } from "./output/output"
import { createTempProjectJsonFile } from "./tempProjectFileCreator"
import { getPackageFolderPath } from "./packageFolderPath"
import { execSync } from "child_process"
import { rimraf } from "rimraf"

const addon = require('..')

/**
 * @param {string} realm
 * @param {string} packageAlias
 * @param {any} packageData
 */
async function createLuauRootFile(realm, packageAlias, packageData) {
	const fullName = `${packageData.owner.toLowerCase()}_${packageData.name.toLowerCase()}@${packageData.version}`
	const shortName = packageData.name.toLowerCase()

	let moduleData = `return require(script.Parent.${defaultFolderNames.indexFolder}["${fullName}"]["${shortName}"])\n`
	writeFileSync(`${getPackageFolderPath(realm)}/${packageAlias}.luau`, moduleData)
}

/**
 * @param {string} realm
 * @param {string} packageAlias
 * @param {any} packageData
 * @param {string} packageAlias
 * @param {any} parentPackage
 */
async function createLuauDependencyFile(realm, packageAlias, packageData, parentPackageAlias, parentPackage) {
	const parentPackageFullName = `${parentPackage.owner.toLowerCase()}_${parentPackage.name.toLowerCase()}@${parentPackage.version}`
	const fullName = `${packageData.owner.toLowerCase()}_${packageData.name.toLowerCase()}@${packageData.version}`
	const shortName = packageData.name.toLowerCase()

	let moduleData

	if (packageData.realm == parentPackage.realm)
		moduleData = `return require(script.Parent.Parent["${fullName}"]["${shortName}"])\n`
	else if (packageData.realm == "shared" && (parentPackage.realm == "server" || parentPackage.realm == "dev")) {
		// server or dev dependency is depending on a shared dependency

		const sharedPackages = rootManifestConfig.sharedPackages
		moduleData = `return require(${sharedPackages}.${defaultFolderNames.indexFolder}["${fullName}"]["${shortName}"])\n`
	} else if (packageData.realm == "server" && parentPackage.realm == "dev") {
		// dev dependency is depending on a server dependency

		const serverPackages = rootManifestConfig.serverPackages
		moduleData = `return require(${serverPackages}.${defaultFolderNames.indexFolder}["${fullName}"]["${shortName}"])\n`
	} else {
		throw `${parentPackageAlias} (${parentPackageFullName}) in "${parentPackage.realm}" realm cannot access ${packageAlias} (${fullName}) in "${packageData.realm}" realm`
	}

	writeFileSync(`${getPackageFolderPath(realm)}/${defaultFolderNames.indexFolder}/${parentPackageFullName}/${packageAlias}.luau`, moduleData)
}

export async function createLuauFiles(map) {
	for (const rootPackageLink in map) {
		const packageMetadata = map[rootPackageLink]

		if (packageMetadata.alias)
			await createLuauRootFile(packageMetadata.package.realm, packageMetadata.alias, packageMetadata.package)

		for (const dependencyPackageLink in packageMetadata.dependencies) {
			const packageData = map[dependencyPackageLink].package

			await createLuauDependencyFile(packageMetadata.package.realm, packageMetadata.dependencies[dependencyPackageLink].alias, packageData, packageMetadata.alias, packageMetadata.package)
		}
	}

	process.chdir(mainPath)

	debugLog(magenta(`Creating ${tempFileNames.projectJson} file ...`, true))
	createTempProjectJsonFile(map)

	var stdio

	if (!config.debug)
		stdio = "ignore"

	debugLog(magenta(`Creating ${tempFileNames.sourcemap} file ...`, true))
	execSync(`${config.sourcemapGenerator} sourcemap ${tempFileNames.projectJson} --output ${tempFileNames.sourcemap}`, { stdio: stdio })

	debugLog(magenta("Adding types to .luau files ...", true))

	try {
		if (existsSync(getPackageFolderPath("shared")))
			await addon.generate_types(tempFileNames.sourcemap, `${rootManifestConfig.sharedPackagesFolder}/`)
	} catch (err) { }

	try {
		if (existsSync(getPackageFolderPath("server")))
			await addon.generate_types(tempFileNames.sourcemap, `${rootManifestConfig.serverPackagesFolder}/`)
	} catch (err) { }

	try {
		if (existsSync(getPackageFolderPath("dev")))
			await addon.generate_types(tempFileNames.sourcemap, `${rootManifestConfig.devPackagesFolder}/`)
	} catch (err) { }

	debugLog(magenta(`Removing ${tempFileNames.projectJson} file ...`, true))
	await rimraf(tempFileNames.projectJson)

	debugLog(magenta(`Removing ${tempFileNames.sourcemap} file ...`, true))
	await rimraf(tempFileNames.sourcemap)
}

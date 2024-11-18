import { existsSync, writeFileSync } from "fs"
import { config, defaultFolderNames, mainPath, projectJsonName, sourcemapName } from "./configs/mainConfig"
import { rootManifestConfig } from "./configs/rootManifestConfig"
import { magenta, yellow } from "./output/colors"
import { debugLog } from "./output/output"
import { createProjectJsonFile } from "./createProjectJsonFile"
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
		const sharedPackages = rootManifestConfig.sharedPackages

		if (!sharedPackages) {
			console.error(yellow(`
			A server or dev dependency is depending on a shared dependency.
			To link these packages correctly you must declare where shared
			packages are placed in the roblox datamodel.

			This typically looks like:

			[place]
			shared-packages = "game.ReplicatedStorage.Packages"
			`).replace(/\t/g, ''))

			process.exit(1)
		}

		moduleData = `return require(${sharedPackages}.${defaultFolderNames.indexFolder}["${fullName}"]["${shortName}"])\n`
	} else if (packageData.realm == "server" && parentPackage.realm == "dev") {
		const serverPackages = rootManifestConfig.serverPackages

		if (!serverPackages) {
			console.error(yellow(`
			A dev dependency is depending on a server dependency.
			To link these packages correctly you must declare where server
			packages are placed in the roblox datamodel.

			This typically looks like:

			[place]
			server-packages = "game.ServerScriptService.Packages"
			`).replace(/\t/g, ''))

			process.exit(1)
		}

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

	debugLog(magenta("Creating project.json file ...", true))
	createProjectJsonFile(map)

	var stdio

	if (!config.debug)
		stdio = "ignore"

	debugLog(magenta("Creating sourcemap file ...", true))
	execSync(`${config.sourcemapGenerator} sourcemap ${projectJsonName} --output ${sourcemapName}`, { stdio: stdio })

	debugLog(magenta("Adding types to .luau files ...", true))

	try {
		if (existsSync(getPackageFolderPath("shared")))
			await addon.generate_types(sourcemapName, `${rootManifestConfig.sharedPackagesFolder}/`)
	} catch (err) { }

	try {
		if (existsSync(getPackageFolderPath("server")))
			await addon.generate_types(sourcemapName, `${rootManifestConfig.serverPackagesFolder}/`)
	} catch (err) { }

	try {
		if (existsSync(getPackageFolderPath("dev")))
			await addon.generate_types(sourcemapName, `${rootManifestConfig.devPackagesFolder}/`)
	} catch (err) { }

	debugLog(magenta("Removing project.json file ...", true))
	await rimraf(projectJsonName)

	debugLog(magenta("Removing sourcemap file ...", true))
	await rimraf(sourcemapName)
}

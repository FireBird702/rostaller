import { writeFileSync } from "fs"
import { getPackageFolderPath, manifestFileNames } from "./configs/mainConfig.js"
import { rootManifestConfig } from "./configs/rootManifestConfig.js"
import { yellow } from "./output/colors.js"

/**
 * @param {string} realm
 * @param {string} packageAlias
 * @param {any} packageData
 */
async function createLuauRootFile(realm, packageAlias, packageData) {
	const fullName = `${packageData.owner.toLowerCase()}_${packageData.name.toLowerCase()}@${packageData.version}`
	const shortName = packageData.name.toLowerCase()

	let moduleData = `return require(script.Parent._Index["${fullName}"]["${shortName}"])\n`
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
			packages are placed in the roblox datamodel
			(based on provided project.json file) in your ${manifestFileNames.githubManifest}.

			This typically looks like:

			[place]
			shared-packages = 'game:GetService("ReplicatedStorage").Packages'
			`).replace(/\t/g, ''))

			process.exit(1)
		}

		moduleData = `return require(${sharedPackages}._Index["${fullName}"]["${shortName}"])\n`
	} else if (packageData.realm == "server" && parentPackage.realm == "dev") {
		const serverPackages = rootManifestConfig.serverPackages

		if (!serverPackages) {
			console.error(yellow(`
			A dev dependency is depending on a server dependency.
			To link these packages correctly you must declare where server
			packages are placed in the roblox datamodel
			(based on provided project.json file) in your ${manifestFileNames.githubManifest}.

			This typically looks like:

			[place]
			server-packages = 'game:GetService("ServerScriptService").Packages'
			`).replace(/\t/g, ''))

			process.exit(1)
		}

		moduleData = `return require(${serverPackages}._Index["${fullName}"]["${shortName}"])\n`
	} else {
		throw yellow(`${parentPackageAlias} (${parentPackageFullName}) in "${parentPackage.realm}" realm cannot access ${packageAlias} (${fullName}) in "${packageData.realm}" realm`)
	}

	writeFileSync(`${getPackageFolderPath(realm)}/_Index/${parentPackageFullName}/${packageAlias}.luau`, moduleData)
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
}

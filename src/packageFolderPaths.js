import { defaultFolderNames, mainPath } from "./configs/mainConfig.js"
import { rootManifestConfig } from "./configs/rootManifestConfig.js"

/**
 * @param { "shared" | "server" | "dev"| "root" } environment
 * @param { boolean? } useWallyFolderStructure
 */
export function get(environment, useWallyFolderStructure) {
	let packagePath = mainPath

	if (environment == "root")
		packagePath += `/${defaultFolderNames.packagesRootFolder}`
	else if (environment == "shared")
		packagePath += (useWallyFolderStructure || rootManifestConfig.useWallyFolderStructure) && `/${defaultFolderNames.wallySharedPackagesFolder}` || `/${defaultFolderNames.sharedPackagesFolder}`
	else if (environment == "server")
		packagePath += (useWallyFolderStructure || rootManifestConfig.useWallyFolderStructure) && `/${defaultFolderNames.wallyServerPackagesFolder}` || `/${defaultFolderNames.serverPackagesFolder}`
	else if (environment == "dev")
		packagePath += (useWallyFolderStructure || rootManifestConfig.useWallyFolderStructure) && `/${defaultFolderNames.wallyDevPackagesFolder}` || `/${defaultFolderNames.devPackagesFolder}`
	else
		throw `Unknown environment: ${environment}`

	return packagePath
}

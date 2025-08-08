import { defaultFolderNames, mainPath } from "./configs/mainConfig.js"

/**
 * @param { "shared" | "server" | "dev"| "root" } environment
 */
export function get(environment) {
	let packagePath = mainPath

	if (environment == "root")
		packagePath += `/${defaultFolderNames.packagesRootFolder}`
	else if (environment == "shared")
		packagePath += `/${defaultFolderNames.sharedPackagesFolder}`
	else if (environment == "server")
		packagePath += `/${defaultFolderNames.serverPackagesFolder}`
	else if (environment == "dev")
		packagePath += `/${defaultFolderNames.devPackagesFolder}`
	else
		throw `Unknown environment: ${environment}`

	return packagePath
}

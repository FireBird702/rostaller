import { mainPath } from "./configs/mainConfig.js"
import { rootManifestConfig } from "./configs/rootManifestConfig.js"

/**
 * @param { "shared" | "server" | "dev" } environment
 */
export function get(environment) {
	let packagePath = mainPath

	if (environment == "shared")
		packagePath += `/${rootManifestConfig.sharedPackagesFolder}`
	else if (environment == "server")
		packagePath += `/${rootManifestConfig.serverPackagesFolder}`
	else if (environment == "dev")
		packagePath += `/${rootManifestConfig.devPackagesFolder}`
	else
		throw `Unknown environment: ${environment}`

	return packagePath
}

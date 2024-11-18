import { mainPath } from "./configs/mainConfig"
import { rootManifestConfig } from "./configs/rootManifestConfig"

export function getPackageFolderPath(realm) {
	var packagePath = mainPath

	if (realm == "shared")
		packagePath += `/${rootManifestConfig.sharedPackagesFolder}`
	else if (realm == "server")
		packagePath += `/${rootManifestConfig.serverPackagesFolder}`
	else if (realm == "dev")
		packagePath += `/${rootManifestConfig.devPackagesFolder}`
	else
		throw `Unknown realm: ${realm}`

	return packagePath
}

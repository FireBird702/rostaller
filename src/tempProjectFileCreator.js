import { writeFileSync } from "fs"
import { tempFileNames } from "./configs/mainConfig"
import { rootManifestConfig } from "./configs/rootManifestConfig"

function createJsonPath(fileData, packagesPathString, packagesFolder) {
	const pathElements = packagesPathString.split(".")

	var path = fileData.tree

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

export function createTempProjectJsonFile(map) {
	var packageTypes = {
		sharedPackages: false,
		serverPackages: false,
		devPackages: false
	}

	for (const key in map) {
		const packageData = map[key]

		const realm = packageData.package.realm

		if (realm == "shared")
			packageTypes.sharedPackages = true
		else if (realm == "server")
			packageTypes.serverPackages = true
		else if (realm == "dev")
			packageTypes.devPackages = true

		if (packageTypes.sharedPackages && packageTypes.serverPackages && packageTypes.devPackages)
			break
	}

	var fileData = {
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

import { writeFileSync } from "fs"
import { projectJsonName } from "./configs/mainConfig.js"
import { rootManifestConfig } from "./configs/rootManifestConfig.js"

export function createProjectJsonFile(map) {
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

	if (packageTypes.sharedPackages) {
		if (!fileData.tree.ReplicatedStorage)
			fileData.tree.ReplicatedStorage = {}

		fileData.tree.ReplicatedStorage.Packages = {
			$path: rootManifestConfig.PackagesFolder
		}
	}

	if (packageTypes.serverPackages) {
		if (!fileData.tree.ServerScriptService)
			fileData.tree.ServerScriptService = {}

		fileData.tree.ServerScriptService.ServerPackages = {
			$path: rootManifestConfig.ServerPackagesFolder
		}
	}

	if (packageTypes.devPackages) {
		if (!fileData.tree.ReplicatedStorage)
			fileData.tree.ReplicatedStorage = {}

		fileData.tree.ReplicatedStorage.DevPackages = {
			$path: rootManifestConfig.DevPackagesFolder
		}
	}

	writeFileSync(projectJsonName, JSON.stringify(fileData, null, "\t"))
}

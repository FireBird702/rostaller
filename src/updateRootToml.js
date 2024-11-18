import { existsSync, writeFileSync } from "fs"
import { mainPath, manifestFileNames } from "./configs/mainConfig"
import { getManifestData } from "./manifest"
import { clean } from "semver"
import toml from "@iarna/toml"
import { sortDictionaryByKey } from "./sortDictionaryByKey"

function isEmpty(x) {
	for (var _i in x) {
		return false
	}

	return true
}

export async function updateRootToml(map) {
	if (!existsSync(`${mainPath}/${manifestFileNames.rostallerManifest}`))
		throw `[${manifestFileNames.rostallerManifest}] does not exist`

	var rootManifestData = await getManifestData(`${mainPath}/${manifestFileNames.rostallerManifest}`, true)

	for (const dependency in map) {
		const alias = map[dependency].alias
		const packageData = map[dependency].package

		if (!alias)
			continue

		var dependencies

		if (packageData.realm == "dev")
			dependencies = rootManifestData["dev-dependencies"]
		else if (packageData.realmOverwrite == "shared")
			dependencies = rootManifestData["shared-dependencies-overwrite"]
		else if (packageData.realmOverwrite == "server")
			dependencies = rootManifestData["server-dependencies-overwrite"]
		else
			dependencies = rootManifestData["dependencies"]

		if (!dependencies[alias])
			continue
		if (packageData.type == "github-branch")
			continue

		const newVersion = packageData.version

		if (newVersion == "latest")
			continue

		const oldVersionString = dependencies[alias].split("@")[1]

		if (!oldVersionString)
			continue

		const oldVersion = clean(oldVersionString, { loose: true }) // ranges (>=1.0.0 < 2.0.0) will return null

		if (!oldVersion) {
			continue
		}
		if (oldVersion == newVersion)
			continue

		const newPackageLink = `${packageData.type}#${packageData.owner}/${packageData.name}@${newVersion}`
		dependencies[alias] = newPackageLink
	}

	for (const key in rootManifestData) {
		if (isEmpty(rootManifestData[key]))
			rootManifestData[key] = undefined
	}

	if (rootManifestData["dependencies"]) {
		rootManifestData["dependencies"] = sortDictionaryByKey(rootManifestData["dependencies"])
	}

	if (rootManifestData["dev-dependencies"]) {
		rootManifestData["dev-dependencies"] = sortDictionaryByKey(rootManifestData["dev-dependencies"])
	}

	if (rootManifestData["shared-dependencies-overwrite"]) {
		rootManifestData["shared-dependencies-overwrite"] = sortDictionaryByKey(rootManifestData["shared-dependencies-overwrite"])
	}

	if (rootManifestData["server-dependencies-overwrite"]) {
		rootManifestData["server-dependencies-overwrite"] = sortDictionaryByKey(rootManifestData["server-dependencies-overwrite"])
	}

	writeFileSync(`${mainPath}/${manifestFileNames.rostallerManifest}`, toml.stringify(rootManifestData))
}

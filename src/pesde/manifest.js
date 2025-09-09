import path from "path"
import { green } from "../output/colors.js"
import { debugLog } from "../output/output.js"
import { getPackageType } from "../universal/package.js"
import { getManifestData } from "../universal/manifest.js"
import { defaultIndexes } from "../configs/mainConfig.js"

/**
 * @param { import("../universal/manifest.js").manifest } manifest
 * @param { boolean? } isRoot
 * @returns { Promise<import("../download.js").unversalDependency[]> }
 */
export async function get(manifest, isRoot) {
	debugLog("Mapping", green(path.parse(process.cwd()).name))

	const manifestData = await getManifestData(manifest, isRoot)
	const registryIndexes = {
		wally: manifestData.wally_indices || {
			default: defaultIndexes.wally
		},
		pesde: manifestData.indices || {
			default: defaultIndexes.pesde
		}
	}

	let allDependencies = []

	/**
	 * @param { string } alias
	 * @param { import("../download.js").unversalDependency } dependency
	 * @param { ("shared" | "server" | "dev")? } environmentOverwrite
	 */
	function addDependency(alias, dependency, environmentOverwrite) {
		const validPackageTypesForRegistry = ["wally", "pesde"]
		let packageType = getPackageType(dependency)

		if (!packageType)
			packageType = "pesde"

		let registryIndex = dependency.index

		if (validPackageTypesForRegistry.includes(packageType)) {
			const registryType = dependency.index || "default"
			registryIndex = registryIndexes[packageType][registryType]
		}

		dependency.name = packageType != "pesde" && dependency[packageType].replace(/^.+\#/, "") || dependency["name"]
		dependency.alias = alias
		dependency.index = registryIndex
		dependency.type = packageType
		dependency.environmentOverwrite = environmentOverwrite

		allDependencies.push(dependency)
	}

	const dependencies = manifestData.dependencies

	if (dependencies) {
		for (const alias in dependencies) {
			addDependency(alias, dependencies[alias])
		}
	}

	const peerDependencies = manifestData.peer_dependencies

	if (peerDependencies) {
		for (const alias in peerDependencies) {
			addDependency(alias, peerDependencies[alias])
		}
	}

	if (isRoot) {
		const devDependencies = manifestData.dev_dependencies

		if (devDependencies) {
			for (const alias in devDependencies) {
				addDependency(alias, devDependencies[alias], "dev")
			}
		}
	}

	return allDependencies
}

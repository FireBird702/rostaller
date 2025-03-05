import path from "path"
import { green } from "../output/colors.js"
import { debugLog } from "../output/output.js"
import { getPackageType } from "../universal/package.js"
import { getManifestData } from "../universal/manifest.js"

/**
 * @param { manifest } manifest
 * @param { boolean? } isRoot
 * @returns { Promise<import("../download.js").unversalDependency[]> }
 */
export async function get(manifest, isRoot) {
    debugLog("Mapping", green(path.parse(process.cwd()).name))

    const manifestData = await getManifestData(manifest, isRoot)
    const registryIndexes = {
        wally: manifestData.wally_indexes || {
            default: "https://github.com/UpliftGames/wally-index"
        },
        pesde: manifestData.pesde_indexes || {
            default: "https://github.com/pesde-pkg/index"
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
        const packageType = getPackageType(dependency)

        let registryIndex = dependency.index

        if (validPackageTypesForRegistry.includes(packageType)) {
            const registryType = dependency.index || "default"
            registryIndex = registryIndexes[packageType][registryType]
        }

        dependency.name = dependency[packageType]
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

    const sharedDependenciesOverwrite = manifestData.shared_dependencies_overwrite

    if (sharedDependenciesOverwrite) {
        for (const alias in sharedDependenciesOverwrite) {
            addDependency(alias, sharedDependenciesOverwrite[alias], "shared")
        }
    }

    const serverDependenciesOverwrite = manifestData.server_dependencies_overwrite

    if (serverDependenciesOverwrite) {
        for (const alias in serverDependenciesOverwrite) {
            addDependency(alias, serverDependenciesOverwrite[alias], "server")
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

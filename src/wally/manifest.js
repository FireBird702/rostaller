import path from "path"
import { green } from "../output/colors.js"
import { debugLog } from "../output/output.js"
import { getManifestData } from "../universal/manifest.js"

/**
 * @param { manifest } manifest
 * @returns { Promise<import("../download.js").unversalDependency[]> }
 */
export async function get(manifest) {
    debugLog("Mapping", green(path.parse(process.cwd()).name))

    const manifestData = await getManifestData(manifest)

    let allDependencies = []

    /**
     * @param { string } alias
     * @param { string } dependency
     * @param { ("shared" | "server" | "dev")? } environmentOverwrite
     */
    function addDependency(alias, dependency, environmentOverwrite) {
        const name = dependency.split("@")[0]
        const version = dependency.split("@")[1]

        allDependencies.push({
            name: name,
            version: version,
            alias: alias,
            index: manifestData.package.registry,
            type: "wally",
            environmentOverwrite: environmentOverwrite
        })
    }

    const dependencies = manifestData["dependencies"]

    if (dependencies) {
        for (const alias in dependencies) {
            addDependency(alias, dependencies[alias])
        }
    }

    const serverDependencies = manifestData["server-dependencies"]

    if (serverDependencies) {
        for (const alias in serverDependencies) {
            addDependency(alias, serverDependencies[alias], "server")
        }
    }

    return allDependencies
}

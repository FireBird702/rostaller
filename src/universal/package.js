/**
 * @param { import("../download.js").unversalDependency } dependency
 * @returns { ("wally" | "pesde" | "github" | "github-rev")? }
 */
export function getPackageType(dependency) {
    let packageType

    if (dependency["wally"])
        packageType = "wally"
    else if (dependency["pesde"])
        packageType = "pesde"
    else if (dependency["github"])
        packageType = "github"
    else if (dependency["github-rev"])
        packageType = "github-rev"

    return packageType
}

/**
 * @param { import("../download.js").unversalDependency } dependency
 * @returns { { type: string, scope: string, name: string, version: string?, rev: string?, index: string? } }
 */
export function packageEntryFromDependency(dependency) {
    const scope_name = dependency.name.split("/")

    let packageEntry = {
        type: dependency.type,
        scope: scope_name[0],
        name: scope_name[1],
        version: dependency.version,
        rev: dependency.rev,
        index: dependency.index
    }

    if (dependency.type == "github" && !packageEntry.version)
        packageEntry.version = "latest"

    return packageEntry
}

/**
 * @param { * } packageData
 * @param { { rev: string?, version: string?, ignoreType: boolean? }? } overwrites
 * @returns { string }
 */
export function getFullPackageName(packageData, overwrites) {
    let packageString = ""

    if (!overwrites || !overwrites.ignoreType)
        packageString += `${packageData.type}#`

    if (packageData.type == "github-rev")
        packageString += `${packageData.scope}/${packageData.name}@${(overwrites && overwrites.rev) || packageData.rev}`
    else
        packageString += `${packageData.scope}/${packageData.name}@${(overwrites && overwrites.version) || packageData.version}`

    return packageString
}

import { existsSync, writeFileSync } from "fs"
import { mainPath, manifestFileNames } from "./configs/mainConfig.js"
import { getManifestData } from "./universal/manifest.js"
import * as semver from "semver"
import { debugLog } from "./output/output.js"
import { magenta } from "./output/colors.js"

/**
 * @param { object } x
 */
function isEmpty(x) {
	for (const _ in x) {
		return false
	}

	return true
}

/**
 * Recursively create TOML strings with inline tables and space between top-level keys
 * @param { object } data
 */
function stringifyInlineTables(data) {
	let tomlString = ""

	// loop through each top-level key in data and convert to TOML
	for (const key in data) {
		if (typeof data[key] == "undefined")
			continue

		let value = data[key]

		// add space between top-level sections (keys)
		if (tomlString !== "") {
			tomlString += "\n" // add a space between top-level sections
		}

		// if the value is an object (and not an array), we treat it as an inline table
		if (typeof value === "object" && !Array.isArray(value) && value !== null) {
			tomlString += `[${key}]\n` // start a new section for this object

			for (const subKey in value) {
				if (typeof value[subKey] == "undefined")
					continue

				if (typeof value[subKey] === "object" && !Array.isArray(value[subKey])) {
					// inline table
					tomlString += `${subKey} = { `

					const subObject = value[subKey]

					for (const prop in subObject) {
						if (typeof subObject[prop] == "undefined")
							continue

						tomlString += `${prop} = "${subObject[prop]}", `
					}

					tomlString = tomlString.slice(0, -2) // remove the trailing comma and space
					tomlString += " }\n"  // end the inline table for this subKey
				} else if (typeof value[subKey] === "object" && Array.isArray(value[subKey])) {
					// regular array
					tomlString += `${subKey} = [`

					const subObject = value[subKey]

					for (const prop in subObject) {
						if (typeof subObject[prop] == "undefined")
							continue

						tomlString += `"${subObject[prop]}", `
					}

					tomlString = tomlString.slice(0, -2) // remove the trailing comma and space
					tomlString += "]\n"  // end the array for this subKey
				} else {
					tomlString += `${subKey} = "${value[subKey]}"\n` // regular key-value pair
				}
			}
		} else {
			// for simple values, just output them directly
			tomlString += `${key} = "${value}"\n`
		}
	}

	return tomlString
}

function sortDictionaryByKey(dependencies) {
	let items = Object.keys(dependencies).map(function (key) {
		return [key, dependencies[key]]
	})

	// sort the array based on the first element
	items.sort(function (first, second) {
		return ("" + first[0]).localeCompare(second[0])
	})

	let newDependencies = {}

	items.forEach((value) => {
		newDependencies[value[0]] = value[1]
	})

	return newDependencies
}

export async function updateRootToml(map) {
	if (!existsSync(`${mainPath}/${manifestFileNames.rostallerManifest}`))
		throw `[${manifestFileNames.rostallerManifest}] does not exist`

	debugLog(magenta(`Updating root ${manifestFileNames.rostallerManifest} file ...`, true))

	const manifest = {
		type: manifestFileNames.rostallerManifest,
		path: `${mainPath}/${manifestFileNames.rostallerManifest}`
	}

	let rootManifestData = await getManifestData(manifest, true)

	for (const dependency in map) {
		const alias = map[dependency].alias
		const packageData = map[dependency].package

		if (!alias)
			continue

		let dependencies

		if (packageData.environment == "dev")
			dependencies = rootManifestData.dev_dependencies
		else if (packageData.environmentOverwrite == "shared")
			dependencies = rootManifestData.shared_dependencies_overwrite
		else if (packageData.environmentOverwrite == "server")
			dependencies = rootManifestData.server_dependencies_overwrite
		else
			dependencies = rootManifestData.dependencies

		if (!dependencies[alias])
			continue
		if (packageData.type == "github-rev")
			continue

		const newVersion = packageData.version

		if (newVersion == "latest")
			continue

		const oldVersionString = dependencies[alias].version

		if (!oldVersionString)
			continue

		const oldVersion = semver.clean(oldVersionString, { loose: true }) // ranges (>=1.0.0 < 2.0.0) will return null

		if (!oldVersion) {
			continue
		}
		if (oldVersion == newVersion)
			continue

		dependencies[alias].version = newVersion
	}

	for (const key in rootManifestData) {
		if (isEmpty(rootManifestData[key]))
			rootManifestData[key] = undefined
	}

	if (rootManifestData.dependencies) {
		rootManifestData.dependencies = sortDictionaryByKey(rootManifestData.dependencies)
	}

	if (rootManifestData.dev_dependencies) {
		rootManifestData.dev_dependencies = sortDictionaryByKey(rootManifestData.dev_dependencies)
	}

	if (rootManifestData.shared_dependencies_overwrite) {
		rootManifestData.shared_dependencies_overwrite = sortDictionaryByKey(rootManifestData.shared_dependencies_overwrite)
	}

	if (rootManifestData.server_dependencies_overwrite) {
		rootManifestData.server_dependencies_overwrite = sortDictionaryByKey(rootManifestData.server_dependencies_overwrite)
	}

	writeFileSync(`${mainPath}/${manifestFileNames.rostallerManifest}`, stringifyInlineTables(rootManifestData))
}

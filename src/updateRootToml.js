import { existsSync, writeFileSync } from "fs"
import { getManifestData, getRootManifest } from "./universal/manifest.js"
import * as semver from "semver"
import { debugLog } from "./output/output.js"
import { magenta } from "./output/colors.js"
import { isEmpty } from "./isEmpty.js"
import { manifestFileNames } from "./configs/mainConfig.js"

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

/**
 * @param { * } map
 * @returns
 */
async function standard(map) {
	const manifest = getRootManifest()

	debugLog(magenta(`Updating ${manifest.type} file ...`, true))

	let rootManifestData = await getManifestData(manifest, true)

	if (manifest.type == manifestFileNames.rostallerManifest) {
		for (const dependency in map) {
			if (!map[dependency].isMainDependency)
				continue

			const alias = map[dependency].alias

			if (!alias)
				continue

			const packageData = map[dependency].package

			if (packageData.type == "github-rev")
				continue

			const newVersion = packageData.version

			if (newVersion == "latest")
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

			const oldVersionString = dependencies[alias].version

			if (!oldVersionString)
				continue

			const oldVersion = semver.clean(oldVersionString, { loose: true }) // ranges (>=1.0.0 < 2.0.0) will return null

			if (!oldVersion || oldVersion == newVersion)
				continue

			dependencies[alias].version = newVersion
		}
	} else if (manifest.type == manifestFileNames.wallyManifest) {
		for (const dependency in map) {
			if (!map[dependency].isMainDependency)
				continue

			const alias = map[dependency].alias

			if (!alias)
				continue

			const packageData = map[dependency].package

			if (packageData.type == "github-rev")
				continue

			const newVersion = packageData.version

			if (newVersion == "latest")
				continue

			let dependencies

			if (packageData.environment == "dev")
				dependencies = rootManifestData["dev-dependencies"]
			else if (packageData.environmentOverwrite == "server")
				dependencies = rootManifestData["server-dependencies"]
			else
				dependencies = rootManifestData["dependencies"]

			if (!dependencies[alias])
				continue

			const oldVersionString = dependencies[alias].split("@")[1]

			if (!oldVersionString)
				continue

			const oldVersion = semver.clean(oldVersionString, { loose: true }) // ranges (>=1.0.0 < 2.0.0) will return null

			if (!oldVersion || oldVersion == newVersion)
				continue

			dependencies[alias] = `${packageData.scope}/${packageData.name}@${newVersion}`
		}
	}

	return rootManifestData
}

/**
 * @param { * } map
 * @returns
 */
function migrate(map) {
	const rostallerManifest = getRootManifest(true)
	const manifest = getRootManifest()

	console.log(`Migrating [${manifest.type}] file to [${rostallerManifest.type}]`)

	let rootManifestData = {}

	for (const dependency in map) {
		if (!map[dependency].isMainDependency)
			continue

		const alias = map[dependency].alias

		if (!alias)
			continue

		const packageData = map[dependency].package

		let dependencies

		if (packageData.environment == "dev") {
			if (!rootManifestData.dev_dependencies)
				rootManifestData.dev_dependencies = {}

			dependencies = rootManifestData.dev_dependencies
		} else if (packageData.environmentOverwrite == "shared") {
			if (!rootManifestData.shared_dependencies_overwrite)
				rootManifestData.shared_dependencies_overwrite = {}

			dependencies = rootManifestData.shared_dependencies_overwrite
		} else if (packageData.environmentOverwrite == "server") {
			if (!rootManifestData.server_dependencies_overwrite)
				rootManifestData.server_dependencies_overwrite = {}

			dependencies = rootManifestData.server_dependencies_overwrite
		} else {
			if (!rootManifestData.dependencies)
				rootManifestData.dependencies = {}

			dependencies = rootManifestData.dependencies
		}

		dependencies[alias] = {
			[packageData.type]: `${packageData.scope}/${packageData.name}`,
			version: packageData.version,
			rev: packageData.rev,
		}
	}

	return rootManifestData
}

/**
 * @param { * } map
 * @param { boolean? } isMigrating
 */
export async function updateRootToml(map, isMigrating) {
	const rostallerManifest = getRootManifest(true)
	const manifest = getRootManifest()

	let isMigrated = false
	let rootManifestData = {}

	if (isMigrating && manifest.type != rostallerManifest.type) {
		rootManifestData = migrate(map)
		isMigrated = true
	} else {
		if (manifest.type == manifestFileNames.pesdeManifest) // pesde not supported
			return

		if (!existsSync(manifest.path))
			return

		rootManifestData = await standard(map)
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

	// wally support
	if (rootManifestData["server-dependencies"]) {
		rootManifestData["server-dependencies"] = sortDictionaryByKey(rootManifestData["server-dependencies"])
	}

	if (rootManifestData["dev-dependencies"]) {
		rootManifestData["dev-dependencies"] = sortDictionaryByKey(rootManifestData["dev-dependencies"])
	}

	writeFileSync(isMigrated && rostallerManifest.path || manifest.path, stringifyInlineTables(rootManifestData))
}

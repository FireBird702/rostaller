import { writeFileSync } from "fs"
import { defaultProjectJsonName } from "./configs/mainConfig.js"

/**
 * `default.project.json` file generator for `github`, `github-rev` and `pesde` packages
 * @param { string } path
 * @param { string[] } files
 */
export function generate(path, files) {
	let syncConfigTree = {}

	for (const file of files) {
		// Remove the `.lua` or `.luau` file extension from the file name
		const name = file.replace(/.luau?$/, "")

		if (name == "init") {
			syncConfigTree["$path"] = name
			continue
		}

		syncConfigTree[name] = {
			["$path"]: file,
		}
	}

	// If there isn't a top level path, we mark the entire thing as a Folder
	if (!syncConfigTree["$path"])
		syncConfigTree["$className"] = "Folder"

	// If the config tree does not include pesde's downloaded roblox dependencies
	// directory, we add it as an optional one for the future, once dependencies
	// are installed
	if (!syncConfigTree["roblox_packages"])
		syncConfigTree["roblox_packages"] = {
			["$path"]: {
				optional: "roblox_packages",
			},
		}

	// If the config tree does not include pesde's downloaded roblox server dependencies
	// directory, we add it as an optional one for the future, once server dependencies
	// are installed
	if (!syncConfigTree["roblox_server_packages"])
		syncConfigTree["roblox_server_packages"] = {
			["$path"]: {
				optional: "roblox_server_packages",
			},
		}

	// Finally, we serialize the config to a JSON string and write it
	// to the sync config path
	const serializedConfig = JSON.stringify({ tree: syncConfigTree }, null, "\t")
	writeFileSync(`${path}/${defaultProjectJsonName}`, serializedConfig)
}

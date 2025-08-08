import { manifestFileNames } from "../configs/mainConfig.js"
import { yellow } from "../output/colors.js"
import { fileError } from "../output/output.js"
import { validate as validateRostallerRootPackage } from "./rootPackage/rostaller.js"
import { validate as validateWallyRootPackage } from "./rootPackage/wally.js"
import { validate as validatePesdeRootPackage } from "./rootPackage/pesde.js"
import toml from "@iarna/toml"

/**
 *
 * @param { string? } type
 * @param { string } localPath
 * @param { string } fileRead
 * @returns { object | undefined }
 */
export function validateJson(type, localPath, fileRead) {
	let jsonData

	try {
		jsonData = JSON.parse(fileRead)
	} catch (err) {
		console.error(fileError(localPath), yellow("Malformed JSON:"), yellow(err))
	}

	switch (type) {
		case "Project":
			return jsonData
		default:
			return jsonData
	}
}

/**
 *
 * @param { string } localPath
 * @param { string } fileRead
 * @param { { rootType: string }? } rootPackage
 * @returns { object | undefined }
 */
export function validateToml(localPath, fileRead, rootPackage) {
	let tomlData

	try {
		tomlData = toml.parse(fileRead)
	} catch (err) {
		console.error(fileError(localPath), yellow("Malformed TOML:"), yellow(err))
	}

	if (rootPackage) {
		if (rootPackage.rootType == manifestFileNames.rostallerManifest)
			return validateRostallerRootPackage(tomlData)
		else if (rootPackage.rootType == manifestFileNames.wallyManifest)
			return validateWallyRootPackage(tomlData)
		else if (rootPackage.rootType == manifestFileNames.pesdeManifest)
			return validatePesdeRootPackage(tomlData)
		else
			console.error(`[${rootPackage.rootType}] is not a valid manifest type`)
	}

	return tomlData
}

import { yellow } from "../output/colors.js"
import { fileError } from "../output/output.js"
import { validate as validateRootPackage } from "./rootPackage.js"
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
 * @param { boolean? } isRootPackage
 * @returns { object | undefined }
 */
export function validateToml(localPath, fileRead, isRootPackage) {
	let tomlData

	try {
		tomlData = toml.parse(fileRead)
	} catch (err) {
		console.error(fileError(localPath), yellow("Malformed TOML:"), yellow(err))
	}

	if (isRootPackage)
		return validateRootPackage(tomlData)

	return tomlData
}

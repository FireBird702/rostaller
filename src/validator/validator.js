import { yellow } from "../output/colors"
import { fileError } from "../output/output"
import { validate as validateRootPackage } from "./rootPackage"
import { validate as validatePackage } from "./package"
import toml from "@iarna/toml"

/**
 * @param {string?} type
 * @param {string} localPath
 * @param {string} fileRead
 * @returns {Object | undefined}
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
 * @param {string?} type
 * @param {string} localPath
 * @param {string} fileRead
 * @returns {Object | undefined}
 */
export function validateToml(type, localPath, fileRead) {
	let tomlData

	try {
		tomlData = toml.parse(fileRead)
	} catch (err) {
		console.error(fileError(localPath), yellow("Malformed TOML:"), yellow(err))
	}

	switch (type) {
		case "RootPackage":
			return validateRootPackage(tomlData)
		case "SubPackage":
			return validatePackage(tomlData)
		default:
			return tomlData
	}
}

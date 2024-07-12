import { parse } from "toml"
import { yellow } from "../output/colors.js"
import { fileError } from "../output/output.js"
import { validate as validateRootPackage } from "./rootPackage.js"
import { validate as validatePackage } from "./package.js"

/**
 * @param {string?} type
 * @param {string} localPath
 * @param {string} fileRead
 * @returns {Object | undefined}
 */
export function validateJson(type, localPath, fileRead) {
	let json;

	try {
		json = JSON.parse(fileRead)
	} catch (err) {
		console.error(fileError(localPath), yellow("Malformed JSON:"), yellow(err))
	}

	switch (type) {
		case "Project":
			return json
		default:
			return json
	}
}

/**
 * @param {string?} type
 * @param {string} localPath
 * @param {string} fileRead
 * @returns {Object | undefined}
 */
export function validateToml(type, localPath, fileRead) {
	let toml;

	try {
		toml = parse(fileRead)
	} catch (err) {
		console.error(fileError(localPath), yellow("Malformed TOML:"), yellow(err))
	}

	switch (type) {
		case "RootPackage":
			return validateRootPackage(toml)
		case "SubPackage":
			return validatePackage(toml)
		default:
			return toml
	}
}

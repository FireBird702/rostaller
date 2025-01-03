import { config } from "../configs/mainConfig"
import { yellow, red, green } from "./colors"

const drop = "\n └──"
const drop2 = "\n └─┬"
const drop3 = "\n   └──"

/**
 * @param {Object} from
 * @param {Object} to
 * @param {string?} append
 * @returns {string}
 */
function iterRelative(from, to, append) {
	if (from == to) {
		return append
	}
	for (const key in from) {
		const value = from[key]
		if (typeof value == "object") {
			if (value == to) {
				return key
			} else {
				const next = iterRelative(value, to)
				if (next != "") {
					return key + "\\" + next + (append && ("\\" + append) || "")
				}
			}
		}
	}
	return ""
}

/**
 * @param {string} s
 * @returns {string}
 */
export function fileError(s) {
	if (process.platform == "win32") {
		return red("[" + s.replace(/\//g, "\\") + "]") + yellow(drop)
	} else {
		return red("[" + s.replace(/\\/g, "/") + "]") + yellow(drop)
	}
}

/**
 * @param {string} s
 * @param {Object} from
 * @param {Object} to
 * @param {string?} key
 * @returns {string}
 */
export function jsonError(s, from, to, key) {
	if (process.platform == "win32") {
		return red("[" + s.replace(/\//g, "\\") + "]") + yellow(drop2) + " " + green(iterRelative(from, to, key)) + yellow(drop3)
	} else {
		return red("[" + s.replace(/\\/g, "/") + "]") + yellow(drop2) + " " + green(iterRelative(from, to, key)) + yellow(drop3)
	}
}

export function debugLog(message, ...optionalParams) {
	if (!config.debug)
		return

	console.log(message, ...optionalParams)
}

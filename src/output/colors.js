const colors = {
	reset: "\x1b[0m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	green: "\x1b[32m",
	cyan: "\x1b[36m",
	magenta: "\x1b[35m",
}

/**
 * @param { string } s
 * @returns { string }
 */
export function red(s) {
	return colors.red + s + colors.reset
}

/**
 * @param { string } s
 * @returns { string }
 */
export function yellow(s) {
	return colors.yellow + s + colors.reset
}

/**
 * @param { string } s
 * @param { boolean? } hideQuotes
 * @returns { string }
 */
export function green(s, hideQuotes) {
	return hideQuotes && (colors.green + s + colors.reset) || (`${colors.green}"${s}"${colors.reset}`)
}

/**
 * @param { string } s
 * @param { boolean? } hideQuotes
 * @returns { string }
 */
export function magenta(s, hideQuotes) {
	return hideQuotes && (colors.magenta + s + colors.reset) || (`${colors.magenta}"${s}"${colors.reset}`)
}

/**
 * @param { string } s
 * @param { boolean? } hideBrackets
 * @returns { string }
 */
export function cyan(s, hideBrackets) {
	if (process.platform == "win32") {
		return hideBrackets && (colors.cyan + s.replace(/\//g, "\\") + colors.reset) || (colors.cyan + "[" + s.replace(/\//g, "\\") + "]" + colors.reset)
	} else {
		return hideBrackets && (colors.cyan + s.replace(/\\/g, "/") + colors.reset) || (colors.cyan + "[" + s.replace(/\\/g, "/") + "]" + colors.reset)
	}
}

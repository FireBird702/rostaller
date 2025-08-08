import { yellow } from "../../output/colors.js"

/**
 * @param { object } dependency
 * @returns { boolean } isValid
 */
function isValidDependency(dependency) {
	if (typeof dependency != "string") {
		console.error(yellow(dependency + " dependency must be a string"))
		return false
	}

	return true
}

/**
 * @param { object } manifestData
 * @returns { boolean } `false` if valid, `true` if invalid
 */
function scan(manifestData) {
	if (manifestData["dependencies"]) {
		for (const dependency in manifestData["dependencies"])
			if (!isValidDependency(manifestData["dependencies"][dependency]))
				return true
	}

	if (manifestData["server-dependencies"]) {
		for (const dependency in manifestData["server-dependencies"])
			if (!isValidDependency(manifestData["server-dependencies"][dependency]))
				return true
	}

	if (manifestData["dev-dependencies"]) {
		for (const dependency in manifestData["dev-dependencies"])
			if (!isValidDependency(manifestData["dev-dependencies"][dependency]))
				return true
	}

	return false
}

/**
 * @param { object } manifestData
 * @returns { object | undefined }
 */
export function validate(manifestData) {
	let failed = false

	const scanFailed = scan(manifestData)
	failed = failed || scanFailed

	if (failed)
		return

	return manifestData
}

import { yellow } from "../../output/colors.js"

/**
 * @param { object } dependency
 * @returns { boolean } isValid
 */
function isValidDependency(dependency) {
	if (typeof dependency != "object") {
		console.error(yellow(dependency + " dependency must be a table"))
		return false
	}

	return true
}

/**
 * @param { object } manifestData
 * @returns { boolean } `false` if valid, `true` if invalid
 */
function scan(manifestData) {
	if (manifestData.dependencies) {
		for (const dependency in manifestData.dependencies)
			if (!isValidDependency(manifestData.dependencies[dependency]))
				return true
	}

	if (manifestData.peer_dependencies) {
		for (const dependency in manifestData.peer_dependencies)
			if (!isValidDependency(manifestData.peer_dependencies[dependency]))
				return true
	}

	if (manifestData.dev_dependencies) {
		for (const dependency in manifestData.dev_dependencies)
			if (!isValidDependency(manifestData.dev_dependencies[dependency]))
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

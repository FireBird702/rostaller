import { yellow } from "../output/colors"

/**
 * @param {Object} manifestData
 * @returns {boolean}
 */
function scan(manifestData) {
	let failed = false

	if (!manifestData.package)
		failed = true

	if (manifestData.dependencies) {
		for (const dependency in manifestData.dependencies) {
			if (typeof manifestData.dependencies[dependency] != "string") {
				console.error(yellow(dependency + " dependency must be a string"))
				failed = true
				break
			}
		}
	}

	if (manifestData["shared-dependencies-overwrite"]) {
		for (const dependency in manifestData["shared-dependencies-overwrite"]) {
			if (typeof manifestData["shared-dependencies-overwrite"][dependency] != "string") {
				console.error(yellow(dependency + " dependency must be a string"))
				failed = true
				break
			}
		}
	}

	if (manifestData["server-dependencies-overwrite"]) {
		for (const dependency in manifestData["server-dependencies-overwrite"]) {
			if (typeof manifestData["server-dependencies-overwrite"][dependency] != "string") {
				console.error(yellow(dependency + " dependency must be a string"))
				failed = true
				break
			}
		}
	}

	if (manifestData["dev-dependencies"]) {
		for (const dependency in manifestData["dev-dependencies"]) {
			if (typeof manifestData["dev-dependencies"][dependency] != "string") {
				console.error(yellow(dependency + " dependency must be a string"))
				failed = true
				break
			}
		}
	}

	return failed
}

/**
 * @param {Object} manifestData
 * @returns {Object | undefined}
 */
export function validate(manifestData) {
	let failed = false

	const scanFailed = scan(manifestData)
	failed = failed || scanFailed

	if (failed)
		return

	return manifestData
}

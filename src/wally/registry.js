import { auth, xGitHubApiVersion } from "../configs/mainConfig.js"
import { getAsync } from "../httpGet.js"
import { debugLog } from "../output/output.js"

let cachedRegistries = {}

/**
 * @param { string } registryIndex
 * @returns { Promise<{ api: string, fallback_registries: string[]? }> }
 */
export async function getRegistry(registryIndex) {
	if (!registryIndex)
		throw `Registry index is invalid: ${registryIndex}`

	const key = registryIndex

	if (cachedRegistries[key])
		return await cachedRegistries[key]

	const configFileName = "config.json"

	const registryLink = registryIndex.split("/")
	const scope = registryLink[registryLink.length - 2]
	const name = registryLink[registryLink.length - 1]

	const header = {
		Accept: "application/vnd.github+json",
		Authorization: auth.github != "" && "Bearer " + auth.github,
		["X-GitHub-Api-Version"]: xGitHubApiVersion
	}

	cachedRegistries[key] = new Promise(async (resolve, reject) => {
		debugLog(`Getting "${registryIndex}" info ...`)

		const response = await getAsync(`https://api.github.com/repos/${scope}/${name}/contents/${configFileName}`, header, "json")

		if (!response || !response.download_url)
			reject("Failed to get wally registry config file")

		const file = await getAsync(response.download_url, header)

		if (!file)
			reject("Failed to download wally registry config file")

		const registry = JSON.parse(file.toString())

		resolve(registry)
	}).catch((reason) => {
		throw `Failed to get "${registryIndex}" info: ${reason}`
	})

	return await cachedRegistries[key]
}

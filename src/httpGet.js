import followRedirects from "follow-redirects"
import PQueue from "p-queue"
import promiseRetry from "promise-retry"
import { config } from "./configs/mainConfig.js"

const queue = new PQueue({
	autoStart: true,
	concurrency: config.maxConcurrentDownloads
})

/**
 * @param { string } url
 * @param { * } headers
 * @param { "json"? } responseType
 * @returns { Promise<object | Buffer<ArrayBuffer>> }
 */

function get(url, headers, responseType) {
	const newHeaders = { "user-agent": "node.js" }

	for (const header in headers) {
		newHeaders[header] = headers[header]
	}

	return new Promise((resolve, reject) => {
		const request = followRedirects.https.get(url, {
			headers: newHeaders
		}, (response) => {
			let data = []

			response.on("data", (chunk) => {
				data.push(chunk)
			})

			response.on("end", () => {
				try {
					let buffer = Buffer.concat(data)

					switch (responseType) {
						case "json":
							resolve(JSON.parse(buffer.toString()))
							break
						default:
							resolve(buffer)
					}
				} catch (err) {
					reject(err)
				}
			})
		})

		request.on("error", (err) => {
			reject(err)
		})

		request.end()
	})
}

/**
 * @param { string } url
 * @param { * } headers
 * @param { "json"? } responseType
 * @returns
 */

export async function getAsync(url, headers, responseType) {
	return await queue.add(function () {
		return promiseRetry(async (retry) => {
			try {
				return await get(url, headers, responseType)
			} catch (err) {
				retry(err)
			}
		})
	})
}

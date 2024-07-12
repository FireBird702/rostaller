import followRedirects from "follow-redirects"

/**
 * @param {string} url
 * @param {OutgoingHttpHeaders} headers
 * @param {string} responseType
 * @returns {Promise}
 */
export async function getAsync(url, headers, responseType) {
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
						case "wally":
							resolve(buffer)
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

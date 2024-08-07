import { existsSync, writeFileSync } from "fs"
import { red, green, magenta, cyan } from "../output/colors.js"
import { mainPath, manifestFileNames } from "../configs/mainConfig.js"
import { debugLog } from "../output/output.js"

export async function init(args) {
	try {
		const fileData = `
		[package]
		realm = "shared"

		[dependencies]
		# shared

		# server
		`.replace(/\t/g, '').slice(1)

		const filePath = `${mainPath}/${manifestFileNames.githubManifest}`

		if (existsSync(filePath)) {
			console.log(`[${green("INFO", true)}] File ${cyan(manifestFileNames.githubManifest)} already exists in ${cyan(mainPath)}`)
			return
		}

		debugLog(magenta(`Creating ${manifestFileNames.githubManifest} file ...`, true))
		writeFileSync(filePath, fileData)

		console.log(`[${green("INFO", true)}] Created ${cyan(manifestFileNames.githubManifest)} file in ${cyan(mainPath)}`)
	} catch (err) {
		console.error(red(`Failed to create ${cyan(manifestFileNames.githubManifest)} file: ${err}`))
		process.exit(1)
	}
}

import { existsSync, writeFileSync } from "fs"
import { red, green, magenta, cyan, yellow } from "../output/colors.js"
import { mainPath, manifestFileNames } from "../configs/mainConfig.js"
import { debugLog } from "../output/output.js"

export async function init() {
	try {
		const fileData = `
		[package]
		realm = "shared"

		[dependencies]
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
		console.error(`${red(`Failed to create [${manifestFileNames.githubManifest}] file:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

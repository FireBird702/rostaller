import { existsSync, writeFileSync } from "fs"
import { red, green, magenta, cyan, yellow } from "../output/colors"
import { mainPath, manifestFileNames } from "../configs/mainConfig"
import { debugLog } from "../output/output"

export async function init() {
	try {
		const fileData = `
		[package]
		realm = "shared"

		[dependencies]

		[place]
		shared-packages = "game.ReplicatedStorage.Packages"
		server-packages = "game.ServerScriptService.ServerPackages"
		dev-packages = "game.ReplicatedStorage.DevPackages"
		`.replace(/\t/g, '').slice(1)

		const filePath = `${mainPath}/${manifestFileNames.rostallerManifest}`

		if (existsSync(filePath)) {
			console.log(`[${green("INFO", true)}] File ${cyan(manifestFileNames.rostallerManifest)} already exists in ${cyan(mainPath)}`)
			return
		}

		debugLog(magenta(`Creating ${manifestFileNames.rostallerManifest} file ...`, true))
		writeFileSync(filePath, fileData)

		console.log(`[${green("INFO", true)}] Created ${cyan(manifestFileNames.rostallerManifest)} file in ${cyan(mainPath)}`)
	} catch (err) {
		console.error(`${red(`Failed to create [${manifestFileNames.rostallerManifest}] file:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

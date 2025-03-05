import { existsSync, writeFileSync } from "fs"
import { red, green, magenta, cyan, yellow } from "../output/colors.js"
import { mainPath, manifestFileNames } from "../configs/mainConfig.js"
import { debugLog } from "../output/output.js"

export async function init() {
	try {
		const fileData = `
		[package]
		environment = "shared"
		lib = "src/init.luau"
		build_files = ["src"]

		[dependencies]

		[dev_dependencies]

		[place]
		shared_packages = "game.ReplicatedStorage.Packages"
		server_packages = "game.ServerScriptService.ServerPackages"
		dev_packages = "game.ReplicatedStorage.DevPackages"
		`.replace(/\t/g, "").slice(1)

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

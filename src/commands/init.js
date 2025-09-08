import { existsSync, writeFileSync } from "fs"
import { red, green, magenta, cyan, yellow } from "../output/colors.js"
import { mainPath } from "../configs/mainConfig.js"
import { debugLog } from "../output/output.js"
import { getRootManifest } from "../universal/manifest.js"
import { defaultRootManifestConfig } from "../configs/rootManifestConfig.js"

export async function init() {
	const manifest = getRootManifest(true)

	try {
		if (existsSync(manifest.path)) {
			console.log(`[${green("INFO", true)}] File ${cyan(manifest.type)} already exists in ${cyan(mainPath)}`)
			return
		}

		const fileData = `
		[package]
		environment = "shared"

		[dependencies]

		[dev_dependencies]

		[place]
		shared_packages = "${defaultRootManifestConfig.sharedPackages}"
		server_packages = "${defaultRootManifestConfig.serverPackages}"
		dev_packages = "${defaultRootManifestConfig.devPackages}"
		`.replace(/\t/g, "").slice(1)

		debugLog(magenta(`Creating ${manifest.type} file ...`, true))
		writeFileSync(manifest.path, fileData)

		console.log(`[${green("INFO", true)}] Created ${cyan(manifest.type)} file in ${cyan(mainPath)}`)
	} catch (err) {
		console.error(`${red(`Failed to create [${manifest.type}] file:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

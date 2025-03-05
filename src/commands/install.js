import { existsSync } from "fs"
import { red, green, magenta, yellow } from "../output/colors.js"
import { mainPath, downloadStats, manifestFileNames } from "../configs/mainConfig.js"
import { downloadManifestDependencies } from "../universal/manifest.js"
import { createLuauFiles } from "../luauFileCreator.js"
import { debugLog } from "../output/output.js"
import { generateLockFile } from "../lockFileCreator.js"
import { updateRootToml } from "../updateRootToml.js"
import * as packageFolderPaths from "../packageFolderPaths.js"
import { rimraf } from "rimraf"

export async function install() {
	try {
		const startTime = Date.now()

		if (!existsSync(`${mainPath}/${manifestFileNames.rostallerManifest}`))
			throw `[${manifestFileNames.rostallerManifest}] does not exist`

		debugLog(magenta("Clearing package directories ...", true))
		await rimraf(packageFolderPaths.get("shared")) // clear previous packages
		await rimraf(packageFolderPaths.get("server")) // clear previous packages
		await rimraf(packageFolderPaths.get("dev")) // clear previous packages
		console.log("Cleared package directories")

		let mapTree = {}

		debugLog(magenta("Downloading dependencies from manifest files ...", true))

		const manifest = {
			type: manifestFileNames.rostallerManifest,
			path: `${mainPath}/${manifestFileNames.rostallerManifest}`
		}

		await downloadManifestDependencies(manifest, mapTree, undefined, true)
		await createLuauFiles(mapTree)

		process.chdir(mainPath)

		await generateLockFile(mapTree)

		if (downloadStats.fail == 0) {
			await updateRootToml(mapTree)
		} else
			debugLog(magenta(`Some packages failed to update, root ${manifestFileNames.rostallerManifest} file will not be updated ...`, true))

		let finalMessage = `[${green("INFO", true)}] Downloaded ${downloadStats.success} packages`

		if (downloadStats.fail != 0)
			finalMessage += `, ${downloadStats.fail} failed`

		console.log(finalMessage)

		debugLog(magenta(`Time passed: ${(Date.now() - startTime) / 1000} seconds`, true))
	} catch (err) {
		console.error(`${red(`Failed to install packages:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

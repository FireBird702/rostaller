import { existsSync } from "fs"
import { red, green, magenta, yellow } from "../output/colors.js"
import { mainPath, downloadStats, lockFileName, manifestFileNames, getPackageFolderPath } from "../configs/mainConfig.js"
import { downloadManifestDependencies } from "../manifest.js"
import { createLuauFiles } from "../luauFileCreator.js"
import { debugLog } from "../output/output.js"
import { generateLockFile } from "../lockFileCreator.js"
import { rimraf } from "rimraf"
import { updateRootToml } from "../updateRootToml.js"

export async function install() {
	try {
		if (!existsSync(`${mainPath}/${manifestFileNames.rostallerManifest}`))
			throw `[${manifestFileNames.rostallerManifest}] does not exist`

		debugLog(magenta("Clearing package directories ...", true))
		await rimraf(getPackageFolderPath("shared")) // clear previous packages
		await rimraf(getPackageFolderPath("server")) // clear previous packages
		await rimraf(getPackageFolderPath("dev")) // clear previous packages
		console.log("Cleared package directories")

		var mapTree = {}

		debugLog(magenta("Downloading dependencies from manifest files ...", true))
		await downloadManifestDependencies(manifestFileNames.rostallerManifest, mapTree, undefined, true)

		debugLog(magenta("Creating .luau files ...", true))
		await createLuauFiles(mapTree)

		process.chdir(mainPath)

		debugLog(magenta(`Generating ${lockFileName} file ...`, true))
		await generateLockFile(mapTree)

		if (downloadStats.failed == 0) {
			debugLog(magenta(`Updating root ${manifestFileNames.rostallerManifest} file ...`, true))
			await updateRootToml(mapTree)
		} else
			debugLog(magenta(`Some packages failed to update, root ${manifestFileNames.rostallerManifest} file will not be updated ...`, true))

		console.log(`[${green("INFO", true)}] Downloaded ${downloadStats.success} packages, ${downloadStats.failed} failed!`)
	} catch (err) {
		console.error(`${red(`Failed to install packages:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

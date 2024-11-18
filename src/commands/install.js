import { existsSync } from "fs"
import { red, green, magenta, yellow } from "../output/colors"
import { mainPath, downloadStats, lockFileName, manifestFileNames } from "../configs/mainConfig"
import { downloadManifestDependencies } from "../manifest"
import { createLuauFiles } from "../luauFileCreator"
import { debugLog } from "../output/output"
import { generateLockFile } from "../lockFileCreator"
import { updateRootToml } from "../updateRootToml"
import { getPackageFolderPath } from "../packageFolderPath"
import { rimraf } from "rimraf"

export async function install() {
	try {
		const startTime = Date.now()

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

		if (downloadStats.fail == 0) {
			debugLog(magenta(`Updating root ${manifestFileNames.rostallerManifest} file ...`, true))
			await updateRootToml(mapTree)
		} else
			debugLog(magenta(`Some packages failed to update, root ${manifestFileNames.rostallerManifest} file will not be updated ...`, true))

		var finalMessage = `[${green("INFO", true)}] Downloaded ${downloadStats.success} packages`

		if (!downloadStats.fail == 0)
			finalMessage += `, ${downloadStats.fail} failed`

		console.log(finalMessage)

		debugLog(magenta(`Time passed: ${(Date.now() - startTime) / 1000} seconds`, true))
	} catch (err) {
		console.error(`${red(`Failed to install packages:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

import { existsSync } from "fs"
import { red, green, magenta, yellow } from "../output/colors.js"
import { mainPath, downloadStats, manifestFileNames } from "../configs/mainConfig.js"
import { downloadManifestDependencies, getRootManifest } from "../universal/manifest.js"
import { createLuauFiles } from "../luauFileCreator.js"
import { debugLog } from "../output/output.js"
import { generateLockFile } from "../lockFileCreator.js"
import { updateRootToml } from "../updateRootToml.js"
import * as packageFolderPaths from "../packageFolderPaths.js"
import { rimraf } from "rimraf"
import { updateAvailablePackages, updatedPackages } from "../universal/package.js"
import { showUpdates } from "../showUpdates.js"

/**
 * @param { boolean? } isMigrating
 */
export async function install(isMigrating) {
	try {
		const startTime = Date.now()
		const manifest = getRootManifest()

		if (!existsSync(manifest.path))
			throw `[${manifest.type}] does not exist`

		debugLog(magenta("Clearing package directories ...", true))

		await rimraf(packageFolderPaths.get("root"))

		// wally folder structure
		await rimraf(packageFolderPaths.get("shared", true))
		await rimraf(packageFolderPaths.get("server", true))
		await rimraf(packageFolderPaths.get("dev", true))

		console.log("Cleared package directories")

		let mapTree = {}

		debugLog(magenta("Downloading dependencies from manifest files ...", true))

		await downloadManifestDependencies(manifest, mapTree, undefined, true, isMigrating)
		await createLuauFiles(mapTree)

		process.chdir(mainPath)

		await generateLockFile(mapTree)

		if (downloadStats.fail == 0)
			await updateRootToml(mapTree, isMigrating)
		else
			debugLog(magenta(`Some packages failed to update, ${manifestFileNames.rostallerManifest} file will not be ${isMigrating && "created" || "updated"} ...`, true))

		let finalMessage = `[${green("INFO", true)}] Downloaded ${downloadStats.success} packages`

		if (downloadStats.fail != 0)
			finalMessage += `, ${downloadStats.fail} failed`

		console.log(finalMessage)

		showUpdates(`Updated packages:`, updatedPackages)
		showUpdates(`Available package updates:`, updateAvailablePackages)

		debugLog(magenta(`Time passed: ${(Date.now() - startTime) / 1000} seconds`, true))
	} catch (err) {
		console.error(`${red(`Failed to install packages:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

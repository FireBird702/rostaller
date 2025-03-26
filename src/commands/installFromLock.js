import { existsSync, readFileSync } from "fs"
import { red, green, magenta, yellow, cyan } from "../output/colors.js"
import { mainPath, downloadStats, lockFileName, manifestFileNames } from "../configs/mainConfig.js"
import { downloadLockDependencies } from "../universal/manifest.js"
import { createLuauFiles } from "../luauFileCreator.js"
import { debugLog } from "../output/output.js"
import { validateToml } from "../validator/validator.js"
import * as packageFolderPaths from "../packageFolderPaths.js"
import * as semver from "semver"
import { rimraf } from "rimraf"

export async function installFromLock() {
	try {
		const startTime = Date.now()

		if (!existsSync(`${mainPath}/${manifestFileNames.rostallerManifest}`))
			throw `[${manifestFileNames.rostallerManifest}] does not exist`

		debugLog(magenta(`Checking ${lockFileName} file ...`, true))

		const lockFilePath = `${mainPath}/${lockFileName}`

		if (!existsSync(lockFilePath)) {
			throw `Unable to locate [${lockFileName}] file`
		}

		console.log(`Checking ${cyan(lockFileName, true)} file`)
		const lockFileData = validateToml(lockFilePath, readFileSync(lockFilePath))

		debugLog(magenta("Clearing package directories ...", true))
		await rimraf(packageFolderPaths.get("shared")) // clear previous packages
		await rimraf(packageFolderPaths.get("server")) // clear previous packages
		await rimraf(packageFolderPaths.get("dev")) // clear previous packages
		console.log("Cleared package directories")

		let mapTree = {}

		await downloadLockDependencies(lockFileData, mapTree)

		/**
		 * Cleans version from leading/trailing whitespace, removes '=v' prefix
		 * @param { string } packageLink
		 * @returns
		 */
		function formatLockPackageLink(packageLink) {
			const type = packageLink.split("#")[0]

			if (type == "github-rev")
				return packageLink

			const version = packageLink.split("@")[1]
			return `${packageLink.split("@")[0]}@${semver.clean(version, { loose: true })}`
		}

		// add dependencies to downloaded packages
		for (const packageLink in lockFileData) {
			const formatedPackageLink = formatLockPackageLink(packageLink)

			if (!mapTree[formatedPackageLink])
				throw `Could not find ${formatedPackageLink} in downloaded packages`

			for (const dependencyPackageLink in lockFileData[packageLink].dependencies) {
				const dependency = lockFileData[packageLink].dependencies[dependencyPackageLink]
				const formatedLink = formatLockPackageLink(dependencyPackageLink)

				mapTree[formatedPackageLink].dependencies[formatedLink] = dependency
			}
		}

		await createLuauFiles(mapTree)

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

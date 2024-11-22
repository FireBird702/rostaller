import { existsSync, readFileSync } from "fs"
import { red, green, magenta, yellow } from "../output/colors"
import { mainPath, downloadStats, lockFileName, manifestFileNames } from "../configs/mainConfig"
import { downloadLockDependencies } from "../manifest"
import { createLuauFiles } from "../luauFileCreator"
import { debugLog } from "../output/output"
import { validateToml } from "../validator/validator"
import { getPackageFolderPath } from "../packageFolderPath"
import { clean } from "semver"
import { rimraf } from "rimraf"

export async function installFromLock() {
	try {
		if (!existsSync(`${mainPath}/${manifestFileNames.rostallerManifest}`))
			throw `[${manifestFileNames.rostallerManifest}] does not exist`

		debugLog(magenta(`Checking ${lockFileName} file ...`, true))
		const lockFilePath = `${mainPath}/${lockFileName}`

		if (!existsSync(lockFilePath)) {
			throw `Unable to locate [${lockFileName}] file`
		}

		const lockFileData = validateToml(undefined, lockFilePath, readFileSync(lockFilePath))

		debugLog(magenta("Clearing package directories ...", true))
		await rimraf(getPackageFolderPath("shared")) // clear previous packages
		await rimraf(getPackageFolderPath("server")) // clear previous packages
		await rimraf(getPackageFolderPath("dev")) // clear previous packages
		console.log("Cleared package directories")

		var mapTree = {}

		debugLog(magenta(`Downloading dependencies from ${lockFileName} file ...`, true))
		await downloadLockDependencies(lockFileData, mapTree)

		function formatLockPackageLink(packageLink) {
			const packageTypeSplit = packageLink.split("#")

			if (packageTypeSplit[0] == "github-branch") {
				return packageTypeSplit[1]
			}

			const packageLinkSplit = packageTypeSplit[1].split("@")

			if (packageLinkSplit[1] == undefined) {
				return packageTypeSplit[1]
			}

			const formatedPackageLink = `${packageLinkSplit[0]}@${clean(packageLinkSplit[1], { loose: true })}`
			return formatedPackageLink
		}

		for (const packageLink in lockFileData) {
			const formatedPackageLink = formatLockPackageLink(packageLink)

			for (const link in lockFileData[packageLink].dependencies) {
				const formatedLink = formatLockPackageLink(link)

				mapTree[formatedPackageLink].dependencies[formatedLink] = lockFileData[packageLink].dependencies[link]
			}
		}

		debugLog(magenta("Creating .luau files ...", true))
		await createLuauFiles(mapTree)

		var finalMessage = `[${green("INFO", true)}] Downloaded ${downloadStats.success} packages`

		if (!downloadStats.fail == 0)
			finalMessage += `, ${downloadStats.fail} failed`

		console.log(finalMessage)
	} catch (err) {
		console.error(`${red(`Failed to install packages:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

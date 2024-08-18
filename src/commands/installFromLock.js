import { existsSync, readFileSync } from "fs"
import { red, green, magenta, yellow } from "../output/colors.js"
import { config, mainPath, downloadStats, sourcemapName, lockFileName, manifestFileNames, getPackageFolderPath } from "../configs/mainConfig.js"
import { downloadLockDependencies } from "../manifest.js"
import { createLuauFiles } from "../luauFileCreator.js"
import { execSync } from "child_process"
import { rootManifestConfig } from "../configs/rootManifestConfig.js"
import { debugLog } from "../output/output.js"
import { validateJson } from "../validator/validator.js"
import { clean } from "semver"
import { rimraf } from "rimraf"

export async function installFromLock(args) {
	try {
		if (!existsSync(`${mainPath}/${manifestFileNames.githubManifest}`))
			throw `[${manifestFileNames.githubManifest}] does not exist`

		debugLog(magenta("Checking project.json file ...", true))
		const PROJECT_JSON = args["project-json"] && args["project-json"].replace(/\\/g, "/")

		if (!PROJECT_JSON) {
			throw `[project.json] is not specified`
		}
		if (!existsSync(`${mainPath}/${PROJECT_JSON}`)) {
			throw `[${PROJECT_JSON}] does not exist`
		}

		debugLog(magenta(`Checking ${lockFileName} file ...`, true))
		const lockFilePath = `${mainPath}/${lockFileName}`

		if (!existsSync(lockFilePath)) {
			throw `Unable to locate [${lockFileName}] file`
		}

		const lockFileData = validateJson(undefined, lockFilePath, readFileSync(lockFilePath))

		debugLog(magenta("Clearing package directories ...", true))
		await rimraf(getPackageFolderPath("shared")) // clear previous packages
		await rimraf(getPackageFolderPath("server")) // clear previous packages
		await rimraf(getPackageFolderPath("dev")) // clear previous packages
		console.log("Cleared package directories ...")

		var mapTree = {}
		var stdio

		if (!config.Debug)
			stdio = "ignore"

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

		process.chdir(mainPath) // you don't want to forget about this ;)

		debugLog(magenta("Creating sourcemap file ...", true))
		execSync(`${config.GenerateSourcemapTool} sourcemap ${PROJECT_JSON} --output ${sourcemapName}`, { stdio: stdio })

		if (!config.ManualWallyPackageTypesInstallation) {
			debugLog(magenta("Checking wally-package-types ...", true))
			var typesFixerInstalled = true

			try {
				execSync(`wally-package-types --version`, { stdio: "ignore" })
			} catch (err) {
				typesFixerInstalled = false
			}

			try {
				execSync("rokit trust JohnnyMorganz/wally-package-types", { stdio: (!typesFixerInstalled && "inherit") || stdio })
				execSync("rokit add --global JohnnyMorganz/wally-package-types", { stdio: (!typesFixerInstalled && "inherit") || stdio })
			} catch (err) { }

			execSync("rokit update --global JohnnyMorganz/wally-package-types", { stdio: (!typesFixerInstalled && "inherit") || stdio })
		}

		debugLog(magenta("Adding types to .luau files ...", true))

		try {
			if (existsSync(getPackageFolderPath("shared")))
				execSync(`wally-package-types --sourcemap ${sourcemapName} ${rootManifestConfig.PackagesFolder}/`, { stdio: stdio })
		} catch (err) { }

		try {
			if (existsSync(getPackageFolderPath("server")))
				execSync(`wally-package-types --sourcemap ${sourcemapName} ${rootManifestConfig.ServerPackagesFolder}/`, { stdio: stdio })
		} catch (err) { }

		try {
			if (existsSync(getPackageFolderPath("dev")))
				execSync(`wally-package-types --sourcemap ${sourcemapName} ${rootManifestConfig.DevPackagesFolder}/`, { stdio: stdio })
		} catch (err) { }

		debugLog(magenta("Removing sourcemap file ...", true))
		await rimraf(sourcemapName)

		console.log(`[${green("INFO", true)}] Downloaded ${downloadStats.success} packages, ${downloadStats.failed} failed!`)
	} catch (err) {
		console.error(`${red(`Failed to install packages:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

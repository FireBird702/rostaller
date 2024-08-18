import { existsSync } from "fs"
import { red, green, magenta, yellow } from "../output/colors.js"
import { config, mainPath, downloadStats, sourcemapName, lockFileName, manifestFileNames, getPackageFolderPath } from "../configs/mainConfig.js"
import { downloadManifestDependencies } from "../manifest.js"
import { createLuauFiles } from "../luauFileCreator.js"
import { execSync } from "child_process"
import { rootManifestConfig } from "../configs/rootManifestConfig.js"
import { debugLog } from "../output/output.js"
import { generateLockFile } from "../lockFileCreator.js"
import { rimraf } from "rimraf"
import { updateRootToml } from "../updateRootToml.js"

export async function install(args) {
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

		debugLog(magenta("Clearing package directories ...", true))
		await rimraf(getPackageFolderPath("shared")) // clear previous packages
		await rimraf(getPackageFolderPath("server")) // clear previous packages
		await rimraf(getPackageFolderPath("dev")) // clear previous packages
		console.log("Cleared package directories ...")

		var mapTree = {}
		var stdio

		if (!config.Debug)
			stdio = "ignore"

		debugLog(magenta("Downloading dependencies from manifest files ...", true))
		await downloadManifestDependencies(manifestFileNames.githubManifest, mapTree, undefined, true)

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

		debugLog(magenta(`Generating ${lockFileName} file ...`, true))
		await generateLockFile(mapTree)

		if (downloadStats.failed == 0) {
			debugLog(magenta(`Updating root ${manifestFileNames.githubManifest} file ...`, true))
			await updateRootToml(mapTree)
		} else
			debugLog(magenta(`Some packages failed to update, root ${manifestFileNames.githubManifest} file will not be updated ...`, true))

		console.log(`[${green("INFO", true)}] Downloaded ${downloadStats.success} packages, ${downloadStats.failed} failed!`)
	} catch (err) {
		console.error(`${red(`Failed to install packages:`)} ${yellow(err)}`)
		process.exit(1)
	}
}

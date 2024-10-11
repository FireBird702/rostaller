import { existsSync, readFileSync, writeFileSync } from "fs"
import { dirname, resolve } from "path"
import { red } from "../output/colors.js"
import { rootManifestConfig } from "./rootManifestConfig.js"

const INSTALL_DIR = dirname(process.execPath)
const CONFIG_PATH = resolve(INSTALL_DIR, "config.json")

const config = {
	Debug: false,
	MaxConcurrentDownloads: 10,

	GithubAccessToken: "",
	WallyAccessToken: "",

	GenerateSourcemapTool: "rojo",

	ManualWallyPackageTypesInstallation: false,
}

try {
	if (existsSync(CONFIG_PATH)) {
		const oldConfig = JSON.parse(readFileSync(CONFIG_PATH))

		for (const key in oldConfig) {
			if (key in config)
				config[key] = oldConfig[key]
		}
	}

	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, "\t"))
} catch (err) {
	console.error(red(err))
	process.exit(-1)
}

export const mainPath = process.cwd().replace(/\\/g, "/")

export const configPath = CONFIG_PATH

const _config = config
export { _config as config }

export const downloadStats = {
	failed: 0,
	success: 0
}

export const projectJsonName = ".rostaller-temp.project.json"
export const sourcemapName = ".rostallerSourcemap-temp.json"

export const lockFileName = "rostaller-lock.json"

export const manifestFileNames = {
	rostallerManifest: "rostaller.toml",
	wallyManifest: "wally.toml",
}

export const defaultProjectJsonName = "default.project.json"

function getPackagesFolderPath() {
	return mainPath + `/${rootManifestConfig.PackagesFolder}`
}
function getServerPackagesFolderPath() {
	return mainPath + `/${rootManifestConfig.ServerPackagesFolder}`
}
function getDevPackagesFolderPath() {
	return mainPath + `/${rootManifestConfig.DevPackagesFolder}`
}
export function getPackageFolderPath(realm) {
	var packagePath

	if (realm == "shared")
		packagePath = getPackagesFolderPath()
	else if (realm == "server")
		packagePath = getServerPackagesFolderPath()
	else if (realm == "dev")
		packagePath = getDevPackagesFolderPath()
	else
		throw `Unknown realm: ${realm}`

	return packagePath
}

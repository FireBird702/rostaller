import path from "path"
import os from "os"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { red } from "../output/colors.js"
import toml from "@iarna/toml"

export const xGitHubApiVersion = "2022-11-28"
export const wallyVersion = "0.3.2"

export const downloadStats = { fail: 0, success: 0 }

export const defaultProjectJsonName = "default.project.json"
export const lockFileName = "rostaller.lock"

export const manifestFileNames = {
	rostallerManifest: "rostaller.toml",
	wallyManifest: "wally.toml",
	pesdeManifest: "pesde.toml",
}

export const tempFileNames = {
	projectJson: ".temp-rostaller.project.json",
	sourcemap: ".temp-rostaller.sourcemap.json",
}

export const defaultFolderNames = {
	indexFolder: "_Index",

	sharedPackagesFolder: "Packages",
	serverPackagesFolder: "ServerPackages",
	devPackagesFolder: "DevPackages",
}

const configFileName = "config.toml"
const authFileName = "auth.toml"

const installDir = path.resolve(os.homedir(), ".rostaller")

export const configPath = path.resolve(installDir, configFileName)
export const authPath = path.resolve(installDir, authFileName)

export const mainPath = process.cwd().replace(/\\/g, "/")

export const config = {
	debug: false,
	maxConcurrentDownloads: 10,
	sourcemapGenerator: "rojo",
}

export const auth = {
	github: "",
	pesde: "",
	wally: ""
}

function reconcileAndSave(path, data) {
	if (existsSync(path)) {
		try {
			const savedData = toml.parse(readFileSync(path))

			for (const key in savedData) {
				if (key in data)
					data[key] = savedData[key]
			}
		} catch (err) { }
	}

	writeFileSync(path, toml.stringify(data))
}

try {
	mkdirSync(installDir, { recursive: true })

	reconcileAndSave(configPath, config)
	reconcileAndSave(authPath, auth)
} catch (err) {
	console.error(red(err))
	process.exit(-1)
}

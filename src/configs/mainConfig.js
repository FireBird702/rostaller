import path from "path"
import os from "os"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { red } from "../output/colors"
import toml from "@iarna/toml"

const installDir = path.resolve(os.homedir(), ".rostaller")

export const downloadStats = { fail: 0, success: 0 }

export const lockFileName = "rostaller.lock"

export const defaultProjectJsonName = "default.project.json"

export const manifestFileNames = {
	rostallerManifest: "rostaller.toml",
	wallyManifest: "wally.toml",
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

export const configPath = path.resolve(installDir, configFileName)
export const mainPath = process.cwd().replace(/\\/g, "/")

export const config = {
	auth: {
		githubAccessToken: "",
		wallyAccessToken: "",
	},

	debug: false,
	maxConcurrentDownloads: 10,
	sourcemapGenerator: "rojo",
}

try {
	mkdirSync(installDir, { recursive: true })

	if (existsSync(configPath)) {
		try {
			const savedConfig = toml.parse(readFileSync(configPath))

			for (const key in savedConfig) {
				if (key in config)
					config[key] = savedConfig[key]
			}
		} catch (err) { }
	}

	writeFileSync(configPath, toml.stringify(config))
} catch (err) {
	console.error(red(err))
	process.exit(-1)
}

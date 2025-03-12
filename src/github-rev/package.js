import path from "path"
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "fs"
import { red, yellow, green, cyan } from "../output/colors.js"
import { validateJson, validateToml } from "../validator/validator.js"
import { getAsync } from "../httpGet.js"
import { defaultProjectJsonName, downloadStats, manifestFileNames, defaultFolderNames, auth, xGitHubApiVersion } from "../configs/mainConfig.js"
import { debugLog } from "../output/output.js"
import { renameFile } from "../renameFile.js"
import * as packageFolderPaths from "../packageFolderPaths.js"
import * as syncConfigGenerator from "../syncConfigGenerator.js"
import { rimraf } from "rimraf"
import AdmZip from "adm-zip"

/**
 * @typedef { object } dependency
 * @property { string } alias
 * @property { string } name
 * @property { string } rev
 * @property { ("shared" | "server" | "dev")? } environmentOverwrite
 * @property { "github-rev" } type
 */

/**
 * @typedef { object } package
 * @property { string } alias
 * @property { string } scope
 * @property { string } name
 * @property { string } rev
 * @property { ("shared" | "server" | "dev")? } environmentOverwrite
 */

/**
 * @param { dependency } dependency
 * @returns { package }
 */
function packageEntryFromDependency(dependency) {
	const scope_name = dependency.name.split("/")

	const packageEntry = {
		alias: dependency.alias,
		scope: scope_name[0],
		name: scope_name[1],
		rev: dependency.rev,
		environmentOverwrite: dependency.environmentOverwrite,
		type: dependency.type
	}

	return packageEntry
}

/**
 * @param { * } packageData
 * @param { { rev: string?, ignoreType: boolean? }? } overwrites
 * @returns { string }
 */
function getFullPackageName(packageData, overwrites) {
	let packageString = ""

	if (!overwrites || !overwrites.ignoreType)
		packageString += `${packageData.type}#`

	packageString += `${packageData.scope}/${packageData.name}@${(overwrites && overwrites.rev) || packageData.rev}`
	return packageString
}

/**
 * @param { string } packageString
 * @param { any } parentDependencies
 * @param { string } alias
 */
function addDependencyAlias(packageString, parentDependencies, alias) {
	if (parentDependencies && !parentDependencies[packageString])
		parentDependencies[packageString] = { alias: alias }
}

/**
 * @param { string } packageString
 * @param { any } tree
 * @param { any } parentDependencies
 * @param { string } alias
 */
function addAlias(packageString, tree, parentDependencies, alias) {
	if (parentDependencies)
		return

	if (!tree[packageString])
		tree[packageString] = { dependencies: {} }

	if (tree[packageString] && !tree[packageString].alias)
		tree[packageString].alias = alias || undefined
}

/**
 * @param { { package: dependency, tree: any, parentDependencies: any? } } args
 */
export async function download(args) {
	try {
		const packageEntry = packageEntryFromDependency(args.package)
		const rev = packageEntry.rev || "main"

		const packageString = getFullPackageName(packageEntry, { rev: rev })
		let assetPath = `${packageFolderPaths.get(packageEntry.environmentOverwrite || "shared")}/${defaultFolderNames.indexFolder}/${packageEntry.scope.toLowerCase()}_${packageEntry.name.toLowerCase()}`
		let assetFolder = assetPath + `@${rev}`

		addDependencyAlias(packageString, args.parentDependencies, packageEntry.alias)
		addAlias(packageString, args.tree, args.parentDependencies, packageEntry.alias)

		if (!existsSync(assetFolder)) {
			// download rev

			debugLog(`Downloading ${green(packageString)} ...`)

			const asset = await getAsync(`https://api.github.com/repos/${packageEntry.scope}/${packageEntry.name}/zipball/${rev}`, {
				Accept: "application/vnd.github+json",
				Authorization: auth.github != "" && "Bearer " + auth.github,
				["X-GitHub-Api-Version"]: xGitHubApiVersion
			})

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(packageString)} already exists`)
				return
			}

			if (!asset)
				throw "Failed to download rev files"

			const assetUnzip = assetFolder + "-unzipped"
			mkdirSync(assetUnzip, { recursive: true })

			const assetZip = assetFolder + ".zip"
			writeFileSync(assetZip, asset)

			const zip = new AdmZip(assetZip)
			zip.extractAllTo(path.resolve(assetUnzip), true)

			mkdirSync(assetFolder, { recursive: true })

			let assetFile = assetFolder + `/${packageEntry.name.toLowerCase()}`
			const dirContent = readdirSync(assetUnzip)

			for (const i in dirContent) {
				await renameFile(path.resolve(assetUnzip, dirContent[i]), assetFile)
			}

			await rimraf(assetZip)
			await rimraf(assetUnzip)

			if (!args.tree[packageString])
				args.tree[packageString] = { dependencies: {} }

			addAlias(packageString, args.tree, args.parentDependencies, packageEntry.alias)

			args.tree[packageString].package = {
				scope: packageEntry.scope,
				name: packageEntry.name,
				rev: rev,
				environment: packageEntry.environmentOverwrite,
				environmentOverwrite: packageEntry.environmentOverwrite,
				type: packageEntry.type,
			}

			// check package data and sub packages
			const assetDirContent = readdirSync(assetFile)
			let content = {}

			for (const key in assetDirContent)
				content[assetDirContent[key]] = true

			// generate default.project.json if pesde package or if github package has build_files
			if (content[manifestFileNames.rostallerManifest]) {
				const packagePath = assetFile + `/${manifestFileNames.rostallerManifest}`
				const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

				if (!packageFile)
					throw `Failed to validate ${packagePath}`

				if (packageFile.package.build_files) {
					syncConfigGenerator.generate(assetFile, packageFile.package.build_files)
				}

				args.tree[packageString].package.lib = packageFile.package.lib
			} else if (content[manifestFileNames.pesdeManifest]) {
				const packagePath = assetFile + `/${manifestFileNames.pesdeManifest}`
				const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

				if (!packageFile)
					throw `Failed to validate ${packagePath}`

				syncConfigGenerator.generate(assetFile, packageFile.target.build_files || [])
				args.tree[packageString].package.lib = packageFile.target.lib
			}

			// rename default.project.json
			if (content[defaultProjectJsonName]) {
				const projectPath = assetFile + `/${defaultProjectJsonName}`
				let projectFile = validateJson("Project", projectPath, readFileSync(projectPath))

				if (projectFile.name != packageEntry.name.toLowerCase()) {
					debugLog("Renaming", cyan(projectPath))

					projectFile.name = packageEntry.name.toLowerCase()
					writeFileSync(projectPath, JSON.stringify(projectFile, null, "\t"))
				}
			}

			// update environment
			if (!packageEntry.environmentOverwrite) {
				if (content[manifestFileNames.rostallerManifest]) {
					const packagePath = assetFile + `/${manifestFileNames.rostallerManifest}`
					const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

					if (!packageFile)
						throw `Failed to validate ${packagePath}`

					args.tree[packageString].package.environment = packageFile.package.environment
				} else if (content[manifestFileNames.pesdeManifest]) {
					const packagePath = assetFile + `/${manifestFileNames.pesdeManifest}`
					const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

					if (!packageFile)
						throw `Failed to validate ${packagePath}`

					let environment

					const packageTarget = packageFile.target.environment

					if (packageTarget == "roblox_server")
						environment = "server"
					else if (packageTarget == "roblox")
						environment = "shared"
					else if (packageTarget == "luau")
						environment = "shared"

					if (environment)
						args.tree[packageString].package.environment = environment
				} else if (content[manifestFileNames.wallyManifest]) {
					const packagePath = assetFile + `/${manifestFileNames.wallyManifest}`
					const packageFile = validateToml(packagePath, readFileSync(packagePath).toString())

					if (!packageFile)
						throw `Failed to validate ${packagePath}`

					args.tree[packageString].package.environment = packageFile.package.realm
				}

				if (!args.tree[packageString].package.environment) {
					debugLog(`${cyan(assetFile)} is missing "${manifestFileNames.rostallerManifest}" file. Environment set to ${green("shared")}`)
					args.tree[packageString].package.environment = "shared"
				}

				if (args.tree[packageString].package.environment != "shared") {
					assetPath = `${packageFolderPaths.get(args.tree[packageString].package.environment)}/${defaultFolderNames.indexFolder}`

					if (!existsSync(assetPath))
						mkdirSync(assetPath, { recursive: true })

					const newPath = assetPath + `/${packageEntry.scope.toLowerCase()}_${packageEntry.name.toLowerCase()}@${rev}`
					await renameFile(assetFolder, newPath)

					assetFolder = newPath
					assetFile = assetFolder + `/${packageEntry.name.toLowerCase()}`
				}
			}

			downloadStats.success += 1
			console.log(`Downloaded ${green(getFullPackageName(packageEntry, { rev: rev, ignoreType: true }))} from github`)

			// check dependencies
			let manifest

			if (content[manifestFileNames.rostallerManifest])
				manifest = {
					type: manifestFileNames.rostallerManifest,
					path: `${assetFile}/${manifestFileNames.rostallerManifest}`
				}
			else if (content[manifestFileNames.pesdeManifest])
				manifest = {
					type: manifestFileNames.pesdeManifest,
					path: `${assetFile}/${manifestFileNames.pesdeManifest}`
				}
			else if (content[manifestFileNames.wallyManifest])
				manifest = {
					type: manifestFileNames.wallyManifest,
					path: `${assetFile}/${manifestFileNames.wallyManifest}`
				}

			return {
				packageLink: packageString,
				manifest: manifest,
			}
		} else {
			debugLog(`Package ${green(packageString)} already exists`)
		}
	} catch (err) {
		downloadStats.fail += 1

		const packageEntry = packageEntryFromDependency(args.package)
		const packageString = getFullPackageName(packageEntry, { ignoreType: true })
		console.error(red("Failed to download github rev"), green(packageString) + red(":"), yellow(err))
	}
}

/**
 * @param { { package: dependency, tree: any, parentDependencies: any? } } args
 */
export async function deepDownload(args) {
	try {
		const result = await download(args)

		if (!result)
			return
		if (!result.manifest)
			return

		const downloadManifestDependencies = (await import("../universal/manifest.js")).downloadManifestDependencies
		await downloadManifestDependencies(result.manifest, args.tree, args.tree[result.packageLink].dependencies, false)
	} catch (err) {
		const packageEntry = packageEntryFromDependency(args.package)
		const packageString = getFullPackageName(packageEntry, { ignoreType: true })
		console.error(red("Failed to check github package dependencies"), green(packageString) + red(":"), yellow(err))
	}
}

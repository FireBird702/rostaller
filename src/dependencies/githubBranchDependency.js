import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "fs"
import { resolve } from "path"
import extractZIP from "extract-zip"
import { red, yellow, green, cyan } from "../output/colors.js"
import { validateJson, validateToml } from "../validator/validator.js"
import { getAsync } from "../httpGet.js"
import { config, defaultProjectJsonName, downloadStats, manifestFileNames, getPackageFolderPath } from "../configs/mainConfig.js"
import { debugLog } from "../output/output.js"
import { rimraf } from "rimraf"
import { renameFile } from "../renameFile.js"

/**
 * @param {string} alias
 * @param {string} dependencyLink
 * @param {any} tree
 * @param {any?} parentDependencies
 * @param {boolean?} realmOverwrite
 */
export async function githubBranchDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite) {
	try {
		const packageLink = dependencyLink.split("@")
		const owner_repo = packageLink[0].split("/")
		const owner = owner_repo[0]
		const repo = owner_repo[1]
		const branch = packageLink[1] || "main"
		const formatedDependencyLink = `${packageLink[0]}@${branch}`

		var assetPath = `${getPackageFolderPath(realmOverwrite || "shared")}/_Index/${owner.toLowerCase()}_${repo.toLowerCase()}`
		var assetFolder = assetPath + `@${branch}`

		if (parentDependencies && !parentDependencies[formatedDependencyLink])
			parentDependencies[formatedDependencyLink] = { alias: alias }

		if (!existsSync(assetFolder)) {
			// get branch info

			debugLog(`Getting branch from ${green(dependencyLink)} ...`)

			const release = await getAsync(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, {
				Accept: "application/vnd.github+json",
				Authorization: config.GithubAccessToken != "" && "Bearer " + config.GithubAccessToken,
				["X-GitHub-Api-Version"]: "2022-11-28"
			}, "json")

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(formatedDependencyLink)} already exists`)
				return
			}

			if (!release || !("name" in release))
				throw "Failed to get branch info"

			// download branch

			debugLog(`Downloading ${green(formatedDependencyLink)} ...`)

			const asset = await getAsync(`https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`, {
				Accept: "application/vnd.github+json",
				Authorization: config.GithubAccessToken != "" && "Bearer " + config.GithubAccessToken,
				["X-GitHub-Api-Version"]: "2022-11-28"
			})

			if (existsSync(assetFolder)) {
				debugLog(`Package ${green(formatedDependencyLink)} already exists`)
				return
			}

			if (!asset)
				throw "Failed to download branch files"

			const assetZip = assetFolder + ".zip"
			const assetUnzip = assetFolder + "-unzipped"

			mkdirSync(assetUnzip, { recursive: true })
			writeFileSync(assetZip, asset)

			await extractZIP(assetZip, { dir: resolve(assetUnzip) })

			let assetFile = assetFolder + `/${repo.toLowerCase()}`

			mkdirSync(assetFolder, { recursive: true })

			const dirContent = readdirSync(assetUnzip)

			for (const i in dirContent) {
				await renameFile(resolve(assetUnzip, dirContent[i]), assetFile)
			}

			await rimraf(assetZip)
			await rimraf(assetUnzip)

			if (!tree[formatedDependencyLink])
				tree[formatedDependencyLink] = { dependencies: {} }

			if (!tree[formatedDependencyLink].alias)
				tree[formatedDependencyLink].alias = !parentDependencies && alias || undefined

			tree[formatedDependencyLink].package = {
				owner: owner,
				name: repo,
				version: branch,
				realm: realmOverwrite,
				realmOverwrite: realmOverwrite,
				type: "github-branch",
			}

			// check package data and sub packages
			const content = readdirSync(assetFile)

			let projectFile

			for (const key in content) {
				if (content[key] == defaultProjectJsonName) {
					const projectPath = assetFile + `/${defaultProjectJsonName}`
					projectFile = validateJson("Project", projectPath, readFileSync(projectPath))
				}

				if (!realmOverwrite) {
					if (content[key] == manifestFileNames.githubManifest) {
						const packagePath = assetFile + `/${manifestFileNames.githubManifest}`

						let packageFile = validateToml("SubPackage", packagePath, readFileSync(packagePath).toString())
						tree[formatedDependencyLink].package.realm = packageFile.package.realm
					}

					if (content[key] == manifestFileNames.wallyManifest) {
						const packagePath = assetFile + `/${manifestFileNames.wallyManifest}`

						let packageFile = validateToml("SubPackage", packagePath, readFileSync(packagePath).toString())
						tree[formatedDependencyLink].package.realm = packageFile.package.realm
					}
				}
			}

			if (!tree[formatedDependencyLink].package.realm) {
				debugLog(`${cyan(assetFile)} is missing "${manifestFileNames.githubManifest}" file. Realm set to ${green("shared")}`)
				tree[formatedDependencyLink].package.realm = "shared"
			}

			if (!projectFile) {
				throw `[${manifestFileNames.githubManifest}] is invalid`
			}

			// rename project name
			const projectPath = assetFile + `/${defaultProjectJsonName}`

			if (projectFile.name != repo.toLowerCase()) {
				debugLog("Renaming", cyan(projectPath))

				projectFile.name = repo.toLowerCase()
				writeFileSync(projectPath, JSON.stringify(projectFile, null, 2))
			}

			// update realm
			if (!realmOverwrite && tree[formatedDependencyLink].package.realm != "shared") {
				assetPath = `${getPackageFolderPath(tree[formatedDependencyLink].package.realm)}/_Index`

				if (!existsSync(assetPath))
					mkdirSync(assetPath, { recursive: true })

				const newPath = assetPath + `/${owner.toLowerCase()}_${repo.toLowerCase()}@${branch}`

				await renameFile(assetFolder, newPath)

				assetFolder = newPath
				assetFile = assetFolder + `/${repo.toLowerCase()}`
			}

			downloadStats.success += 1
			console.log(`Downloaded branch ${green(formatedDependencyLink)} from github`)

			// check dependencies
			var manifestFile

			for (const key in content) {
				if (content[key] == manifestFileNames.githubManifest)
					manifestFile = `${assetFile}/${manifestFileNames.githubManifest}`
				else if (content[key] == manifestFileNames.wallyManifest)
					manifestFile = `${assetFile}/${manifestFileNames.wallyManifest}`

				if (manifestFile)
					break
			}

			return {
				packageLink: formatedDependencyLink,
				manifestFile: manifestFile,
			}
		} else {
			debugLog(`Package ${green(formatedDependencyLink)} already exists`)
		}
	} catch (err) {
		downloadStats.failed += 1
		console.error(red("Failed to download github branch"), green(dependencyLink) + red(":"), yellow(err))
	}
}

/**
 * @param {string} alias
 * @param {string} dependencyLink
 * @param {any} tree
 * @param {any?} parentDependencies
 * @param {boolean?} realmOverwrite
 */
export async function githubBranchDeepDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite) {
	try {
		const result = await githubBranchDependency(alias, dependencyLink, tree, parentDependencies, realmOverwrite)

		if (!result)
			return
		if (!result.manifestFile)
			return

		const downloadManifestDependencies = (await import("../manifest.js")).downloadManifestDependencies
		await downloadManifestDependencies(result.manifestFile, tree, tree[result.packageLink].dependencies)
	} catch (err) {
		console.error(red("Failed to check github package dependencies"), green(dependencyLink) + red(":"), yellow(err))
	}
}

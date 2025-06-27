import { writeFileSync } from "fs"
import { lockFileName, mainPath } from "./configs/mainConfig.js"
import toml from "@iarna/toml"
import { debugLog } from "./output/output.js"
import { magenta } from "./output/colors.js"
import { getFullPackageName } from "./universal/package.js"

function getPackageEntry(packageData) {
	let packageEntry = {
		[packageData.type]: `${packageData.scope}/${packageData.name}`,
		version: packageData.version && `=${packageData.version}` || undefined,
		index: packageData.index
	}

	if (packageData.type == "github-rev") {
		packageEntry.rev = packageData.rev
	} else if (packageData.version == "latest")
		packageEntry.version = undefined

	return packageEntry
}

function formatPackage(packageLink, map, fileData) {
	const packageData = map[packageLink]
	const fullName = getFullPackageName(packageData.package)

	if (fileData[fullName])
		return

	fileData[fullName] = {
		...getPackageEntry(packageData.package),
		alias: packageData.alias,
		environmentOverwrite: packageData.package.environmentOverwrite,
		dependencies: {},
		isMainDependency: packageData.package.isMainDependency
	}

	for (const key in packageData.dependencies) {
		const dependencyFullName = getFullPackageName(map[key].package)

		fileData[fullName].dependencies[dependencyFullName] = {
			alias: packageData.dependencies[key].alias,
		}
	}
}

export async function generateLockFile(map) {
	debugLog(magenta(`Generating ${lockFileName} file ...`, true))

	let fileData = {}

	for (const key in map) {
		formatPackage(key, map, fileData)
	}

	writeFileSync(`${mainPath}/${lockFileName}`, toml.stringify(fileData))
}

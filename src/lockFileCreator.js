import { writeFileSync } from "fs"
import { lockFileName, mainPath } from "./configs/mainConfig.js"

function getPackageFullName(packageData) {
	if (packageData.type == "github-branch")
		return `${packageData.type}#${packageData.owner}/${packageData.name}@${packageData.version}`
	else if (packageData.version == "latest")
		return `${packageData.type}#${packageData.owner}/${packageData.name}`
	else
		return `${packageData.type}#${packageData.owner}/${packageData.name}@=${packageData.version}`
}

function formatPackage(packageLink, map, fileData) {
	const packageData = map[packageLink]
	const fullName = getPackageFullName(packageData.package)

	if (fileData[fullName])
		return

	fileData[fullName] = {
		alias: packageData.alias,
		realmOverwrite: packageData.package.realmOverwrite,
		dependencies: {},
	}

	for (const key in packageData.dependencies) {
		const dependencyFullName = getPackageFullName(map[key].package)

		fileData[fullName].dependencies[dependencyFullName] = {
			alias: packageData.dependencies[key].alias,
		}
	}
}

export async function generateLockFile(map) {
	var fileData = {}

	for (const key in map) {
		formatPackage(key, map, fileData)
	}

	writeFileSync(`${mainPath}/${lockFileName}`, JSON.stringify(fileData, null, "\t"))
}

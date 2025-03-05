import { downloadStats } from "./configs/mainConfig.js"
import { green, red, yellow } from "./output/colors.js"
import { getFullPackageName, packageEntryFromDependency } from "./universal/package.js"
import * as wallyPackage from "./wally/package.js"
import * as pesdePackage from "./pesde/package.js"
import * as githubPackage from "./github/package.js"
import * as githubRevPackage from "./github-rev/package.js"

/**
 * @typedef { object } unversalDependency
 * @property { string } alias
 * @property { string } name
 * @property { string } version
 * @property { string? } index
 * @property { string? } rev
 * @property { "wally" | "pesde" | "github" | "github-rev" } type
 * @property { ("shared" | "server" | "dev")? } environmentOverwrite
 */

/**
 * @param { { package: unversalDependency, tree: any, parentDependencies: any? } } args
 */
export async function deep(args) {
	if (args.package.type == "wally")
		await wallyPackage.deepDownload(args)
	else if (args.package.type == "pesde")
		await pesdePackage.deepDownload(args)
	else if (args.package.type == "github")
		await githubPackage.deepDownload(args)
	else if (args.package.type == "github-rev")
		await githubRevPackage.deepDownload(args)
	else {
		downloadStats.fail += 1
		throw red("Failed to download depedency ") + green(getFullPackageName(packageEntryFromDependency(args.package), { ignoreType: true })) + red(": ") + yellow(`"${args.package.type}" is not a valid dependency type`)
	}
}

/**
 * @param { { package: unversalDependency, tree: any, parentDependencies: any? } } args
 */
export async function dependency(args) {
	if (args.package.type == "wally")
		await wallyPackage.download(args)
	else if (args.package.type == "pesde")
		await pesdePackage.download(args)
	else if (args.package.type == "github")
		await githubPackage.download(args)
	else if (args.package.type == "github-rev")
		await githubRevPackage.download(args)
	else {
		downloadStats.fail += 1
		throw red("Failed to download depedency ") + green(getFullPackageName(packageEntryFromDependency(args.package), { ignoreType: true })) + red(": ") + yellow(`"${args.package.type}" is not a valid dependency type`)
	}
}

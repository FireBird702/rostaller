import { defaultFolderNames } from "./mainConfig.js"

export const rootManifestConfig = {
	sharedPackagesFolder: defaultFolderNames.sharedPackagesFolder,
	serverPackagesFolder: defaultFolderNames.serverPackagesFolder,
	devPackagesFolder: defaultFolderNames.devPackagesFolder,

	// used for server and dev dependencies and for sourcemap
	sharedPackages: null,
	// used for dev dependencies and for sourcemap
	serverPackages: null,
	// used for sourcemap
	devPackages: null,
}

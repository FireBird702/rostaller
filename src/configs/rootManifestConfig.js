import { defaultFolderNames } from "./mainConfig"

export const rootManifestConfig = {
	sharedPackagesFolder: defaultFolderNames.sharedPackagesFolder,
	serverPackagesFolder: defaultFolderNames.serverPackagesFolder,
	devPackagesFolder: defaultFolderNames.devPackagesFolder,

	sharedPackages: null, // used for server and dev dependencies and for sourcemap
	serverPackages: null, // used for dev dependencies and for sourcemap
	devPackages: null, // used for sourcemap
}

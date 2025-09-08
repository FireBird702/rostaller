export const defaultRootManifestConfig = {
	// used for server and dev dependencies and for sourcemap
	sharedPackages: "game.ReplicatedStorage.sharedPackages",
	wallySharedPackages: "game.ReplicatedStorage.Packages",

	// used for dev dependencies and for sourcemap
	serverPackages: "game.ServerScriptService.serverPackages",
	wallyServerPackages: "game.ReplicatedStorage.ServerPackages",

	// used for sourcemap
	devPackages: "game.ReplicatedStorage.devPackages",
	wallyDevPackages: "game.ReplicatedStorage.DevPackages",
}

export let rootManifestConfig = {
	// used for server and dev dependencies and for sourcemap
	sharedPackages: defaultRootManifestConfig.sharedPackages,
	// used for dev dependencies and for sourcemap
	serverPackages: defaultRootManifestConfig.serverPackages,
	// used for sourcemap
	devPackages: defaultRootManifestConfig.devPackages,

	// used for wally.toml root manifest
	useWallyFolderStructure: false,
}

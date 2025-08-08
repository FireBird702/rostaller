# rostaller - A simple tool for simple needs

Download packages from [wally][wally], [pesde][pesde] and [github][github]

[wally]: https://github.com/UpliftGames/wally
[pesde]: https://github.com/pesde-pkg/pesde
[github]: https://github.com

* [Installation](#installation)
* [Commands](#commands)
* [Manifest Format](#manifest-format)

## Installation

### With Rokit

[Rokit][rokit] is the toolchain manager. You can use it to install rostaller:

In your project

```bash
rokit add FireBird702/rostaller
```

Or globally

```bash
rokit add --global FireBird702/rostaller
```

[rokit]: https://github.com/rojo-rbx/rokit

## Commands

Create a new, empty package.

```sh
rostaller init
```

Install all packages. Currently supported files: `rostaller.toml`, `pesde.toml` and `wally.toml`.

```sh
rostaller install --migrate
```

Install all packages and migrate to `rostaller.toml`.

```sh
rostaller install
```

Install all packages from lockfile.

```sh
rostaller install --locked
```

Authenticate with an artifact provider, such as GitHub.

```sh
rostaller authenticate
```

Open rostaller config.

```sh
rostaller config
```

## Manifest Format

[toml]: https://toml.io/

The package manifest file describes a package and all of the packages it depends on. Package manifests are written in [TOML][toml] and stored in a file named `rostaller.toml`.

Manifest files define all necessary information about a package.

Here is an example package manifest, annotated with comments:

```toml
# [package] can be omitted if it is not a package manifest file

[package]
# Packages belong to a "environment", which helps prevent using code in the wrong context.
#
# Packages in the "shared" environment can only depend on other "shared" packages.
# Packages in the "server" environment can only depend on other "shared" or "server" packages.
# Packages in the "dev" environment can depend on other "dev", "shared" or "server" packages.
#
# In most cases "shared" environment should be used.
environment = "shared"

# The entry point of the library exported by the package.
# This file is what will be required when the package is loaded using require().
lib = "src/lib.luau"

# A list of files that should be synced to Roblox when the package is installed.
build_files = ["src"]

# If package entry file is "init.lua" or "init.luau", lib and build_files can be omitted

[wally_indexes]
# List of wally indexes.
# If package has [index] not specified, the default index is used.
default = "https://github.com/UpliftGames/wally-index"

[pesde_indexes]
# List of pesde indexes.
# If package has [index] not specified, the default index is used.
default = "https://github.com/pesde-pkg/index"

[dependencies]
# The name on the left is an alias.
# It defines what name we would like to use to refer to this package.

# Wally package template.
WallyPackage = { wally = "scope/name", version = "x.x.x" }

# Pesde package template.
PesdePackage = { pesde = "scope/name", version = "x.x.x" }

# Github release package template.
# Use when published releases are available and are semver compatible.
# Latest tag will be used if [version] is not specified.
GithubPackage = { github = "owner/name", version = "x.x.x" }

# Github revision package template.
# Use when no published releases are available or not semver compatible.
# [rev] can be a branch name, tag or commit hash.
GithubRevPackage = { github-rev = "owner/name", rev = "main" }

# Versions are SemVer version requirements. The default behavior matches
# Cargo, or npm with the `^` version specifier.

# rostaller will try to automatically pick package environment,
# if it fails, "shared" environment will be picked.

[dev_dependencies]
# Dev dependencies that are only needed during development.
TestEZ = { wally = "roblox/testez", version = "0.4.1" }

[shared_dependencies_overwrite]
# Shared dependencies can be required here as shown above.
# Overwrites package environment to "shared", should be used for github revisions.

[server_dependencies_overwrite]
# Server dependencies can be required here as shown above.
# Overwrites package environment to "server", should be used for github revisions.

[place]
# This is used to specify where packages are located in the Roblox datamodel.
# It should match the .project.json file
# If not specified, these are the default values
shared_packages = "game.ReplicatedStorage.sharedPackages"
server_packages = "game.ServerScriptService.serverPackages"
dev_packages = "game.ReplicatedStorage.devPackages"
```

# rostaller - A simple tool for simple needs

Download packages from [wally][wally], github releases and github branches (useful when you don't want to create private registry or package is not available on [wally][wally])

[wally]: https://github.com/UpliftGames/wally

* [Installation](#installation)
* [Commands](#commands)
* [Manifest Format](#manifest-format)
* [Additional Informations](#additional-informations)

## Installation

### With Aftman (preferred)

[Aftman][aftman] is the toolchain manager. You can use it to install rostaller:

In your project

```bash
aftman add FireBird702/rostaller
```

Or globally

```bash
aftman add --global FireBird702/rostaller
```

[aftman]: https://github.com/LPGhatguy/aftman

### From GitHub

Pre-built binaries are available for Windows, macOS, and Linux from the [GitHub Releases Page][releases].

[releases]: https://github.com/FireBird702/rostaller/releases

## Commands

Create a new, empty package.

```sh
rostaller init
```

Install all packages. Default project.json file is `default.project.json`.

```sh
rostaller install
```

Install all packages from specified project.json file.

```sh
rostaller install --project-json [project.json]
```

Install all packages from lock file and because of that you can commit package-lock.json file to your repository.

```sh
rostaller install --lock
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
[package]
# Packages belong to a "realm", which helps prevent using code in the wrong context.
#
# Packages in the "shared" realm can only depend on other "shared" packages.
# Packages in the "server" realm can only depend on other "shared" or "server" packages.
# Packages in the "dev" realm can depend on other "dev", "shared" or "server" packages.
#
# In most cases "shared" realm should be used.
realm = "shared"

[dependencies]
# rostaller will try to automatically pick package realm based on it's .toml file,
# if it fails, "shared" realm will be picked.
#
# The name on the left is an alias. It defines what name we would like to use to refer to this package.
# The value on the right will usually be:
#   wally#[scope]/[name]@[semver_version] for wally packages.
#
#   github#[owner]/[repository]@[semver_version] for github packages. If no semver_version specified then latest tag will be choosen.
#
#   github-branch#[owner]/[repository]@[branch] for github branches when no releases are available.
#
# Versions are SemVer version requirements. The default behavior matches
# Cargo, or npm with the `^` version specifier.

[shared-dependencies-overwrite]
# Shared dependencies can be required here as shown above.
# Overwrites package realm to "shared", should be used for github branches.

[server-dependencies-overwrite]
# Server dependencies can be required here as shown above.
# Overwrites package realm to "server", should be used for github branches.

[dev-dependencies]
# Dev dependencies that are only needed during development.
TestEZ = "wally#roblox/testez@0.4.1"

[place]
# Value on the right is a path to Packages folder.

# It is required if server or dev dependency is depending on a shared dependency.
shared-packages = 'game:GetService("ReplicatedStorage").Packages'

# It is required if dev dependency is depending on a server dependency.
server-packages = 'game:GetService("ServerScriptService").Packages'
```

## Additional Informations

rostaller uses [wally-package-types](https://github.com/JohnnyMorganz/wally-package-types) for exporting types, necessary for proper Luau type checking support.

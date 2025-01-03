import yargs from "yargs"
import { config } from "./commands/config"
import { init } from "./commands/init"
import { install } from "./commands/install"
import { installFromLock } from "./commands/installFromLock"
import { authenticate } from "./commands/authenticate"
import { version } from "./version"

if (!process.pkg) {
	process.exit()
}

const args = process.argv.slice(2)

yargs(args)
	.usage("Usage: $0 <command>")

	.version(version)

	.alias("h", "help")
	.alias("v", "version")

	.command(
		"config",
		"Open the config file",
		() => { },
		config
	)

	.command(
		"authenticate <provider>",
		"Authenticate with an artifact provider, such as GitHub",
		(yargs) => {
			yargs
				.positional("provider", {
					describe: "The artifact / tool provider to authenticate with, e.g. github",
					type: "string",
				})
				.demandOption("provider")

			yargs
				.option("token", {
					describe: "The token to use for authentication",
					type: "string",
				})

				.option("remove", {
					describe: "If the token should be removed",
					type: "boolean",
				})
		},
		authenticate
	)

	.command(
		"init",
		"Create new manifest file",
		() => { },
		init
	)

	.command(
		"install",
		"Install all dependencies for the project",
		(yargs) => {
			yargs
				.option("locked", {
					describe: "Install all dependencies from the lockfile",
					type: "boolean",
				})
		},
		async (args) => {
			if (args.locked)
				await installFromLock()
			else
				await install()
		}
	)

	.strictCommands()
	.demandCommand()
	.parse()

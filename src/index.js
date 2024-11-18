import yargs from "yargs"
import { config } from "./commands/config"
import { init } from "./commands/init"
import { install } from "./commands/install"
import { installFromLock } from "./commands/installFromLock"

if (!process.pkg) {
	process.exit()
}

const args = process.argv.slice(2)

yargs(args)
	.usage("Usage: $0 <command>")

	.alias("h", "help")
	.alias("v", "version")

	.command(
		"config",
		"Opens the config file",
		() => { },
		config
	)

	.command(
		"init",
		"Creates new manifest file",
		() => { },
		init
	)

	.command(
		"install",
		"Installs all dependencies for the project",
		(yargs) => {
			yargs
				.option("locked", {
					describe: 'Install all dependencies from the lockfile',
				})
				.boolean("locked")
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

import yargs from "yargs"
import { defaultProjectJsonName } from "./configs/mainConfig.js"
import { config } from "./commands/config.js"
import { init } from "./commands/init.js"
import { install } from "./commands/install.js"
import { installFromLock } from "./commands/installFromLock.js"
import { version } from "./version.js"

if (!process.pkg) {
	process.exit(0)
}

const args = process.argv.slice(2)

yargs(args)
	.scriptName("rostaller")
	.usage("Usage: rostaller [options]")

	.alias("v", "version")
	.version(version)
	.describe("version", "show version information")

	.alias("h", "help")
	.help("help")
	.describe("help", "show help")
	.showHelpOnFail(true)

	.command(
		"config",
		"open the config file",
		() => { },
		config
	)

	.command(
		"init",
		"create new manifest file",
		() => { },
		init
	)

	.command(
		"install",
		"install all dependencies",
		(yargs) => {
			yargs
				.boolean("lock")
				.describe("lock", "get dependencies from the lock file")

			yargs
				.string("project-json")
				.describe("project-json", "path to your .project.json file")
				.default("project-json", defaultProjectJsonName)
		},
		async (args) => {
			if (args.lock)
				await installFromLock(args)
			else
				await install(args)
		}
	)

	.strictCommands()
	.demandCommand()
	.parse()

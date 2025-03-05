import { writeFileSync } from "fs"
import { auth, authPath } from "../configs/mainConfig.js"
import { green, red, yellow } from "../output/colors.js"
import toml from "@iarna/toml"

export async function authenticate(args) {
	if (args.remove) {
		if (!auth[args.provider]) {
			console.error(`${red(`No authentication token for ${args.provider} exists`)}`)
			process.exit(1)
		}

		try {
			auth[args.provider] = undefined
			writeFileSync(authPath, toml.stringify(auth))

			console.log(`[${green("INFO", true)}] Removed ${args.provider} authentication token`)
		} catch (err) {
			console.error(`${red(`Unable to remove ${args.provider} authentication token:`)} ${yellow(err)}`)
			process.exit(1)
		}
	} else {
		if (!args.token) {
			console.error(`${red(`A token must be given to authenticate with ${args.provider}`)}`)
			process.exit(1)
		}

		try {
			auth[args.provider] = args.token
			writeFileSync(authPath, toml.stringify(auth))

			console.log(`[${green("INFO", true)}] Added ${args.provider} authentication token`)
		} catch (err) {
			console.error(`${red(`Unable to add ${args.provider} authentication token:`)} ${yellow(err)}`)
			process.exit(1)
		}
	}
}

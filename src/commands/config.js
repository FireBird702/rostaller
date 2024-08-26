import open from "open"
import { configPath } from "../configs/mainConfig.js"
import { red, yellow } from "../output/colors.js"

export async function config() {
	try {
		await open(configPath, { wait: true })
	} catch (err) {
		console.error(`${red("Unable to open config file:")} ${yellow(err)}`)
		process.exit(1)
	}
}

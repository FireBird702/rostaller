import { green, yellow } from "./output/colors.js"
import { isEmpty } from "./isEmpty.js"

export function showUpdates(message, updates) {
    if (isEmpty(updates))
        return

    console.log("")
    console.log(message)

    for (const key in updates) {
        const versions = updates[key]

        for (const oldVersion in versions) {
            const newVersion = versions[oldVersion]

            console.log(` ${green(key)}: ${yellow(oldVersion)} -> ${yellow(newVersion)}`)
        }
    }
}

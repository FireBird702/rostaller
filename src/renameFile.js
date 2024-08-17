import graceful_fs from "graceful-fs"
import { setTimeout } from "timers/promises"
import { red } from "./output/colors.js"

const rename = graceful_fs.rename

const maxAttempts = 5

function renameWithRetry(oldPath, newPath, data) {
	rename(oldPath, newPath, (err) => {
		if (err) {
			data.attempts += 1

			if (data.attempts < maxAttempts)
				renameAttempt(oldPath, newPath, data)
			else
				console.error(red(`Failed to rename [${oldPath}] to [${newPath}]`))

			return
		}

		data.completed = true
	})
}

export async function renameFile(oldPath, newPath) {
	var data = {
		completed: false,
		attempts: 0
	}

	renameWithRetry(oldPath, newPath, data)

	while (!data.completed && data.attempts < maxAttempts)
		await setTimeout(100)
}

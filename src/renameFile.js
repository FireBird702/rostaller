import graceful_fs from "graceful-fs"
import { setTimeout } from "timers/promises"
import { red } from "./output/colors"

const rename = graceful_fs.rename

const maxRetryAttempts = 5

function renameWithRetry(oldPath, newPath, data) {
	rename(oldPath, newPath, (err) => {
		if (err) {
			data.retryAttempts += 1

			if (data.retryAttempts <= maxRetryAttempts)
				renameWithRetry(oldPath, newPath, data)
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
		retryAttempts: 0
	}

	renameWithRetry(oldPath, newPath, data)

	while (!data.completed && data.retryAttempts <= maxRetryAttempts)
		await setTimeout(100)
}

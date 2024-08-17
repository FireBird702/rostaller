import graceful_fs from "graceful-fs"
import { setTimeout } from "timers/promises"

const rename = graceful_fs.rename

export async function renameFile(oldPath, newPath) {
	var completed = false

	rename(oldPath, newPath, (err) => {
		if (err)
			throw `Failed to rename [${oldPath}] to [${newPath}]`

		completed = true
	})

	while (!completed)
		await setTimeout(100)
}

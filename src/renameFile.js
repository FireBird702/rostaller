import graceful_fs from "graceful-fs"
import { loopWhile } from "deasync"

const rename = graceful_fs.rename

export function renameFile(oldPath, newPath) {
	var completed = false

	rename(oldPath, newPath, (err) => {
		if (err)
			throw `Failed to rename [${oldPath}] to [${newPath}]`

		completed = true
	})

	loopWhile(() => { return !completed })
}

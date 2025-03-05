import { existsSync, mkdirSync, createReadStream } from "fs"
import { x } from "tar"
import { createGunzip } from "zlib"
import { debugLog } from "./output/output.js"
import { cyan } from "./output/colors.js"

/**
 * @param { string } filePath
 * @param { string } outputDir
 */
export async function extractTarGz(filePath, outputDir) {
    try {
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true })
        }

        // Create a read stream for the .tar.gz file
        const readStream = createReadStream(filePath)

        // Use a promise to wrap the extraction process
        await new Promise((resolve, reject) => {
            readStream
                .pipe(createGunzip())  // Decompress the .gz part
                .pipe(x({ cwd: outputDir }))  // Extract the .tar content
                .on("finish", resolve)  // Resolve the promise on completion
                .on("error", reject);  // Reject the promise on error
        });

        debugLog(`Extraction to ${cyan(outputDir)} completed!`)
    } catch (err) {
        throw `Error during extraction: ${err}`
    }
}

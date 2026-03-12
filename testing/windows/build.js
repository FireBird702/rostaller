import { execSync } from "child_process"

execSync("npm run test-win-build", { stdio: "inherit" })

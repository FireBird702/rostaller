import { execSync } from "child_process"

execSync("npm run test-lin-build", { stdio: "inherit" })

import { execFileSync } from "child_process"

execFileSync("./bin/rostaller.exe", ["install"], { stdio: "inherit" })

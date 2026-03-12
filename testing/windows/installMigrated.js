import { execFileSync } from "child_process"

execFileSync("./bin/rostaller.exe", ["install", "--migrate"], { stdio: "inherit" })

import { execFileSync } from "child_process"

execFileSync("./bin/rostaller.exe", ["install", "--locked"], { stdio: "inherit" })

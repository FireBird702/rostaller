import { execFileSync } from "child_process"

execFileSync("./bin/rostaller", ["install", "--migrate"], { stdio: "inherit" })

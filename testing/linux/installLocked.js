import { execFileSync } from "child_process"

execFileSync("./bin/rostaller", ["install", "--locked"], { stdio: "inherit" })

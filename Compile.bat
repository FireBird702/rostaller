@echo off
cd %~dp0
del /q/s bin\*
rd bin
call ./node_modules/.bin/esbuild --platform=node --bundle --format=cjs --define:import.meta.url=_importMetaUrl "--banner:js=const _importMetaUrl = require('url').pathToFileURL(__filename)" --outfile=rostaller.js ./src/index.js
call ./node_modules/.bin/pkg --no-bytecode --public --targets latest-win,latest-macos,latest-macos-arm64,latest-linux,latest-linux-arm64 --public-packages '*' --out-path bin rostaller.js
del rostaller.js
pause

@echo off
cd %~dp0
del /q/s bin\*
del /q/s target\*
rd bin
call npm install
call npm run build
call npm run run-esbuild
call ./node_modules/.bin/pkg --no-bytecode --public --targets latest-win,latest-macos,latest-macos-arm64,latest-linux,latest-linux-arm64 --public-packages '*' --out-path bin rostaller.js
del rostaller.js
del /s *.node
pause

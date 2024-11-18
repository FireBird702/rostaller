@echo off
cd %~dp0
del /q/s bin\*
del /q/s target\*
rd bin
call cargo install cross --git https://github.com/cross-rs/cross
call npm install
call npm run build
del rostaller.js
del /s *.node
pause

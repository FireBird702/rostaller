@echo off
cd %~dp0
del /q/s bin\*
del /q/s target\*
rd bin
call npm install
call npm run test-win-build
del rostaller.cjs
del /s *.node
pause

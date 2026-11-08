@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js and retry.
  exit /b 1
)
if not exist "node_modules\node-xlsx\package.json" (
  echo Installing locked development tools...
  call npm ci --ignore-scripts --no-audit --no-fund
  if errorlevel 1 exit /b 1
)
node app.cjs
set "meta_exit=%errorlevel%"
if not "%meta_exit%"=="0" echo Export failed. Previous game-config.json is preserved.
exit /b %meta_exit%

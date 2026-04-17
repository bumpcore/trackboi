@echo off
setlocal

set "SELF_DIR=%~dp0"
set "ROOT_DIR=%SELF_DIR%.."
set "COMMAND=%~1"

set "IS_CLI="
if "%COMMAND%"=="mcp" set "IS_CLI=1"
if "%COMMAND%"=="projects" set "IS_CLI=1"
if "%COMMAND%"=="cards" set "IS_CLI=1"
if "%COMMAND%"=="help" set "IS_CLI=1"
if "%COMMAND%"=="--help" set "IS_CLI=1"
if "%COMMAND%"=="-h" set "IS_CLI=1"

if not "%TRACKBOI_ELECTRON%"=="" (
	set "ELECTRON_BINARY=%TRACKBOI_ELECTRON%"
) else if exist "%ROOT_DIR%\node_modules\electron\dist\electron.exe" (
	set "ELECTRON_BINARY=%ROOT_DIR%\node_modules\electron\dist\electron.exe"
) else if exist "%ROOT_DIR%\Trackboi.exe" (
	set "ELECTRON_BINARY=%ROOT_DIR%\Trackboi.exe"
) else if exist "%ROOT_DIR%\trackboi.exe" (
	set "ELECTRON_BINARY=%ROOT_DIR%\trackboi.exe"
) else (
	echo Could not find Trackboi executable. 1>&2
	exit /b 1
)

if defined IS_CLI (
	if exist "%ROOT_DIR%\dist-node\cli\main.cjs" (
		set "CLI_ENTRY=%ROOT_DIR%\dist-node\cli\main.cjs"
	) else if exist "%ROOT_DIR%\cli\main.cjs" (
		set "CLI_ENTRY=%ROOT_DIR%\cli\main.cjs"
	) else if exist "%ROOT_DIR%\app\dist-node\cli\main.cjs" (
		set "CLI_ENTRY=%ROOT_DIR%\app\dist-node\cli\main.cjs"
	) else (
		echo Could not find Trackboi CLI bundle. 1>&2
		exit /b 1
	)

	set "ELECTRON_RUN_AS_NODE=1"
	"%ELECTRON_BINARY%" "%CLI_ENTRY%" %*
	exit /b %ERRORLEVEL%
)

set "ELECTRON_RUN_AS_NODE="
if exist "%ROOT_DIR%\dist-node\electron\main.cjs" (
	"%ELECTRON_BINARY%" "%ROOT_DIR%\dist-node\electron\main.cjs" %*
) else (
	start "" "%ELECTRON_BINARY%" %*
)
exit /b %ERRORLEVEL%

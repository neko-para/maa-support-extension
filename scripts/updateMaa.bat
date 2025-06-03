@echo off
REM 获取 git.exe 的路径
for /f "delims=" %%G in ('where git') do (
    set "GIT_CMD_PATH=%%G"
    goto found
)

echo Git not found!
exit /b 1

:found
REM 提取 Git 安装路径
set "GIT_ROOT=%GIT_CMD_PATH:cmd\git.exe=%"
set "BASH_PATH=%GIT_ROOT%bin\bash.exe"

REM 获取当前脚本路径和名称
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_NAME=%~n0.sh"
set "SH_FILE=%SCRIPT_DIR%%SCRIPT_NAME%"

REM 执行 bash 脚本
"%BASH_PATH%" "%SH_FILE%"

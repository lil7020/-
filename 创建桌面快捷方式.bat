@echo off
chcp 65001 >nul
title 创建桌面快捷方式

echo.
echo ==============================================
echo        创建桌面快捷方式
echo ==============================================
echo.

:: 获取当前目录
set "CURRENT_DIR=%~dp0"

:: 创建 VBS 脚本用于生成快捷方式
echo 创建快捷方式...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%USERPROFILE%\Desktop\甲醇作业区人员信息管理系统.lnk'); $s.TargetPath = '%CURRENT_DIR%应用程序\甲醇作业区人员信息管理系统.exe'; $s.WorkingDirectory = '%CURRENT_DIR%应用程序'; $s.Description = '甲醇作业区人员信息管理系统'; $s.Save()"

if %errorlevel% equ 0 (
    echo ✅ 桌面快捷方式创建成功！
    echo.
    echo 快捷方式已创建在桌面：
    echo %USERPROFILE%\Desktop\甲醇作业区人员信息管理系统.lnk
) else (
    echo ❌ 快捷方式创建失败
)

echo.
pause
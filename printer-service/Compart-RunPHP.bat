@echo off
setlocal enabledelayedexpansion

mode con: cols=52 lines=7

:loop
cls

for /f "delims=" %%i in ('php -f C:\compartPrinter\CompartOrderControl.php') do (
    set "result=%%i"
)

if "%result%"=="success" (
    color 0A
    echo ===================================================
    echo [INFO]     New order received and printed.
    echo ===================================================
    echo.
    echo                 COMPART SOFTWARE
    echo           ART, SCIENCE AND TECHNOLOGY
) else if "%result%"=="no_order" (
    color 0E
    echo ===================================================
    echo [INFO]    There are currently no new orders.
    echo ===================================================
    echo.
    echo                 COMPART SOFTWARE
    echo           ART, SCIENCE AND TECHNOLOGY
) else (
    color 0C
    echo ===================================================
    echo [ERROR] An error occurred while checking the order!
    echo ===================================================
    echo.
    echo                 COMPART SOFTWARE
    echo           ART, SCIENCE AND TECHNOLOGY
)

timeout /t 1 /nobreak > nul
goto loop

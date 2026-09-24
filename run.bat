@echo off
setlocal EnableExtensions
cd /d "%~dp0" || exit /b 1
title Do Cu Quang Huy - Launcher

rem =====================================================================
rem  run.bat - Launcher nhanh cho du an "Do Cu Quang Huy" (Windows)
rem
rem  Cach dung:
rem     run.bat              mo menu chon (hoac nhap dup file)
rem     run.bat <lenh>       setup | dev | build | start | test | verify |
rem                          smoke | deploy | crew | clean | help
rem     run.bat clean deep   don dep them node_modules + crew\.venv (~900 MB)
rem     run.bat crew "..."   chay CrewAI, vi du: run.bat crew "toi uu trang chu"
rem
rem  Luu y: file nay CHI dung ky tu ASCII de tranh loi font cua cmd.exe.
rem =====================================================================

set "CMD=%~1"
set "ARG2=%~2"
if not "%CMD%"=="" goto :dispatch
goto :menu

:dispatch
if /i "%CMD%"=="help"   goto :help
if /i "%CMD%"=="-h"     goto :help
if /i "%CMD%"=="/h"     goto :help
if /i "%CMD%"=="setup"  goto :do_setup
if /i "%CMD%"=="dev"    goto :do_dev
if /i "%CMD%"=="build"  goto :do_build
if /i "%CMD%"=="start"  goto :do_start
if /i "%CMD%"=="test"   goto :do_test
if /i "%CMD%"=="verify" goto :do_verify
if /i "%CMD%"=="smoke"  goto :do_smoke
if /i "%CMD%"=="deploy" goto :do_deploy
if /i "%CMD%"=="crew"   goto :do_crew
if /i "%CMD%"=="clean"  goto :do_clean
echo [LOI] Lenh khong hop le: "%CMD%"
echo Lenh hop le: setup dev build start test verify smoke deploy crew clean help
echo Vi du: run.bat dev  -  run.bat start  -  run.bat clean deep
exit /b 2

rem --------------------------------------------------------------- helpers
:need_npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [LOI] Khong tim thay npm. Hay cai Node.js 22+ tu https://nodejs.org
    exit /b 1
)
exit /b 0

:need_deps
if exist "client\node_modules\" if exist "server\node_modules\" exit /b 0
echo [LOI] Chua cai dependencies. Chay truoc: run.bat setup
exit /b 1

rem --------------------------------------------------------------- actions
:do_setup
call :need_npm || exit /b 1
echo [1/1] Cai dependencies cho client + server + tools (lan dau co the lau 3-5 phut)...
call npm run setup
set "EC=%ERRORLEVEL%"
if "%EC%"=="0" (echo [OK] Setup xong. Chay: run.bat dev de phat trien, hoac run.bat start de chay that.) else (echo [FAIL] Setup loi - kiem tra mang roi thu lai.)
exit /b %EC%

:do_dev
call :need_npm || exit /b 1
call :need_deps || exit /b 1
echo Dang mo 2 cua so: BE API :3000 va FE Web :5173...
echo De dung: dong cua so tuong ung (hoac Ctrl+C trong do).
start "BE - API :3000" cmd /k "chcp 65001 >nul && npm run dev:server"
timeout /t 2 /nobreak >nul
start "FE - Web :5173" cmd /k "chcp 65001 >nul && npm run dev:client"
echo [OK] Da mo.  Web dev: http://localhost:5173  -  API: http://localhost:3000
exit /b 0

:do_build
call :need_npm || exit /b 1
call :need_deps || exit /b 1
echo Build client production + nen Brotli/Gzip...
call npm run build
set "EC=%ERRORLEVEL%"
if "%EC%"=="0" (echo [OK] Build xong - client\dist da san sang. Chay: run.bat start) else (echo [FAIL] Build loi - xem log ben tren.)
exit /b %EC%

:do_start
call :need_npm || exit /b 1
if not exist "client\dist\index.html" (
    echo [i] Chua co ban build - tu dong build truoc...
    call npm run build
    if errorlevel 1 exit /b 1
)
call :need_deps || exit /b 1
echo Website chay tai http://localhost:3000  (Ctrl+C de dung)
call npm start
exit /b %ERRORLEVEL%
:do_test
call :need_npm || exit /b 1
call :need_deps || exit /b 1
echo Chay toan bo test API backend...
call npm test
set "EC=%ERRORLEVEL%"
if "%EC%"=="0" (echo [OK] Test pass.) else (echo [FAIL] Co test loi - xem log ben tren.)
exit /b %EC%

:do_verify
call :need_npm || exit /b 1
call :need_deps || exit /b 1
echo VERIFY = test + build  (buoc "gate" bat buoc truoc khi release)
call npm run verify
set "EC=%ERRORLEVEL%"
if "%EC%"=="0" (echo [OK] Verify pass - san sang release/deploy.) else (echo [FAIL] Verify loi.)
exit /b %EC%

:do_smoke
call :need_npm || exit /b 1
call :need_deps || exit /b 1
curl -sf -m 3 http://localhost:3000/api/health >nul 2>nul
if errorlevel 1 (
    echo [LOI] Server chua chay tai :3000. Mo terminal khac chay: run.bat start
    exit /b 1
)
call npm run smoke
exit /b %ERRORLEVEL%

:do_deploy
call :need_npm || exit /b 1
call :need_deps || exit /b 1
echo Deploy: test - build - precompress - restart - health check...
call npm run deploy
exit /b %ERRORLEVEL%

:do_crew
set "REQ=%ARG2%"
if "%REQ%"=="" set /p "REQ=Nhap yeu cau cho crew: "
if "%REQ%"=="" (
    echo [LOI] Chua nhap yeu cau. Vi du: run.bat crew "them dia chi FB vao trang About"
    exit /b 1
)
if not exist "crew\.venv\Scripts\python.exe" goto :crew_missing
crew\.venv\Scripts\python.exe crew\crew.py "%REQ%"
exit /b %ERRORLEVEL%

:crew_missing
echo [LOI] Chua cai crew venv. Huong dan (xem crew\README.md):
echo    1. python -m venv crew\.venv
echo    2. crew\.venv\Scripts\pip install -r crew\requirements.txt
echo    3. copy crew\.env.example crew\.env roi dien API key
exit /b 1

:do_clean
echo Dang don dep (an toan - chi xoa file tai tao lai duoc)...
if exist "client\dist\" rd /s /q "client\dist"
if exist "client\node_modules\.vite\" rd /s /q "client\node_modules\.vite"
for /d %%D in ("tools\artifacts\*") do rd /s /q "%%~fD"
for %%F in ("tools\artifacts\*") do if /i not "%%~nxF"==".gitkeep" del /f /q "%%~fF"
del /f /q cur-*.png >nul 2>nul
del /f /q *.log >nul 2>nul
echo [OK] Da don: client\dist, cache Vite, tools\artifacts (giu .gitkeep), log, anh chup goc.
if /i "%ARG2%"=="deep" goto :clean_deep
choice /c YN /n /m "Xoa them node_modules + crew\.venv (khoang 900 MB, phai cai lai)? [y/N] "
if errorlevel 2 exit /b 0

:clean_deep
echo Dang xoa node_modules (client, server, tools) va crew\.venv...
rd /s /q "client\node_modules" 2>nul
rd /s /q "server\node_modules" 2>nul
rd /s /q "tools\node_modules" 2>nul
rd /s /q "crew\.venv" 2>nul
echo [OK] Xong. Chay lai: run.bat setup  (crew: xem crew\README.md)
exit /b 0

rem ------------------------------------------------------------------ menu
:menu
cls
echo ==============================================================
echo    DO CU QUANG HUY  -  TRINH KHOI CHAY NHANH
echo ==============================================================
echo    [1] Cai dat lan dau ............ setup
echo    [2] Chay dev (BE + FE) ......... dev
echo    [3] Build production ........... build
echo    [4] Chay web production ........ start
echo    [5] Test API ................... test
echo    [6] Verify (test + build) ...... verify
echo    [7] Smoke test UI .............. smoke
echo    [8] Deploy ..................... deploy
echo    [9] CrewAI ..................... crew
echo    [10] Don dep file rac .......... clean
echo    [0] Thoat
echo ==============================================================
set "CHOICE="
set /p "CHOICE=Chon chuc nang: " || exit /b 0
if "%CHOICE%"=="" exit /b 0
if "%CHOICE%"=="1"  ( call :do_setup   & goto :menu_end )
if "%CHOICE%"=="2"  ( call :do_dev     & goto :menu_end )
if "%CHOICE%"=="3"  ( call :do_build   & goto :menu_end )
if "%CHOICE%"=="4"  ( call :do_start   & goto :menu_end )
if "%CHOICE%"=="5"  ( call :do_test    & goto :menu_end )
if "%CHOICE%"=="6"  ( call :do_verify  & goto :menu_end )
if "%CHOICE%"=="7"  ( call :do_smoke   & goto :menu_end )
if "%CHOICE%"=="8"  ( call :do_deploy  & goto :menu_end )
if "%CHOICE%"=="9"  ( call :do_crew    & goto :menu_end )
if "%CHOICE%"=="10" ( call :do_clean   & goto :menu_end )
if "%CHOICE%"=="0" exit /b 0
goto :menu

:menu_end
echo.
pause
goto :menu

rem ------------------------------------------------------------------ help
:help
echo run.bat - launcher nhanh cho du an Do Cu Quang Huy (Windows)
echo.
echo   run.bat             mo menu chon
echo   run.bat setup       cai dependencies lan dau (client + server + tools)
echo   run.bat dev         chay dev: BE :3000 + FE :5173 (2 cua so)
echo   run.bat build       build production (Vite + nen Brotli/Gzip)
echo   run.bat start       chay web production :3000 (tu build neu thieu)
echo   run.bat test        chay toan bo test API backend
echo   run.bat verify      gate truoc release: test + build
echo   run.bat smoke       smoke test UI Playwright (can server dang chay)
echo   run.bat deploy      test - build - precompress - restart - health check
echo   run.bat crew "..."  chay CrewAI (vi du: run.bat crew "toi uu trang chu")
echo   run.bat clean       don dep file tam / build / artifacts
echo   run.bat clean deep  don dep them node_modules + crew\.venv (~900 MB)
echo.
echo Ban Linux/macOS/Git Bash: dung run.sh (cu phap tuong tu).
exit /b 0


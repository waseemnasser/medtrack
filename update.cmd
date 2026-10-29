@echo off
rem Pull the team's latest code and install any new libraries (double-click to run).
rem Branch with the latest work. Change it here when the team moves to another branch.
set BRANCH=redesign-bolt

chcp 65001 >nul
cd /d "%~dp0"

echo.
echo [1/4] Fetching updates from GitHub...
git fetch origin || goto fail

echo [2/4] Switching to %BRANCH%...
git switch %BRANCH% || goto changes

echo [3/4] Pulling the latest commits...
git pull --ff-only origin %BRANCH% || goto changes

echo [4/4] Installing libraries (server, then client)...
cd server && call npm install --no-audit --no-fund || goto fail
cd ..\client && call npm install --no-audit --no-fund || goto fail
cd ..

echo.
echo ===== DONE: up to date on %BRANCH% =====
git log --oneline -1
echo Now run "npm run dev" in server and in client.
goto end

:changes
echo.
echo ===== STOPPED: you have local changes that conflict =====
echo See section "problems" in SETUP.md (git stash).
goto end

:fail
echo.
echo ===== FAILED: read the message above and check SETUP.md =====

:end
echo.
pause

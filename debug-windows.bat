@echo off
echo ========================================
echo NEON SNAKE DEBUG TOOL
echo ========================================
echo.

echo 1. Checking if port 3001 is in use...
netstat -ano | findstr :3001
echo.

echo 2. Testing if server responds...
curl -I http://localhost:3001/health
echo.

echo 3. Checking Redis...
docker ps | findstr redis
echo.

echo 4. Starting server in debug mode...
cd server
npx tsx src/server.ts
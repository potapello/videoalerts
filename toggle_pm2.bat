@echo off
chcp 65001 > nul
title PM2 Toggle

pm2 list | findstr "main.*online" > nul && (
    	echo Сервер работает. Останавливаю...
    	pm2 stop main.js
) || (
    	echo Сервер не работает. Запускаю...
    	pm2 start main.js
)

echo Готово!
timeout /t 2 /nobreak > nul
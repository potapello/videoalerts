const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// init create directories
const _logsDir = path.join(__dirname, 'logs'); // create 'logs' folder
if (!fs.existsSync(_logsDir)) {
    fs.mkdirSync(_logsDir);
};
// const _downloadsDir = path.join(__dirname, 'downloads');
// if (!fs.existsSync(_downloadsDir)) {
//     fs.mkdirSync(_downloadsDir);
// };
const _tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(_tempDir)) {
    fs.mkdirSync(_tempDir);
};

//
// ЛОГИРОВАНИЕ (ПЕРЕХВАТОМ ДЕФОЛТ ФУНКЦИЙ)
//

// Создаём потоки для записи
var _logstimezone = 'Europe/Moscow';
var _dateshort = new Date().toLocaleDateString('en-CA', {timeZone: _logstimezone}).replace(/-/g, '_');

const logFile = fs.createWriteStream(path.join(__dirname, `logs/server_${_dateshort}.log`), { flags: 'a' });
const errorFile = fs.createWriteStream(path.join(__dirname, `logs/error_${_dateshort}.log`), { flags: 'a' });

// Перехватываем console.log
console.log = function(...args) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    
    const timestamp = new Date().toLocaleString('sv', { timeZone: _logstimezone });
    const logMessage = `[${timestamp}] [LOG] ${message}\n`;
    
    // Выводим в консоль
    process.stdout.write(logMessage);
    // Записываем в файл
    logFile.write(logMessage);
};

// Перехватываем console.error
console.error = function(...args) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    
    const timestamp = new Date().toLocaleString('sv', {timeZone: _logstimezone});
    const errorMessage = `[${timestamp}] [ERROR] ${message}\n`;
    
    // Выводим в консоль (красным цветом)
    process.stderr.write(`\x1b[31m${errorMessage}\x1b[0m`);
    // Записываем в файл ошибок
    errorFile.write(errorMessage);
    // Также записываем в общий лог
    logFile.write(errorMessage);
};

// Перехватываем console.warn
console.warn = function(...args) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    
    const timestamp = new Date().toLocaleString('sv', {timeZone: _logstimezone});
    const warnMessage = `[${timestamp}] [WARN] ${message}\n`;
    
    // Выводим в консоль (жёлтым цветом)
    process.stdout.write(`\x1b[33m${warnMessage}\x1b[0m`);
    // Записываем в файл
    logFile.write(warnMessage);
};

// Перехватываем console.info
console.info = function(...args) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    
    const timestamp = new Date().toLocaleString('sv', {timeZone: _logstimezone});
    const infoMessage = `[${timestamp}] [INFO] ${message}\n`;
    
    // Выводим в консоль (зелёным цветом)
    process.stdout.write(`\x1b[32m${infoMessage}\x1b[0m`);
    // Записываем в файл
    logFile.write(infoMessage);
};

// Перехватываем необработанные ошибки
process.on('uncaughtException', (error) => {
    const timestamp = new Date().toLocaleString('sv', {timeZone: _logstimezone});
    const errorMessage = `[${timestamp}] [UNCAUGHT] ${error.stack}\n`;
    
    process.stderr.write(`\x1b[31m${errorMessage}\x1b[0m`);
    errorFile.write(errorMessage);
    logFile.write(errorMessage);
    
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const timestamp = new Date().toLocaleString('sv', {timeZone: _logstimezone});
    const errorMessage = `[${timestamp}] [UNHANDLED] ${reason}\n`;
    
    process.stderr.write(`\x1b[31m${errorMessage}\x1b[0m`);
    errorFile.write(errorMessage);
    logFile.write(errorMessage);
});

//
// НАСТРОЙКА СЕРВЕРА
//

const cors = require('cors');

// Или более конкретная настройка:
app.use(cors({
    origin: '*', // Разрешить все источники
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// TWITCH LOGIC

const WebSocket = require('ws');
// const { json } = require('stream/consumers');

const channel = 'potapello';
let ws = null;
let reconnectInterval = 5000; // 5 секунд
let pingInterval = null;

function connect() {
    ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    
    ws.on('open', () => {
        console.info('Connected to Twitch IRC');
        // Используем анонимное подключение
        ws.send('NICK justinfan12345');
        ws.send('USER justinfan12345 8 * :justinfan12345');
        ws.send(`JOIN #${channel}`);
        
        // Отправляем PING каждые 3 минуты для поддержания соединения
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send('PING :tmi.twitch.tv');
            }
        }, 180000); // 3 минуты
    });
    
    ws.on('message', (data) => {
        const message = data.toString();

        if(!message) {console.warn('RAW Message is undefined!'); return};
        if(typeof message != 'string') {console.warn('RAW Message type is not String!'); return};
        
        // Ответ на PING от сервера
        if (message.startsWith('PING')) {
            ws.send('PONG :tmi.twitch.tv');
            return;
        }
        
        // Парсим сообщения PRIVMSG
        if (message.includes('PRIVMSG')) {
            const userMatch = message.match(/@(\w+)\.tmi\.twitch\.tv/);
            const msgMatch = message.match(/PRIVMSG #[^\s]+ :(.*)/);
            
            if (userMatch && msgMatch) {
                const username = userMatch[1];
                const msgText = msgMatch[1];
                twitchMessage(username, msgText);
            }
        }
    });
    
    ws.on('close', () => {
        console.warn(`Twitch IRC connection closed. Reconnecting...`);
        if (pingInterval) clearInterval(pingInterval);
        setTimeout(connect, reconnectInterval);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        ws.close(); // Это вызовет 'close' событие и переподключение
    });
}

// Запускаем подключение
connect();

var _bannedUsers = [
    `username`,
];
var _moderatorUsers = [
    'sosiamba_', 'potapello',
];
//  set to "true" for play any direct link to raw video
var _playRVFUS = false;

function twitchMessage(username, message) {
    // prevent from unknown messages 
    if(!message) {console.warn('Message is undefined!'); return};
    if(typeof message != 'string') {console.warn('Message type is not String!'); return};
    if(message.length < 8) {console.warn('Message length is too short (less than 8)!'); return};
    if(_bannedUsers.indexOf(username) != -1) {return};
    var moderator = _moderatorUsers.indexOf(username) != -1;
    // MEMEALERTS
    if(message.includes('!ma ')) {
        var msgsplit = String(message).split(" ");
        if(msgsplit.length <= 1) {console.warn('Not enough arguments for "!ma" command!'); return};
        var type = 'unknown';
        var modifier = undefined;
        // get type
        if(msgsplit[1].includes("cdns.memealerts.com")) {
            if(msgsplit[1].length < 50) {console.warn('Memealerts link for "!ma" too short!'); return};
            type = 'ma'
        };
        if(msgsplit[1].includes("youtu")) {type = 'yt'};
        if(msgsplit[1].includes('tiktok.com')) {type = 'tt'};
        // collecting modifier info
        if(msgsplit[2]) {
            const _mods = ['pos', 'slower', 'faster', 'rotate', 'speed'];
            if(_mods.indexOf(msgsplit[2]) == -1) {
                console.warn('Unknown videoalert modifier: ' + msgsplit[2])
            } else {
                // pos modifier
                if(msgsplit[2] == 'pos') {
                    if(String(Number(msgsplit[3])) != 'NaN' && String(Number(msgsplit[4])) != 'NaN') {
                        modifier = `pos ${Math.round(msgsplit[3])} ${Math.round(msgsplit[4])}`
                    }
                // speed modifier
                } else if(msgsplit[2] == 'speed') {
                    if(String(Number(msgsplit[3])) != 'NaN') {
                        var speed = Number(msgsplit[3]);
                        speed = speed > 3 ? 3 : speed < 0.25 ? 0.25 : speed;
                        modifier = `speed ${speed}`
                    }
                } else {
                    // another easy modifiers
                    modifier = msgsplit[2]
                }
            }
        };
        // send video to server
        if(type == 'unknown' && _playRVFUS === false) {console.warn('Unknown video source, video will not sended to server!'); return};
        if(type != 'tt') {
            fetchVideo({videoUrl: msgsplit[1], type: type, modifier: modifier})
        } else {
            tiktokWorker(msgsplit[1], modifier)
        };
        // debug
        console.log(`User '${username}' invoke alert -> ${msgsplit[1]} ${modifier ? `|| modifier: ${modifier}` : ''}`)
    }
};
// URL EXAMPLES FOR DEV
// https://cdns.memealerts.com/p/64b955b005b8e6cffec661f2/bb97961c-cdfe-43bf-9564-4e0dcdb6fbd5/alert_orig.webm      MA
// https://www.tiktok.com/@lina7890586/video/7600416319388781856?q=%23girl&t=1773173884591     TT
// https://www.tiktok.com/@kerry_cats/photo/7461971033378131218?_r=1&_t=ZP-94Y2cmhJoul      TTI
// https://youtu.be/oyvMKX_jozg?list=RDoyvMKX_jozg      YT

async function tiktokWorker(url, mods) {
    try {
        var response = await fetch(`https://www.tikwm.com/api/`, {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({url: url})});
        if(!response.ok) {console.error('No connection with TIKWM API!'); return};

        var data = await response.json();
        if(data.code !== 0) {console.error('Error with TIKWM API! (no data / corrupted)'); return};
        if(data.data.is_ad) {console.warn('Fetched TIKWM tiktok is AD, skipped!'); return};

        console.info('Fetched TIKWM tiktok download url!');
        if(data.data.images && data.data.play == data.data.music_info.play) { // images tiktok
            fetchVideo({videoUrl: JSON.stringify(data.data), type: 'tti', modifier: mods})
        } else {
            fetchVideo({videoUrl: data.data.play, type: 'tt', modifier: mods})
        }
    } catch(e) {
        console.error('Error with fetch TIKWM: ', e)
    }
}; 

function fetchVideo(body) {
    fetch('http://localhost:3000/api/runVideo', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
};

// Конфигурация
const PORT = 3000;
const SCREEN_WIDTH = 1920; // размер такой, какой будет в OBS
const SCREEN_HEIGHT = 1080;
const VIDEO_MAX_SIZE = 600; // рандомится от 70% до 100%
const VIDEO_MAX_DURATION = 30000; // в миллисекундах, рандомится от 50% до 100%

// Хранилище активных видео
let activeVideos = [];
// let videoIdCounter = 1;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/temp', express.static(_tempDir));

// Страница для OBS
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'obs-screen.html'));
});

// API для запуска видео
app.post('/api/runVideo', async (req, res) => {
    try {
        const {videoUrl, type, lifetime, affected, effect, modifier} = req.body;
        
        if (!videoUrl) {
            return res.status(400).json({error: 'videoUrl is required'});
        };

        console.log("Received /api/runVideo: " + String(videoUrl).slice(0, 200));
        const videoId = `video_${Date.now()}`;
        
        let width = Math.floor(VIDEO_MAX_SIZE * 0.7 + Math.random() * (VIDEO_MAX_SIZE * 0.3));
        let height = Math.floor(VIDEO_MAX_SIZE * 0.7 + Math.random() * (VIDEO_MAX_SIZE * 0.3));
        
        const top = Math.floor(SCREEN_HEIGHT * 0.05 + Math.random() * ((SCREEN_HEIGHT - VIDEO_MAX_SIZE) * 0.8)); // некоторые легко улетают вниз, поэтому 0.8
        const left = Math.floor(SCREEN_WIDTH * 0.05 + Math.random() * ((SCREEN_WIDTH - VIDEO_MAX_SIZE) * 0.9));
        
        const rotation = (Math.random() * 40) - 20;
        const volume = 1;
        
        const videoData = {
            id: videoId,
            url: videoUrl,
            width,
            height,
            top,
            left,
            rotation,
            volume,
            startTime: Date.now(),
            duration: typeof lifetime == 'number' ? lifetime : Math.floor((VIDEO_MAX_DURATION/2) + (VIDEO_MAX_DURATION/2) * Math.random()),
            affected: affected ? affected : false,
            effect: effect ? effect : 'none',
            type: type ? type : null,
            modifier: modifier,
        };

        // collecting another info
        if (videoData.type == null) {videoData.type = videoGetType(videoData.url)};
        if(videoData.modifier) {videoData.affected = true}; // чтобы эффекты игнорить
        if(!videoData.affected && videoData.effect == 'none') {videoData.effect = videoGetEffect(videoData)};
        
        // Добавляем видео в активные
        activeVideos.push(videoData);
        
        // Отправляем всем подключенным клиентам
        io.emit('videoAdded', videoData);
        
        // Автоматическое удаление через нужное время
        setTimeout(() => {
            removeVideo(videoId);
        }, typeof lifetime == 'number' ? lifetime : VIDEO_MAX_DURATION);
        
        res.json({ 
            success: true, 
            videoId,
            message: `Video will play for ${Math.floor(videoData.duration/1000)} seconds`
        });
        
    } catch (error) {
        console.error('Error running video:', error);
        res.status(500).json({ error: error.message });
    }
});

var _videoeffects = ['row', 'fullscreen', 'longlife', 'slower', 'faster', 'rotate'];
function videoGetEffect(vd) {
    if(vd.affected || vd.isTiktokImage) {return 'none'};
    return Math.random() > 0.25 ? 'none' :  _videoeffects[Math.floor(Math.random() * (_videoeffects.length - 0.001))]
};

function videoGetType(url = '') {
    if(url.includes('{"id":"')) {return 'tti'}; // tiktok images
    if(url.includes('youtu')) {return 'yt'}; // yt & shorts
    if(url.includes('tiktokcdn')) {return 'tt'}; // tt videos
    if(url.includes('memealerts')) {return 'ma'}; // memealerts
    console.warn(`Cannot get video type from this url: "${url}". Returned "ma" type as default.`);
    return 'ma' // it supports all raw videos
};

// API для получения активных видео
app.get('/api/activeVideos', (req, res) => {
    // Фильтруем истекшие видео
    activeVideos = activeVideos.filter(video => {
        return Date.now() - video.startTime < video.duration;
    });
    
    res.json({videos: activeVideos});
});

// API для остановки всех видео
app.post('/api/stopAll', (req, res) => {
    const videoIds = activeVideos.map(v => v.id);
    activeVideos = [];
    io.emit('clearAll');
    res.json({success: true, stopped: videoIds.length});
});

// API для остановки конкретного видео
app.post('/api/stopVideo/:id', (req, res) => {
    const videoId = req.params.id;
    const removed = removeVideo(videoId);
    res.json({ success: !!removed, videoId });
});

// Функция удаления видео
function removeVideo(videoId) {
    const index = activeVideos.findIndex(v => v.id === videoId);
    if (index !== -1) {
        activeVideos.splice(index, 1);
        io.emit('videoRemoved', videoId);
        return true;
    }
    return false;
}

// Socket.io для реального времени
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    // Отправляем текущие активные видео новому клиенту
    socket.emit('init', { 
        videos: activeVideos.filter(v => {
            return Date.now() - v.startTime < v.duration;
        }),
        screen: {width: SCREEN_WIDTH, height: SCREEN_HEIGHT}
    });
    
    socket.on('disconnect', () => {
        console.log(`Client disconnected:' ${socket.id}`);
    });
});

// Очистка старых видео
setInterval(() => {
    const now = Date.now();
    activeVideos = activeVideos.filter(video => {
        if (now - video.startTime >= video.duration) {
            io.emit('videoRemoved', video.id);
            return false;
        }
        return true;
    });
}, 2000);

// API для управления мем пушками на всех подключенных клиентах
app.post('/api/pbShow', (req, res) => {
    io.emit('pbShow');
    res.json({ success: true, message: 'showing PB on all clients' });
});

app.post('/api/pbSetValues', (req, res) => {
    try {
        const { count, total } = req.body;
        if(!total) {return res.status(400).json({ error: 'Total value required!' })};
        if(!count && count!==0) {return res.status(400).json({ error: 'Count value required!' })};

        io.emit('pbSetValues', {count, total});

        res.json({ success: true, message: 'showing PB on all clients' });

    } catch (error) {
        console.error('Error running video:', error);
        res.status(500).json({ error: error.message });
    }
});

// псевдосообщения (типо с твича)
app.post('/api/pseudoMessage', async (req, res) => {
    try {
        const { message, username } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        };
        var user = username ? username : 'TESTER';

        twitchMessage(user, String(message));
        res.json({success: true, message: 'pseudo twitch message sended'})

    } catch(error) {
        console.error('Error send pseudo message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`OBS Screen: http://localhost:${PORT}`);
    console.log(`API endpoint: POST http://localhost:${PORT}/api/runVideo\n`);
});
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

//
// ЛОГИРОВАНИЕ (ПЕРЕХВАТОМ ДЕФОЛТ ФУНКЦИЙ)
//

// Создаём потоки для записи
var _logstimezone = 'Europe/Moscow';
var _dateshort = new Date().toLocaleDateString('en-CA', { timeZone: _logstimezone }).replace(/-/g, '_');

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
    
    const timestamp = new Date().toLocaleString('sv', { timeZone: _logstimezone });
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
    
    const timestamp = new Date().toLocaleString('sv', { timeZone: _logstimezone });
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
    
    const timestamp = new Date().toLocaleString('sv', { timeZone: _logstimezone });
    const infoMessage = `[${timestamp}] [INFO] ${message}\n`;
    
    // Выводим в консоль (зелёным цветом)
    process.stdout.write(`\x1b[32m${infoMessage}\x1b[0m`);
    // Записываем в файл
    logFile.write(infoMessage);
};

// Перехватываем необработанные ошибки
process.on('uncaughtException', (error) => {
    const timestamp = new Date().toLocaleString('sv', { timeZone: _logstimezone });
    const errorMessage = `[${timestamp}] [UNCAUGHT] ${error.stack}\n`;
    
    process.stderr.write(`\x1b[31m${errorMessage}\x1b[0m`);
    errorFile.write(errorMessage);
    logFile.write(errorMessage);
    
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const timestamp = new Date().toLocaleString('sv', { timeZone: _logstimezone });
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

const streamId = null;

let browser, page;
let msgIteration = 0;
let lastMessage = "";

// monitorChat();
// async function monitorChat() {
//     browser = await puppeteer.launch({headless: true});

//     // var aboba = 100
//     // while(aboba>0) {
//     //     var page = await browser.newPage();
//     //     await page.goto('https://gate-dzgas.com/s23');
//     //     await page.click("#age-deny")
//     //     // await page.click("#filter-chat-button")
//     //     aboba--
//     // }

//     page = await browser.newPage();
//     await page.goto('https://gate-dzgas.com/');
//     await page.click("#age-deny");

//     setTimeout(checkChat, 3000)
// };

// TWITCH LOGIC

const WebSocket = require('ws');

const channel = 'potapello';
let ws = null;
let reconnectInterval = 5000; // 5 секунд
let pingInterval = null;

function connect() {
    ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    
    ws.on('open', () => {
        console.log('Connected to Twitch IRC');
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
        console.log(`Connection closed. Reconnecting...`);
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

function twitchMessage(username, message) {
    // https://cdns.memealerts.com/p/64b955b005b8e6cffec661f2/bb97961c-cdfe-43bf-9564-4e0dcdb6fbd5/alert_orig.webm
    // console.log(`${username}: ${message}`);
    // prevent from unknown messages
    if(!message) {console.warn('Message is undefined!'); return};
    if(typeof message != 'string') {console.warn('Message type is not String!'); return};

    // MEMEALERTS
    if(message.includes('!ma')) {
        var msgsplit = String(message).split(" ");
        if(msgsplit.length <= 1) {console.warn('Not enough arguments for "!ma" command!'); return};

        if(msgsplit[1].includes("cdns.memealerts.com") || msgsplit[1].includes("youtu")) {
            // debug for short memealerts link
            if(msgsplit[1].includes("cdns.memealerts.com") && msgsplit[1].length < 80) {console.warn('Memealerts link for "!ma" too short!'); return};
            // fetch video
            console.log(`User '${username}' invoke alert -> ${msgsplit[1]}`);
            fetchVideo(msgsplit[1])
        // TIKTOKS (with api for video download link)
        } else if(msgsplit[1].includes("tiktok.com")) {
            console.log(`User '${username}' invoke alert -> ${msgsplit[1]}`);
            tiktokWorker(msgsplit[1])
        }
    }
};

async function tiktokWorker(url) {
    var response = await fetch(`https://www.tikwm.com/api/`, {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({url: url})});
    if(!response.ok) {console.error('No connection with TIKWM API!'); return};

    var data = await response.json();
    if(data.code !== 0) {console.error('Error with TIKWM API! (no data / corrupted)'); return};
    
    console.log('Fetched TIKWM tiktok download url!');
    fetchVideo(data.data.play)
}; 

// GATE LOGIC

// async function checkChat() {
//         console.clear();
//         console.log("getting messages, iteration:", msgIteration);
//         var selection = await page.$$('div > .message');
//         if(!selection) {return};
//         if(selection.length <= 1) {return};
//         var content = await selection[selection.length-1].$$('div');
//         if(content.length >=2) {
//             var stream = await content[0].evaluate(el => el.textContent, content[0]);
//             var msg = await content[1].evaluate(el => el.textContent, content[1]);
//             var url = await content[1].$('a');
//             // check url
//             var href = false;
//             if(url) {
//                 var href = await url.evaluate(el => el.href, url);
//                 console.log("full first url:", href)
//             };
//             console.log("user message, stream:", stream);
//             console.log("text:", msg);
//             var fullmsg = msg + String(href);
//             // execute commands
//             if(lastMessage != fullmsg) {
//                 lastMessage = String(fullmsg);
//                 // skip, if stream specified
//                 if(streamId == null || streamId == stream) {
//                     if(msg.includes("!ma ", 0)) {
//                         console.log('\nCommand: Meme')
//                         // first text
//                         var msgsplit = msg.split(" ");
//                         // if(msgsplit.length > 1) {
//                         //     console.log('Text:', msgsplit[1])
//                         // };
//                         // first url
//                         if(href) {console.log('URL:', href)};
//                         // request
//                         if(msgsplit.length > 2) {
//                             if(String(Number(msgsplit[2])) != 'NaN') {
//                                 var count = Number(msgsplit[2]);
//                                 count = count <= 0 ? 1 : count > 10 ? 10 : Math.round(count);
//                                 for(let i=0; i<count; i++) {
//                                     setTimeout(() => {
//                                         fetchVideo(href)
//                                     }, 500*i);
//                                 }
//                             } else {
//                                 fetchVideo(href)
//                             }
//                         } else {
//                             fetchVideo(href)
//                         }
//                     }
//                 }
//             }
//         } else {
//             var msg = await content[0].evaluate(el => el.textContent, content[1]);
//             console.log("system message");
//             console.log("text:", msg)
//         };
//         //
//         msgIteration++;
//         setTimeout(() => {checkChat()}, 500);
// };

function fetchVideo(href) {
    fetch('http://localhost:3000/api/runVideo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({videoUrl: href})
    });
};

// Конфигурация
const PORT = 3000;
const SCREEN_WIDTH = 1920; // размер такой, какой будет в OBS
const SCREEN_HEIGHT = 1080;
const VIDEO_MAX_SIZE = 500; // рандомится от 70% до 100%
const VIDEO_MAX_DURATION = 30000; // в миллисекундах

// Хранилище активных видео
let activeVideos = [];
// let videoIdCounter = 1;

// Создаем папку для временных файлов если нет
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/temp', express.static(tempDir));

// Страница для OBS
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'obs-screen.html'));
});

// API для запуска видео
app.post('/api/runVideo', async (req, res) => {
    try {
        const { videoUrl, lifetime, affected } = req.body;
        
        if (!videoUrl) {
            return res.status(400).json({ error: 'videoUrl is required' });
        }

        console.log("Received /api/runVideo: " + String(videoUrl));
        const videoId = `video_${Date.now()}`;
        
        let width = Math.floor(VIDEO_MAX_SIZE * 0.7 + Math.random() * (VIDEO_MAX_SIZE * 0.3));
        let height = Math.floor(VIDEO_MAX_SIZE * 0.7 + Math.random() * (VIDEO_MAX_SIZE * 0.3));
        
        const top = Math.floor(SCREEN_HEIGHT * 0.05 + Math.random() * ((SCREEN_HEIGHT - VIDEO_MAX_SIZE) * 0.9));
        const left = Math.floor(SCREEN_WIDTH * 0.05 + Math.random() * ((SCREEN_WIDTH - VIDEO_MAX_SIZE) * 0.8)); // некоторые легко улетают вниз, поэтому 0.8
        // рандом позиция со смещением к левоверху, птмчт это позиция левоверхн угла видоса
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
            affected: affected || false,
            isYouTube: videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'),
            isTiktok: videoUrl.includes('tiktokcdn'),
            isLocal: videoUrl.startsWith('/')
        };
        
        // Добавляем видео в активные
        // if(!affected) {activeVideos.push(videoData)};
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
            message: `Video will play for ${Math.floor(VIDEO_MAX_DURATION/1000)} seconds`
        });
        
    } catch (error) {
        console.error('Error running video:', error);
        res.status(500).json({ error: error.message });
    }
});

// API для получения активных видео
app.get('/api/activeVideos', (req, res) => {
    // Фильтруем истекшие видео
    activeVideos = activeVideos.filter(video => {
        return Date.now() - video.startTime < video.duration;
    });
    
    res.json({ videos: activeVideos });
});

// API для остановки всех видео
app.post('/api/stopAll', (req, res) => {
    const videoIds = activeVideos.map(v => v.id);
    activeVideos = [];
    io.emit('clearAll');
    res.json({ success: true, stopped: videoIds.length });
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
        screen: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }
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
app.get('/api/pseudoMessage', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        };

        twitchMessage('=TESTER=', String(message))
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
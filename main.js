const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const cfg = require('cfg-lib');
const puppet = require('puppeteer')

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// init create directories
const _logsDir = path.join('./', 'logs'); // create 'logs' folder
if (!fs.existsSync(_logsDir)) {
    fs.mkdirSync(_logsDir);
};
const _tempDir = path.join('./', 'temp');
if (!fs.existsSync(_tempDir)) {
    fs.mkdirSync(_tempDir);
};

//
// ЛОГИРОВАНИЕ (ПЕРЕХВАТОМ ДЕФОЛТ ФУНКЦИЙ)
//
var _options = new cfg.Config('options.cfg');

// Создаём потоки для записи
var _logstimezone = _options.get('logsTimezone');
var _dateshort = new Date().toLocaleDateString('en-CA', {timeZone: _logstimezone}).replace(/-/g, '_');

const logFile = fs.createWriteStream(path.join('./', `logs/server_${_dateshort}.log`), {flags: 'a'});
const errorFile = fs.createWriteStream(path.join('./', `logs/error_${_dateshort}.log`), {flags: 'a'});

// Перехватываем console.log
console.log = function(...args) {
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    
    const timestamp = new Date().toLocaleString('sv', {timeZone: _logstimezone});
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

function logInFileOnly(message) {
    const timestamp = new Date().toLocaleString('sv', {timeZone: _logstimezone});
    logFile.write(`[${timestamp}] [ONLY] ${message}\n`);
};

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

// прочие настройки
var ALLOW_UNKNOWN_SOURCE = Boolean(_options.get('allowUnknownSourceVideos'));
var DISABLE_TIKTOK_ADS = Boolean(_options.get('tiktokDenyAdVideos'));

var SOURCE_ALLOW_MEMEALERTS     = Boolean(_options.get('sourceAllowMemealerts'));
var SOURCE_ALLOW_YOUTUBE        = Boolean(_options.get('sourceAllowYoutubeVideos'));
var SOURCE_ALLOW_SHORTS         = Boolean(_options.get('sourceAllowYoutubeShorts'));
var SOURCE_ALLOW_TIKTOK         = Boolean(_options.get('sourceAllowTiktok'));

var _enabledModifiers = [];
if(_options.get('modifCustomSpeed')) {_enabledModifiers.push('speed')};
if(_options.get('modifEasySpeed')) {_enabledModifiers.push('slower', 'faster')};
if(_options.get('modifAutoRotate')) {_enabledModifiers.push('rotate')};
if(_options.get('modifPosition')) {_enabledModifiers.push('pos')};
if(_options.get('modifHueRotate')) {_enabledModifiers.push('party')};
if(_options.get('modifGrayscale')) {_enabledModifiers.push('cursed')};
if(_options.get('modifStretchWide')) {_enabledModifiers.push('wide')};
if(_options.get('modifStretchTall')) {_enabledModifiers.push('tall')};
if(_options.get('modifInvertColors')) {_enabledModifiers.push('invert')};

var ENABLE_USER_MODIFIERS = Boolean(_options.get('allowModifiers'));
if(_enabledModifiers.length <= 0) {ENABLE_USER_MODIFIERS = false};

//
// STREAM.GATE-DZGAS PROCESS
//

const stream_id = String(_options.get('channelID'));
const READ_GLOBAL_CHAT = Boolean(_options.get('readGlobalChat'));
const READ_CHAT_INTERVAL = Number(_options.get('readChatInterval'));
const PUPPET_HEADLESS = Boolean(_options.get('puppeteerBrowserHeadless'));

var GATE_MSG_ITER = 0;
var GATE_LAST_MESSAGE = '';
var browser, page;

monitorChat();
async function monitorChat() {
    try {
        browser = await puppet.launch({headless: PUPPET_HEADLESS});
        page = await browser.newPage();

        console.log(`Connecting to "stream.gate-dzgas.com", wait...`);
        await page.goto(`https://stream.gate-dzgas.com/`);
        await page.click("#age-deny");

        console.log(`Connected, reading ${READ_GLOBAL_CHAT ? 'global chat' : `messages for s${stream_id}`}.`)
        setTimeout(checkChat, 5000) // time for site preload
    } catch(e) {
        console.error('Error connecting to the site!\n Close app, check internet connection and try again.\nError:', String(e))
    }
};

async function checkChat() {
        var selection = await page.$$('div > .message');
        if(!selection) {return};
        if(selection.length <= 1) {return};
        var content = await selection[selection.length-1].$$('div');
        var color = await selection[selection.length-1].evaluate(el => {return window.getComputedStyle(el).backgroundColor}, selection[selection.length-1]);
        if(content.length >=2) {
            var stream = await content[0].evaluate(el => el.textContent, content[0]); // "s23"
            var msg = await content[1].evaluate(el => el.textContent, content[1]); // "!ma www.tiktok.com party" (url shorted into "a href")
            var url = await content[1].$('a');
            // check url
            var href = false;
            if(url) {
                href = await url.evaluate(el => el.href, url);
            } else {return}; // reason: no url
            // check parts of text content
            var parts = msg.split(' ');
            if(parts.length <= 1) {return}; // reason: not enough args
            // collect clear message
            var fullmsg = `${parts[0]} ${href === false ? '' : String(href)}`;
            // add modifier parts to message, if exists
            if(parts[2]) {fullmsg = fullmsg + ' ' + parts[2]}; // ? modifier name
            if(parts[3]) {fullmsg = fullmsg + ' ' + parts[3]}; // ? X for `pos`, S for `speed`
            if(parts[4]) {fullmsg = fullmsg + ' ' + parts[4]}; // ? Y for `pos`
            // execute commands
            if(GATE_LAST_MESSAGE != fullmsg) {
                if(!READ_GLOBAL_CHAT && stream != `s${stream_id}`) {return}; // reason: reading global chat disabled, current message not from selected chat
                GATE_LAST_MESSAGE = String(fullmsg);
                // console.info('CLEAR MESSAGE:', String(fullmsg));
                twitchMessage(color, String(fullmsg))
            }
        } else {
            var msg = await content[0].evaluate(el => el.textContent, content[1]);
            if(GATE_LAST_MESSAGE != msg) {
                GATE_LAST_MESSAGE = String(msg);
                console.info("System message:", msg);
                if(msg.indexOf('Вы подключились') != -1) {clientShowNotice(READ_GLOBAL_CHAT ? `Подключено к общему чату` : `Подключено к чату s${stream_id}`, '#aaaaff')}
            }
        };
        //
        GATE_MSG_ITER++;
        setTimeout(() => {checkChat()}, READ_CHAT_INTERVAL);
};

//
// MESSAGE WORKER
//

function twitchMessage(color, message) {
    // prevent from unknown messages 
    if(!message) {console.warn('Message is undefined!'); return};
    if(typeof message != 'string') {console.warn('Message type is not String!'); return};
    // MEMEALERTS
    if(message.includes('!ma ')) {
        var msgsplit = String(message).split(" ");
        if(msgsplit.length <= 1) {console.warn('Not enough arguments for "!ma" command!'); return};
        logInFileOnly(`${color}: ${message}`); // всё сообщение напрямую в файл
        var type = 'unknown';
        var modifier = undefined;
        // get type
        if(msgsplit[1].includes("cdns.memealerts.com")) {
            if(!SOURCE_ALLOW_MEMEALERTS) {return};
            if(msgsplit[1].length < 50) {console.warn('Memealerts link for "!ma" too short!'); return};
            type = 'ma'
        };
        if(msgsplit[1].includes("youtu")) {
            if(msgsplit[1].includes('short')) {if(!SOURCE_ALLOW_SHORTS) {return}}
            else {if(!SOURCE_ALLOW_YOUTUBE) {return}};
            type = 'yt'
        };
        if(msgsplit[1].includes('tiktok')) {
            if(!SOURCE_ALLOW_TIKTOK) {return};
            type = 'tt'
        };
        //
        // collecting modifier info
        if(msgsplit[2] && ENABLE_USER_MODIFIERS) {
            if(_enabledModifiers.indexOf(msgsplit[2]) == -1) {
                console.warn('Unknown (or disabled) videoalert modifier: ' + msgsplit[2])
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
        if(type == 'unknown' && ALLOW_UNKNOWN_SOURCE === false) {console.warn('Unknown video source, video will not sended to server!'); return};
        // send video to server
        if(type != 'tt') {
            fetchVideo({videoUrl: msgsplit[1], type: type, modifier: modifier})
        } else {
            tiktokWorker(msgsplit[1], modifier)
        };
        // debug
        console.log(`User '${color}' invoke alert -> ${msgsplit[1]} ${modifier ? `|| modifier: ${modifier}` : ''}`)
    }
};
// URL EXAMPLES FOR DEV
// https://cdns.memealerts.com/p/64b955b005b8e6cffec661f2/bb97961c-cdfe-43bf-9564-4e0dcdb6fbd5/alert_orig.webm      MA rect
// https://cdns.memealerts.com/p/64e10bfe0ea4a111272a89b4/d39c2d23-705d-4b2e-b79c-93004f592eb7/alert_orig.webm      MA album
// https://www.tiktok.com/@kira/video/7608703985515515150     TT   book
// https://www.tiktok.com/@kerry_cats/photo/7461971033378131218?_r=1&_t=ZP-94Y2cmhJoul      TT-images
// https://youtu.be/oyvMKX_jozg      YT
// https://www.dropbox.com/scl/fi/581hu1jc3ircjbofkafas/vclip00.mp4?rlkey=vfwfh9ckdezv131fk0ky4ity1&st=oy3g0uui&dl=1 unknown source example

async function tiktokWorker(url='', mods) {
    try {
        var response = await fetch(`https://www.tikwm.com/api/`, {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({url: url})});
        if(!response.ok) {console.error('No connection with TIKWM API!'); return};

        var data = await response.json();
        if(data.code !== 0) {console.error('Error with TIKWM API! (code != 0)', data); clientShowNotice('Не удалось загрузить Tiktok (неправ. ссылка) :(', '#f95'); return};
        if(data.data.is_ad && DISABLE_TIKTOK_ADS) {console.warn('Fetched TIKWM tiktok is AD, skipped!'); clientShowNotice('Рекламный Tiktok был пропущен.', '#f95'); return};

        console.info('Fetched TIKWM tiktok download url!');
        if(data.data.images && data.data.play == data.data.music_info.play) { // images tiktok
            fetchVideo({videoUrl: JSON.stringify({play: data.data.play, images: data.data.images}), type: 'tti', modifier: mods});
        } else {
            fetchVideo({videoUrl: data.data.play, type: 'tt', modifier: mods});
        };
    } catch(e) {
        console.error('Error with fetch TIKWM: ', e);
        clientShowNotice('Не удалось загрузить Tiktok (неизв. причина) :(', '#f95');
    }
};  

function fetchVideo(body) {
    fetch(`http://localhost:${PORT}/api/runVideo`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
};

// Конфигурация
const PORT = Number(_options.get('port'));
const SCREEN_WIDTH = Number(_options.get('screenWidth'));
const SCREEN_HEIGHT = Number(_options.get('screenHeight'));
const VIDEO_MAX_SIZE = Number(_options.get('videoMaxSize'));
const VIDEO_MAX_DURATION = Number(_options.get('videoMaxDuration'));
const VIDEO_APPLY_ROTATION = Boolean(_options.get('videoApplyRotation'));
const VIDEO_ROTATION_DIAP = Number(_options.get('videoRotationDiap'));

var RANDOMIZE_VIDEO_DURATION = Boolean(_options.get('randomVideoMaxDuration'));
var RANDOMIZE_VIDEO_SIZE = Boolean(_options.get('randomVideoMaxSize'));

// Хранилище активных видео
let activeVideos = [];

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/temp', express.static(_tempDir));

// Страница для OBS
app.get('/', (req, res) => {
    res.sendFile(path.resolve('views', 'obs-screen.html'));
});

// API для запуска видео
app.post('/api/runVideo', async (req, res) => {
    try {
        const {videoUrl, type, lifetime, modifier} = req.body;
        
        if (!videoUrl) {
            return res.status(400).json({error: 'videoUrl is required'});
        };

        console.log("Received /api/runVideo: " + String(videoUrl).slice(0, 200));
        const videoId = `video_${Date.now()}`;
        
        const size = RANDOMIZE_VIDEO_SIZE ? Math.floor(VIDEO_MAX_SIZE * 0.8 + Math.random() * (VIDEO_MAX_SIZE * 0.2)) : VIDEO_MAX_SIZE;
        
        const top = Math.floor(SCREEN_HEIGHT * 0.02 + Math.random() * ((SCREEN_HEIGHT - VIDEO_MAX_SIZE) * 0.96));
        const left = Math.floor(SCREEN_WIDTH * 0.02 + Math.random() * ((SCREEN_WIDTH - VIDEO_MAX_SIZE) * 0.96));
        
        const rotation = VIDEO_APPLY_ROTATION ? (Math.random() * VIDEO_ROTATION_DIAP) - VIDEO_ROTATION_DIAP/2 : 0;

        const duration = typeof lifetime == 'number' ? lifetime :
        RANDOMIZE_VIDEO_DURATION ? Math.floor((VIDEO_MAX_DURATION/2) + (VIDEO_MAX_DURATION/2) * Math.random()) : VIDEO_MAX_DURATION
        
        const videoData = {
            id: videoId,
            url: videoUrl,
            size,
            screenX: SCREEN_WIDTH,
            screenY: SCREEN_HEIGHT,
            top,
            left,
            rotation,
            startTime: Date.now(),
            duration: duration,
            type: type ? type : null,
            modifier: modifier,
        };

        // collecting another info
        if(!videoData.type) {videoData.type = videoGetType(videoData.url)};
        
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

function videoGetType(url = '') {
    if(url.includes('{"id":"')) {return 'tti'}; // tiktok images
    if(url.includes('youtu')) {return 'yt'}; // yt & shorts
    if(url.includes('tiktokcdn')) {return 'tt'}; // tt videos
    if(url.includes('memealerts')) {return 'ma'}; // memealerts
    if(!ALLOW_UNKNOWN_SOURCE) {return false}; // cancel unknown urls
    //
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
        // screen sizes
        screen: {width: SCREEN_WIDTH, height: SCREEN_HEIGHT},
        // videoalert spam goal config
        vasg: {
            enabled: Boolean(_options.get('vasgEnabled')),
            total: Number(_options.get('vasgTotalCount')),
            time: Number(_options.get('vasgSpammingTime')),
            label: String(_options.get('vasgLabelText')),
            saves: Boolean(_options.get('vasgEnableSaves'))
        }
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
}, Number(_options.get('oldVideoRemoverInterval')));

// API для управления мем пушками на всех подключенных клиентах
app.post('/api/pbShow', (req, res) => {
    io.emit('pbShow');
    res.json({success: true, message: 'Showing PB on all connected clients.'});
});

app.post('/api/pbSetValues', (req, res) => {
    try {
        const {count, total} = req.body;
        if(!total) {return res.status(400).json({error: 'Total value required!'})};
        if(!count && count!==0) {return res.status(400).json({error: 'Count value required!'})};

        io.emit('pbSetValues', {count, total});

        res.json({success: true, message: `PB Progress on all connected clients set to: ${count}\\${total}.`});

    } catch (error) {
        console.error('Error running video:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pbClearHistory', (req, res) => {
    io.emit('pbClearHistory');
    res.json({success: true, message: 'Removing PB History on all connected clients.'});
});

// псевдосообщения (типо с твича)
app.post('/api/pseudoMessage', async (req, res) => {
    try {
        const {message, username} = req.body;
        
        if (!message) {
            return res.status(400).json({error: 'message is required'});
        };
        var user = username ? username : 'tester';

        twitchMessage(user, String(message));

        res.json({success: true, message: 'Pseudo-message sended.'})

    } catch(error) {
        console.error('Error send Pseudo-message:', error);
        res.status(500).json({error: error.message});
    }
});

// отправление системных уведомлений клиентам
function clientShowNotice(text, color="#fff") {
    io.emit('showNotice', {text, color});
};

// Запуск сервера
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}\n`);
});
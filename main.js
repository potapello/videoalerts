const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const cfg = require('cfg-lib');
// const { spawn } = require('child_process');

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
var _options = new cfg.Config('options.cfg');

// Создаём потоки для записи
var _logstimezone = _options.get('logsTimezone');
var _dateshort = new Date().toLocaleDateString('en-CA', {timeZone: _logstimezone}).replace(/-/g, '_');

const logFile = fs.createWriteStream(path.join(__dirname, `logs/server_${_dateshort}.log`), {flags: 'a'});
const errorFile = fs.createWriteStream(path.join(__dirname, `logs/error_${_dateshort}.log`), {flags: 'a'});

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
// МЕНЕДЖЕР ФАЙЛОВ
//

class DataStorage {
    constructor(filePath) {
        this.filePath = filePath;
        this.exist = true;
        this.checkFile();
        this.data = '';
    }
    checkFile() {
        // Проверяем существование файла
        if (!fs.existsSync(this.filePath)) {
            try {
                fs.writeFile(this.filePath, new Uint8Array(Buffer.from('{}')), () => {})
            } catch(e) {
                console.error(`Cannot create "${this.filePath}" storage file! Error:`, e);
                this.exist = false;
            }
        }
    }
    saveData(key, data) {
        if(this.exist === false) {return false};
        try {
            // Проверяем существование файла
            var fileContent = {};
            var fileData = fs.readFileSync(this.filePath, {encoding: 'utf-8'});
            if (fileData.trim()) {
                fileContent = JSON.parse(fileData);
            };
            // Добавляем или обновляем запись
            fileContent[key] = JSON.stringify(data);
            // Записываем в файл
            fs.writeFile(this.filePath, new Uint8Array(Buffer.from(JSON.stringify(fileContent))), () => {});
            return true;
        } catch (error) {
            console.error(`Error with saving data to "${this.filePath}":`, error);
            return false;
        }
    }
    findData(key) {
        if(this.exist === false) {return false};
        try {
            // Читаем файл
            var fileData = fs.readFileSync(this.filePath, {encoding: 'utf-8'});
            var fileContent = JSON.parse(fileData);
            // Проверяем наличие ключа
            if (fileContent.hasOwnProperty(key)) {
                return JSON.parse(fileContent[key]);
            }
            return false;
        } catch (error) {
            console.error(`Error with finding data in "${this.filePath}":`, error);
            return false;
        }
    }
};

//
// ЗАПУСК ПРОЦЕССОВ PYTHON
//

// Запускаем Python TTS
// let pythonProcessTTS = spawn('python', ['tts/main.py']);

// let requestIdTTS = 0;
// let pendingRequestsTTS = new Map();

// // Обработка ответов от Python
// pythonProcessTTS.stdout.on('data', (data) => {
//     const lines = data.toString().split('\n');
//     lines.forEach(line => {
//         if (line.trim()) {
//             try {
//                 const response = JSON.parse(line);
//                 // Находим соответствующий запрос
//                 const pending = pendingRequestsTTS.get(response.requestId);
//                 if (pending) {
//                     pending.resolve(response);
//                     pendingRequestsTTS.delete(response.requestId);
//                 }
//             } catch (err) {
//                 console.error('Parse error:', err);
//             }
//         }
//     })
// });
// // Обработка ошибок Python
// pythonProcessTTS.stderr.on('data', (data) => {
//     console.error(`Python error: ${data}`);
// });
// pythonProcessTTS.on('close', (code) => {
//     console.log(`Python process exited with code ${code}`);
// });

// async function requestTTSserver(text) {
//     var requestIdTTS = ++requestIdTTS;
//     var request = {
//         requestId: requestIdTTS, 
//         text: text, 
//         id: String(Date.now()), 
//         speech: 'kseniya'
//     };
    
//     // Создаем Promise для ожидания ответа
//     const responsePromise = new Promise((resolve, reject) => {
//         pendingRequestsTTS.set(requestIdTTS, { resolve, reject });
        
//         // Таймаут на случай зависания
//         setTimeout(() => {
//             if (pendingRequestsTTS.has(requestIdTTS)) {
//                 pendingRequestsTTS.delete(requestIdTTS);
//                 reject(new Error('Request timeout'));
//             }
//         }, 30000);
//     });
    
//     // Отправляем запрос в Python
//     pythonProcessTTS.stdin.write(JSON.stringify(request) + '\n');
    
//     try {
//         const result = await responsePromise;
//         console.error('successful TTS request!', result)
//     } catch (error) {
//         console.error('error with request TTS!', error)
//     }
// };

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
// const { assert } = require('console');

const channel = String(_options.get('channel'));
var GLOBAL_ENABLER = true;
let ws = null;
let reconnectInterval = Number(_options.get('twitchIRCreconnectInterval'));
let pingInterval = Boolean(_options.get('twitchIRCpingInterval'));

function connect() {
    ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    
    ws.on('open', () => {
        console.info('Connected to Twitch IRC');
        setTimeout(() => {clientShowNotice(`Установлено соединение с Twitch чатом.`, '#fc79f8')}, 6000);
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
        clientShowNotice(`Утеряно соединение с Twitch чатом! Переподключение...`, '#fa683c');
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

// ОБРАБОТКА ТАЙМАУТОВ ПОЛЬЗОВАТЕЛЕЙ
var ENABLE_USER_TIMEOUTS = Boolean(_options.get('requestVideoTimeoutUse'));
var USER_TIMEOUT_DURATION = Number(_options.get('requestVideoTimeout'));
var USER_TIMEOUT_MODERATION = Boolean(_options.get('requestVideoTimeoutModeratorsIgnore'));
var _userTimeouts = {};

function updateUserTimeout(username, ismod) {
    // if timeout disabled - skip check
    if(!ENABLE_USER_TIMEOUTS) {return true};
    const _now = Date.now();
    // allow if moder and moderignore enabled
    if(ismod && USER_TIMEOUT_MODERATION) {return true} else {
        // check if havent timeout data
        if(_userTimeouts[username] === undefined) {
            _userTimeouts[username] = _now;
            return true
        } else {
            // check for timeout
            if(_now - _userTimeouts[username] > USER_TIMEOUT_DURATION) {
                _userTimeouts[username] = _now
                return true
            } else {
                console.info(`${username}'s request skipped by timeout: ${Math.round((USER_TIMEOUT_DURATION - (_now - _userTimeouts[username]))/100)/10} s.`)
                return false
            }
        }
    }
};

// получаем списки модераторов, банов
var _bannedUsers = String(_options.get('banlist')).split(',');
var _moderatorUsers = _options.get('moderators').split(',');
_moderatorUsers.push(channel, 'tester'); // auto-add streamer and TESTER-APP

// прочие настройки
var ALLOW_UNKNOWN_SOURCE = Boolean(_options.get('allowUnknownSourceVideos'));
var DISABLE_TIKTOK_ADS = Boolean(_options.get('tiktokDenyAdVideos'));

var SOURCE_ALLOW_MEMEALERTS     = Boolean(_options.get('sourceAllowMemealerts'));
var SOURCE_ALLOW_YOUTUBE        = Boolean(_options.get('sourceAllowYoutubeVideos'));
var SOURCE_ALLOW_SHORTS         = Boolean(_options.get('sourceAllowYoutubeShorts'));
var SOURCE_ALLOW_TIKTOK         = Boolean(_options.get('sourceAllowTiktok'));

var _enabledModifiers = ['effect'];
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

function twitchMessage(username, message) {
    // prevent from unknown messages 
    if(!message) {console.warn('Message is undefined!'); return};
    if(typeof message != 'string') {console.warn('Message type is not String!'); return};
    if(_bannedUsers.indexOf(username) != -1) {return};
    var moderator = _moderatorUsers.indexOf(username) != -1;
    // MEMEALERTS
    if(message.includes('!ma ') && GLOBAL_ENABLER) {
        var msgsplit = String(message).split(" ");
        if(msgsplit.length <= 1) {console.warn('Not enough arguments for "!ma" command!'); return};
        logInFileOnly(`${username}: ${message}`); // всё сообщение напрямую в файл
        var type = 'unknown';
        var modifier = undefined;
        var effect = 'none';
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
                // selecting effect (only for moders)
                } else if(msgsplit[2] == 'effect' && moderator) {
                    if(msgsplit[3]) {
                        if(_videoeffects.indexOf(msgsplit[3]) != -1) {
                            effect = msgsplit[3]
                        }
                    }
                } else {
                    // another easy modifiers
                    modifier = msgsplit[2]
                }
            }
        };
        // send video to server
        if(type == 'unknown' && ALLOW_UNKNOWN_SOURCE === false) {console.warn('Unknown video source, video will not sended to server!'); return};
        // check timeout
        if(!updateUserTimeout(username, moderator)) {return};
        // send video to server
        if(type != 'tt') {
            fetchVideo({videoUrl: msgsplit[1], type: type, modifier: modifier, effect: effect})
        } else {
            tiktokWorker(msgsplit[1], modifier, effect)
        };
        // debug
        console.log(`User '${username}' invoke alert -> ${msgsplit[1]} ${modifier ? `|| modifier: ${modifier}` : ''}`)
    //
    // MODERATOR SERVER CONTROL COMMANDS
    } else if(message.includes('!mod ')) {
        if(!moderator) {return false};
        var msgsplit = String(message).split(" ");
        if(msgsplit.length <= 1) {console.warn('Not enough arguments for "!mod" command!'); return};
        logInFileOnly(`${username}: ${message}`); // всё сообщение напрямую в файл
        // detecting commands
        const _validModCommands = ['rema', 'pb', 'serv'];
        if(msgsplit[1]) {
            if(_validModCommands.indexOf(msgsplit[1]) == -1) {
                console.warn('Unknown moderator server command: ' + msgsplit[1])
            } else {
                if(msgsplit[1] == 'rema') {
                    try {fetch(`http://localhost:${PORT}/api/stopAll`, {method: 'POST'})} 
                    catch(e) {console.warn('Error with moderator command "rema"!', e)} 
                    finally {var _mesg = `Moderator ${username} removed all videos.`; console.info(_mesg); clientShowNotice(_mesg, '#f33')}
                } else if(msgsplit[1] == 'pb') {
                    try {var _body = {count: Number(msgsplit[2]), total: Number(msgsplit[3])};
                        fetch(`http://localhost:${PORT}/api/pbSetValues`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(_body)})}
                    catch(e) {console.warn('Error with moderator command "pb"!', e)}
                    finally {var _mesg = `Moderator ${username} sets PB -> ${msgsplit[2]}/${msgsplit[3]}.`; console.info(_mesg); clientShowNotice(_mesg, '#3f3')}
                } else if(msgsplit[1] == 'serv') {
                    GLOBAL_ENABLER = GLOBAL_ENABLER ? false : true;
                    var _mesg = `Moderator ${username} turn ${GLOBAL_ENABLER ? 'ON' : 'OFF'} all user commands!`;
                    GLOBAL_ENABLER ? console.info(_mesg) : console.warn(_mesg);
                    clientShowNotice(_mesg, GLOBAL_ENABLER ? '#5f5' : '#f55');
                }
            }
        }
    //
    // MODERATOR MESSAGE BOX COMMANDS
    } else if(message.includes('!msg ')) {
        if(!moderator) {return false};
        var msgsplit = String(message).split(" ");
        if(msgsplit.length <= 1) {console.warn('Not enough arguments for "!msg" command!'); return};
        logInFileOnly(`${username}: ${message}`); // всё сообщение напрямую в файл
        // detecting commands
        const _validMsgCommands = ['fast', 'set', 'hide'];
        if(msgsplit[1]) {
            if(_validMsgCommands.indexOf(msgsplit[1]) == -1) {
                console.warn('Unknown moderator msg command: ' + msgsplit[1])
            } else {
                if(msgsplit[1] == 'fast') {if(msgsplit[2]) io.emit('msgBox', {type: 'fast', message: message.substring(10)})} // "!msg fast "
                else if(msgsplit[1] == 'set') {if(msgsplit[2]) io.emit('msgBox', {type: 'set', message: message.substring(9)})}
                else if(msgsplit[1] == 'hide') {io.emit('msgBox', {type: 'hide', message: null})};
            }
        }
    }
    //
    // MODERATOR TTS API COMMANDS
    // else if(message.includes('!tts ')) {
    //     if(!moderator) {return false};
    //     if(message.length < 10) {console.warn('Text for TTS API too short! (canceled)'); return};
    //     logInFileOnly(`${username}: ${message}`); // всё сообщение напрямую в файл
    //     fetchTTS(username, message.substring(5)) // "!tts "
    // }
};
// URL EXAMPLES FOR DEV
// https://cdns.memealerts.com/p/64b955b005b8e6cffec661f2/bb97961c-cdfe-43bf-9564-4e0dcdb6fbd5/alert_orig.webm      MA rect
// https://cdns.memealerts.com/p/64e10bfe0ea4a111272a89b4/d39c2d23-705d-4b2e-b79c-93004f592eb7/alert_orig.webm      MA album
// https://www.tiktok.com/@kira/video/7608703985515515150     TT   book
// https://www.tiktok.com/@kerry_cats/photo/7461971033378131218?_r=1&_t=ZP-94Y2cmhJoul      TTI
// https://youtu.be/oyvMKX_jozg      YT

async function tiktokWorker(url='', mods, effect) {
    try {
        var response = await fetch(`https://www.tikwm.com/api/`, {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({url: url})});
        if(!response.ok) {console.error('No connection with TIKWM API!'); return};

        var data = await response.json();
        if(data.code !== 0) {console.error('Error with TIKWM API! (code != 0)', data); clientShowNotice('Не удалось загрузить Tiktok (неправ. ссылка) :(', '#f95'); return};
        if(data.data.is_ad && DISABLE_TIKTOK_ADS) {console.warn('Fetched TIKWM tiktok is AD, skipped!'); clientShowNotice('Рекламный Tiktok был пропущен.', '#f95'); return};

        console.info('Fetched TIKWM tiktok download url!');
        if(data.data.images && data.data.play == data.data.music_info.play) { // images tiktok
            fetchVideo({videoUrl: JSON.stringify({play: data.data.play, images: data.data.images}), type: 'tti', effect: effect, modifier: mods});
        } else {
            fetchVideo({videoUrl: data.data.play, type: 'tt', effect: effect, modifier: mods});
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

// async function fetchTTS(user, text) {
//     console.info(`TTS by ${user}: ${text}`);
//     // requestTTSserver(text);
//     var response = await fetch('https://streamlined-edge-tts.p.rapidapi.com/tts', {
//         method: 'POST',
//         headers: {
//             "Content-Type": "application/json",
//             'x-rapidapi-key': '',
// 		    'x-rapidapi-host': 'streamlined-edge-tts.p.rapidapi.com',
//         },
//         body: JSON.stringify({
//             text: text,
//             voice: "ru-RU-SvetlanaNeural"
//         })
//     });

//     // читаем ответ
//     if(!response.ok) {console.error('Error with fetch tss api:', response.statusText)};
//     var arrbuffer = await response.arrayBuffer();
//     const audioBase64 = Buffer.from(arrbuffer).toString('base64');

//     // читаем заголовки (чекаем использование квоты)
//     var quota = {
//         limit: response.headers.get("x-ratelimit-requests-limit"),
//         remaining: response.headers.get("x-ratelimit-requests-remaining"),
//         reset: response.headers.get("x-ratelimit-requests-reset")
//     };

//     // Отправляем клиентам через socket.io
//     io.emit("tts", { 
//         audio: audioBase64,
//         text: text,
//         quota: quota,
//         user: user
//     });
// };

// Конфигурация
const PORT = Number(_options.get('port'));
const SCREEN_WIDTH = Number(_options.get('screenWidth'));
const SCREEN_HEIGHT = Number(_options.get('screenHeight'));
const VIDEO_MAX_SIZE = Number(_options.get('videoMaxSize'));
const VIDEO_MAX_DURATION = Number(_options.get('videoMaxDuration'));
const VIDEO_APPLY_ROTATION = Boolean(_options.get('videoApplyRotation'));
const VIDEO_ROTATION_DIAP = Number(_options.get('videoRotationDiap'));

var ENABLE_RANDOM_EFFECTS = Boolean(_options.get('allowRandomEffects'));
var RANDOM_EFFECT_CHANCE =  Number(_options.get('randomEffectChance'));

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
            affected: affected ? affected : false,
            effect: effect ? effect : 'none',
            type: type ? type : null,
            modifier: modifier,
        };

        // collecting another info
        if(!videoData.type) {videoData.type = videoGetType(videoData.url)};
        if(videoData.modifier) {videoData.affected = true}; // чтобы эффекты игнорить
        if(!videoData.affected && videoData.effect == 'none') {videoData.effect = videoGetEffect(videoData)};
        // notice about effect
        if(videoData.effect != 'none') {clientShowNotice(`Случайный эффект: ${videoEffectsNames[videoData.effect]}!`, `#6cecf5`)};
        
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

var _videoeffects = [];
if(_options.get('efctFullscreen')) {_videoeffects.push('fullscreen')};
if(_options.get('efctSpamming')) {_videoeffects.push('row')};
if(_options.get('efctLongLife')) {_videoeffects.push('longlife')};
if(_options.get('efctChangeSpeed')) {_videoeffects.push('slower', 'faster')};
if(_options.get('efctAutoRotate')) {_videoeffects.push('rotate')};
if(_options.get('efctHueRotate')) {_videoeffects.push('party')};
if(_options.get('efctGrayscale')) {_videoeffects.push('cursed')};
if(_videoeffects.length == 0) {ENABLE_RANDOM_EFFECTS = false}; // disable if no enabled effects

function videoGetEffect(vd) {
    if(vd.affected || vd.isTiktokImage || !ENABLE_RANDOM_EFFECTS) {return 'none'};
    var rnd = Math.random(); if(rnd > (RANDOM_EFFECT_CHANCE/100)) {return 'none'}
    else {return _videoeffects[Math.floor(Math.random() * (_videoeffects.length - 0.001))]}
};

const videoEffectsNames = {
    'fullscreen': 'Фулскрин',
    'row': '5-в-ряд',
    'longlife': 'Продление',
    'slower': 'Замедление',
    'faster': 'Ускорение',
    'rotate': 'Вращение',
    'party': 'Вечеринка',
    'cursed': 'Проклятие',
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
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`OBS Screen: http://localhost:${PORT}`);
    console.log(`API endpoint: POST http://localhost:${PORT}/api/runVideo\n`);
});
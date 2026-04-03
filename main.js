const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const cfg = require('cfg-lib');

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
//  @vd LOG INTO FILES
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
//  @vd FILE MANAGER
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
//  @vd SERVER CONFIG
//
const cors = require('cors');

// Или более конкретная настройка:
app.use(cors({
    origin: '*', // Разрешить все источники
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

//  @vd TWITCH LOGIC

const WebSocket = require('ws');
// const { json } = require('stream/consumers');
// const { assert } = require('console');

const channel = _options.get('channel');
var GLOBAL_ENABLER = true;
let ws = null;
let reconnectInterval = _options.get('twitchIRCreconnectInterval');
let pingInterval = _options.get('twitchIRCpingInterval');

let reconnectAttempt = 0;
let reconnectAttemptMax = _options.get('twitchIRCreconnectMax');

function connect() {
    ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    
    ws.on('open', () => {
        console.info('Connected to Twitch IRC');
        setTimeout(() => {clientShowNotice(`Установлено соединение с Twitch чатом.`, '#fc79f8', true)}, 6000);
        reconnectAttempt = 0;
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
        reconnectAttempt += 1;
        if(reconnectAttempt <= reconnectAttemptMax) {
            console.warn(`Twitch IRC connection closed. Reconnecting...`);
            clientShowNotice(`Утеряно соединение с Twitch чатом! Переподключение... (Попытка #${reconnectAttempt})`, '#fa683c', true);
            if (pingInterval) clearInterval(pingInterval);
            setTimeout(connect, reconnectInterval)
        } else {
            if (pingInterval) clearInterval(pingInterval);
            console.error(`Exceeded the number of attempts to connect to Twitch IRC! Check your internet connection and restart server!`);
            clientShowNotice(`Превышено кол-во попыток подключения к Twitch чату!`, '#fa683c', true);
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        ws.close(); // Это вызовет 'close' событие и переподключение
    });
}

// Запускаем подключение
connect();
//
//  @vd MESSAGE CONFIGS
//
var ENABLE_USER_TIMEOUTS = _options.get('requestVideoTimeoutUse');
var USER_TIMEOUT_DURATION = _options.get('requestVideoTimeout');
var USER_TIMEOUT_MODERATION = _options.get('requestVideoTimeoutModeratorsIgnore');
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
var _bannedUsers = _options.get('banlist').split(',');
var _moderatorUsers = _options.get('moderators').split(',');
_moderatorUsers.push(channel, 'tester'); // auto-add streamer and TESTER.HTML

// прочие настройки
const ALLOW_UNKNOWN_SOURCE = _options.get('allowUnknownSourceVideos');
const DISABLE_TIKTOK_ADS = _options.get('tiktokDenyAdVideos');
var LAST_VALERT_TIME = Date.now();

const TTS_RAPIDAPI_KEY = _options.get('apiTTSkey');
const TTS_RAPIDAPI_VOICE = _options.get('apiTTSvoice');

const SOURCE_ALLOW_MEMEALERTS     = _options.get('sourceAllowMemealerts');
const SOURCE_ALLOW_YOUTUBE        = _options.get('sourceAllowYoutubeVideos');
const SOURCE_ALLOW_SHORTS         = _options.get('sourceAllowYoutubeShorts');
const SOURCE_ALLOW_TIKTOK         = _options.get('sourceAllowTiktok');

var _enabledModifiers = [];
var _enabledModifiersRandom = [];
var ENABLE_USER_MODIFIERS = _options.get('allowModifiers');
var RANDOM_MODIFIER_CHANCE = _options.get('randomModifierChance');

if(_options.get('modifCustomSpeed'))    {_enabledModifiers.push('speed')};
if(_options.get('modifEasySpeed'))      {_enabledModifiers.push('slower', 'faster');    _enabledModifiersRandom.push('slower', 'faster')};
if(_options.get('modifAutoRotate'))     {_enabledModifiers.push('rotate');              _enabledModifiersRandom.push('rotate')};
if(_options.get('modifPosition'))       {_enabledModifiers.push('pos')};
if(_options.get('modifHueRotate'))      {_enabledModifiers.push('party');               _enabledModifiersRandom.push('party')};
if(_options.get('modifGrayscale'))      {_enabledModifiers.push('cursed');              _enabledModifiersRandom.push('cursed')};
if(_options.get('modifStretchWide'))    {_enabledModifiers.push('wide');                _enabledModifiersRandom.push('wide')};
if(_options.get('modifStretchTall'))    {_enabledModifiers.push('tall');                _enabledModifiersRandom.push('tall')};
if(_options.get('modifInvertColors'))   {_enabledModifiers.push('invert');              _enabledModifiersRandom.push('invert')};

if(_enabledModifiers.length <= 0) {ENABLE_USER_MODIFIERS = false};
if(_enabledModifiersRandom.length <= 0) {RANDOM_MODIFIER_CHANCE = 0};

const ENABLE_MSG_BOX = _options.get('messageBoxEnabled');
var _messageBoxLastSet = null;
//
//  @vd MESSAGE PARSER
//
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
        // update time & send video to server
        LAST_VALERT_TIME = Date.now();
        if(type != 'tt') {
            apiRunVideo({videoUrl: msgsplit[1], type, modifier})
        } else {
            tiktokWorker(msgsplit[1], modifier)
        };
        // debug
        console.log(`User '${username}' send videoalert -> "${msgsplit[1].length > 32 ? msgsplit[1].substring(0, 30) + '...' : msgsplit[1]}" ${modifier ? `|| modifier: ${modifier}` : ''}`)
    //
    // MODERATOR SERVER CONTROL COMMANDS
    } else if(message.includes('!mod ')) {
        if(!moderator) {return false};
        var msgsplit = String(message).split(" ");
        if(msgsplit.length <= 1) {console.warn('Not enough arguments for "!mod" command!'); return};
        logInFileOnly(`${username}: ${message}`); // всё сообщение напрямую в файл
        // detecting commands
        const _validModCommands = ['rema', 'pb', 'serv', 'timeout'];
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
                } else if(msgsplit[1] == 'timeout') {
                    if(msgsplit[2] == 'off') {
                        ENABLE_USER_TIMEOUTS = false;
                        var _msg = `Moderator ${username} has disable a timeout for requests from all users.`;
                        console.info(_msg); clientShowNotice(_msg, '#7f7');
                    };
                    if(String(+msgsplit[2]) == 'NaN') {return};
                    //
                    ENABLE_USER_TIMEOUTS = true;
                    USER_TIMEOUT_DURATION = +msgsplit[2] * 1000;
                    var _msg = `Moderator ${username} has set a timeout for requests from all users: ${msgsplit[2]} seconds.`;
                    console.info(_msg); clientShowNotice(_msg, '#f77');
                }
            }
        }
    //
    // MODERATOR MESSAGE BOX COMMANDS
    } else if(message.includes('!msg ')) {
        if(!moderator || !ENABLE_MSG_BOX) {return false};
        var msgsplit = String(message).split(" ");
        if(msgsplit.length <= 1) {console.warn('Not enough arguments for "!msg" command!'); return};
        logInFileOnly(`${username}: ${message}`); // всё сообщение напрямую в файл
        // detecting commands
        const _validMsgCommands = ['fast', 'set', 'hide'];
        if(msgsplit[1]) {
            if(_validMsgCommands.indexOf(msgsplit[1]) == -1) {
                console.warn('Unknown moderator msg command: ' + msgsplit[1])
            } else {
                _messageBoxLastSet = null;
                if(msgsplit[1] == 'fast') {
                    if(msgsplit[2]) io.emit('msgBox', {type: 'fast', message: message.substring(10)}) // "!msg fast "
                } else if(msgsplit[1] == 'set') {
                    if(msgsplit[2]) {io.emit('msgBox', {type: 'set', message: message.substring(9)}); _messageBoxLastSet = message.substring(9)}
                } else if(msgsplit[1] == 'hide') {
                    io.emit('msgBox', {type: 'hide', message: null}); _messageBox.action = 'hide';
                }
            }
        }
    //
    // MODERATOR TTS API COMMANDS
    } else if(message.includes('!tts ')) {
        if(!moderator || TTS_RAPIDAPI_KEY == 'none') {return false};
        if(message.length < 10) {console.warn('Text for TTS API too short! (canceled)'); return};
        logInFileOnly(`${username}: ${message}`); // всё сообщение напрямую в файл
        fetchTTS(username, message.substring(5)) // "!tts "
    //
    // COMMAND FOR TESTER.HTML ONLY
    } else if(message.includes('!test ')) {
        var msgsplit = String(message).split(" ");
        if(msgsplit.length <= 1 || username != 'tester') {return};
        logInFileOnly(`tester: ${message}`); // всё сообщение напрямую в файл
        // detect commands
        const _validCommands = ['inact'];
        if(_validCommands.indexOf(msgsplit[1]) == -1) {console.warn('Unknown tester command: ' + msgsplit[1])}
        else {
            if(msgsplit[1] == 'inact') {
                console.warn('TESTING: Random effect by user inactivity.');
                LAST_VALERT_TIME = 0;
                if(msgsplit[2]) {_TESTER_RANDOM_EFFECT = msgsplit[2]};
                waitUserInactivity()
            }
        }
    }
};
// URL EXAMPLES FOR DEV
// https://cdns.memealerts.com/p/64b955b005b8e6cffec661f2/bb97961c-cdfe-43bf-9564-4e0dcdb6fbd5/alert_orig.webm      MA rect
// https://cdns.memealerts.com/p/64e10bfe0ea4a111272a89b4/d39c2d23-705d-4b2e-b79c-93004f592eb7/alert_orig.webm      MA album
// https://www.tiktok.com/@kira/video/7608703985515515150     TT   book
// https://www.tiktok.com/@kerry_cats/photo/7461971033378131218?_r=1&_t=ZP-94Y2cmhJoul      TTI
// https://youtu.be/oyvMKX_jozg      YT

async function tiktokWorker(url='', mods) {
    try {
        var response = await fetch(`https://www.tikwm.com/api/`, {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({url: url})});
        if(!response.ok) {console.error('No connection with TIKWM API!'); return};

        var data = await response.json();
        if(data.code !== 0) {console.error('Error with TIKWM API! (code != 0)', data); clientShowNotice('Не удалось загрузить Tiktok (неправ. ссылка) :(', '#f95', true); return};
        if(data.data.is_ad && DISABLE_TIKTOK_ADS) {console.warn('Fetched TIKWM tiktok is AD, skipped!'); clientShowNotice('Рекламный Tiktok был пропущен.', '#f95', true); return};

        console.info('Fetched TIKWM tiktok download url!');
        if(data.data.images && data.data.play == data.data.music_info.play) { // images tiktok
            apiRunVideo({videoUrl: JSON.stringify({play: data.data.play, images: data.data.images}), type: 'tti', modifier: mods});
        } else {
            apiRunVideo({videoUrl: data.data.play, type: 'tt', modifier: mods});
        };
    } catch(e) {
        console.error('Error with fetch TIKWM: ', e);
        clientShowNotice('Не удалось загрузить Tiktok (неизв. причина) :(', '#f95', true);
    }
};
// TTS FREE API
async function fetchTTS(user, text='') {
    // check text limits
    if(text.length > 1000) {console.warn('TTS: Requested text too long (over 1000 symbols).'); return};
    if(text.split(' ').length > 100) {console.warn('TTS: Requested text too long (over 100 words).'); return};
    //
    console.info(`TTS by ${user}: ${text}`);
    var response = await fetch('https://streamlined-edge-tts.p.rapidapi.com/tts', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            'x-rapidapi-key': TTS_RAPIDAPI_KEY,
		    'x-rapidapi-host': 'streamlined-edge-tts.p.rapidapi.com',
        },
        body: JSON.stringify({
            text: text,
            voice: TTS_RAPIDAPI_VOICE,
        })
    });
    // читаем ответ
    if(!response.ok) {console.error('Error with fetch tss api:', response.statusText)};
    var arrbuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrbuffer).toString('base64');
    // читаем заголовки (чекаем использование квоты)
    var quota = {
        limit: response.headers.get("x-ratelimit-requests-limit"),
        remaining: response.headers.get("x-ratelimit-requests-remaining"),
        reset: response.headers.get("x-ratelimit-requests-reset"),
    };
    // Отправляем клиентам через socket.io
    io.emit("tts", { 
        audio: audioBase64,
        text: text,
        quota: quota,
        user: user,
    })
};
//
//  @vd MIDDLE, VIDEO
//
// Конфигурация
const PORT =                            _options.get('port');
const SCREEN_WIDTH =                    _options.get('screenWidth');
const SCREEN_HEIGHT =                   _options.get('screenHeight');
const VIDEO_MAX_SIZE =                  _options.get('videoMaxSize');
const VIDEO_MAX_DURATION =              _options.get('videoMaxDuration');
const VIDEO_APPLY_ROTATION =            _options.get('videoApplyRotation');
const VIDEO_ROTATION_DIAP =             _options.get('videoRotationDiap');

var RANDOMIZE_VIDEO_DURATION =          _options.get('randomVideoMaxDuration');
var RANDOMIZE_VIDEO_SIZE =              _options.get('randomVideoMaxSize');

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
app.get('/tester/', (req, res) => {
    res.sendFile(path.resolve('views', 'tester.html'));
});

// API для запуска видео
app.post('/api/runVideo', async (req, res) => {
    try {
        var vd = apiRunVideo(req.body);
        //
        res.json({
            success: true, videoId: vd.id,
            message: `Video will play for ${Math.floor(vd.duration/1000)} seconds`
        });
        
    } catch (error) {
        console.error('Error running video:', error);
        res.status(500).json({error: error.message});
    }
});

function apiRunVideo(body = {}) {
    const {videoUrl, type, lifetime, modifier} = body;
        
    if (!videoUrl) {
        throw new Error('apiRunVideo(): videoUrl is required!');
    };
    const id = `video_${Date.now()}_${Math.floor(Math.random()*999999)}`;
    logInFileOnly("Received /api/runVideo: " + String(videoUrl).slice(0, 200));
        
    const size = RANDOMIZE_VIDEO_SIZE ? Math.floor(VIDEO_MAX_SIZE * 0.8 + Math.random() * (VIDEO_MAX_SIZE * 0.2)) : VIDEO_MAX_SIZE;
    const top = Math.floor(SCREEN_HEIGHT * 0.02 + Math.random() * ((SCREEN_HEIGHT - VIDEO_MAX_SIZE) * 0.96));
    const left = Math.floor(SCREEN_WIDTH * 0.02 + Math.random() * ((SCREEN_WIDTH - VIDEO_MAX_SIZE) * 0.96));
    const rotation = VIDEO_APPLY_ROTATION ? (Math.random() * VIDEO_ROTATION_DIAP) - VIDEO_ROTATION_DIAP/2 : 0;

    const duration = typeof lifetime == 'number' ? lifetime :
    RANDOMIZE_VIDEO_DURATION ? Math.floor((VIDEO_MAX_DURATION/2) + (VIDEO_MAX_DURATION/2) * Math.random()) : VIDEO_MAX_DURATION
        
    const videoData = {
        id, url: videoUrl,
        screenX: SCREEN_WIDTH,
        screenY: SCREEN_HEIGHT,
        top, left, rotation, size,
        startTime: Date.now(),
        duration, type, modifier,
    };

    // collecting another info
    if(!videoData.type) {videoData.type = videoGetType(videoData.url)};
    if(!videoData.modifier) {
        videoData.modifier = videoGetRandomModifier(videoData);
        if(videoData.modifier) clientShowNotice(`Случайный модификатор: ${_modifierNames[videoData.modifier]}!`, '#aaf')
    };
        
    // Добавляем видео в активные
    activeVideos.push(videoData);
    // Отправляем всем подключенным клиентам
    io.emit('videoAdded', videoData);
    // Автоматическое удаление через нужное время
    setTimeout(() => {
        removeVideo(id);
    }, typeof lifetime == 'number' ? lifetime : VIDEO_MAX_DURATION);
    //
    return videoData
};
//
//  EFFECTS WORKER
//
var ENABLE_RANDOM_EFFECTS = _options.get('allowRandomEffects');
var RANDOM_EFFECT_WAIT =  _options.get('randomEffectWait');
var _TESTER_RANDOM_EFFECT = false;

const EFCT_ARGS = {
    'fullscreen': _options.get('efctFullscreenDuration'),
    'row': _options.get('efctSpammingCount'),
    'longlife': _options.get('efctLongLifeRange'),
};
// checking args for limits
EFCT_ARGS['fullscreen'] = EFCT_ARGS['fullscreen'] < 10 ? 10 : EFCT_ARGS['fullscreen'] > 120 ? 120 : EFCT_ARGS['fullscreen'];
EFCT_ARGS['row'] = EFCT_ARGS['row'] < 3 ? 3 : EFCT_ARGS['row'] > 16 ? 16 : EFCT_ARGS['row'];
EFCT_ARGS['longlife'] = EFCT_ARGS['longlife'] < 30 ? 30 : EFCT_ARGS['longlife'] > 300 ? 300 : EFCT_ARGS['longlife'];

var _videoeffects = [];
if(_options.get('efctFullscreen')) {_videoeffects.push('fullscreen')};
if(_options.get('efctSpamming')) {_videoeffects.push('row')};
if(_options.get('efctLongLife')) {_videoeffects.push('longlife')};
if(_videoeffects.length <= 0) {ENABLE_RANDOM_EFFECTS = false}; // disable if no enabled effects

function videoGetRandomEffect() {
    var effect = _videoeffects[Math.floor(Math.random() * (_videoeffects.length - 0.001))];
    if(_TESTER_RANDOM_EFFECT) {effect = String(_TESTER_RANDOM_EFFECT); _TESTER_RANDOM_EFFECT=false};
    return {effect, desc: videoEffectsDesc['_'] + videoEffectsDesc[effect], args: EFCT_ARGS[effect]}
};

const videoEffectsDesc = {
    '_': 'На следующий Videoalert будет применён эффект ',
    'fullscreen': `\"Фулскрин\" на ${EFCT_ARGS['fullscreen']} секунд!`,
    'row': `\"Спам\" - он будет отправлен сразу ${EFCT_ARGS['row']} раз!`,
    'longlife': `\"Продление\" - видео будет длиться от ${EFCT_ARGS['longlife'][0]} до ${EFCT_ARGS['longlife'][1]} секунд!`,
};
// waiting for inactivity
function waitUserInactivity() {
    var now = Date.now();
    if((now - LAST_VALERT_TIME) >= RANDOM_EFFECT_WAIT*60000) {
        // inactivity longer than RANDOM_EFFECT_WAIT minutes
        console.log('Starting events due user inactivity...');
        LAST_VALERT_TIME = Date.now();
        if(ENABLE_RANDOM_EFFECTS) {io.emit('setRandomEffect', videoGetRandomEffect())}
    };
    setTimeout(waitUserInactivity, 60000); // check for inactivity every minute
}; setTimeout(waitUserInactivity, 60000);
//
// OTHER
//
function videoGetType(url = '') {
    if(url.includes('{"id":"')) {return 'tti'}; // tiktok images
    if(url.includes('youtu')) {return 'yt'}; // yt & shorts
    if(url.includes('tiktokcdn')) {return 'tt'}; // tt videos
    if(url.includes('memealerts')) {return 'ma'}; // memealerts
    console.warn(`Cannot get video type from this url: "${url}". Returned "ma" type as default.`);
    return 'ma' // it supports all raw videos
};
function videoGetRandomModifier(videoData) {
    if(videoData.type == 'tti' || RANDOM_MODIFIER_CHANCE <= 0) {return null};
    if(Math.random() < RANDOM_MODIFIER_CHANCE/100) {return _enabledModifiersRandom[Math.floor(Math.random() * (_enabledModifiersRandom.length - 0.001))]}
    return null
};
const _modifierNames = {
    slower: 'Замедление',
    faster: 'Ускорение',
    party: 'Вечеринка',
    rotate: 'Вращение',
    cursed: 'Проклятие',
    wide: 'Широкий',
    tall: 'Высокий',
    invert: 'Негатив',
};
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
}, _options.get('oldVideoRemoverInterval'));
//
//  @vd SERVER API
//
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
};

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
            enabled: _options.get('vasgEnabled'),
            total: _options.get('vasgTotalCount'),
            time: _options.get('vasgSpammingTime'),
            label: _options.get('vasgLabelText'),
            saves: _options.get('vasgEnableSaves'),
            intens: _options.get('vasgSpammingIntensivity'),
        },
        // configs
        NOTICE_SYSTEM_DISABLE,
        NOTICE_EVENT_DISABLE,
    });
    
    overlayMarkup();

    if(_messageBoxLastSet && ENABLE_MSG_BOX) {
        socket.emit('msgBox', {type: 'set', message: _messageBoxLastSet})
    };
    
    socket.on('disconnect', () => {
        console.log(`Client disconnected:' ${socket.id}`);
    });
    // RECEIVE REQUESTS FROM CLIENTS
    socket.on('runVideo', data => {
        apiRunVideo(data)
    });
    socket.on('deleteVideo', data => {
        removeVideo(data.id)
    });
});

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
            return res.status(400).json({error: '"message" is required'});
        };
        var user = username ? username : 'tester';

        twitchMessage(user, String(message));

        res.json({success: true, message: 'Pseudo-message sended.'})

    } catch(error) {
        console.error('Error send Pseudo-message:', error);
        res.status(500).json({error: error.message});
    }
});
//
//  @vd NOTICES
//
// отправление системных уведомлений клиентам
const NOTICE_SYSTEM_DISABLE = _options.get('disableSystemNotifications');
const NOTICE_EVENT_DISABLE = _options.get('disableEventNotifications');
function clientShowNotice(text, color="#fff", sys=false) {
    if(sys) {if(NOTICE_SYSTEM_DISABLE) {return}} else {if(NOTICE_EVENT_DISABLE) {return}};
    io.emit('showNotice', {text, color});
};

// разметка элементов оверлея
const MARKUP_MSG_ANCHOR = _options.get('markMessageBoxAnchor');
const MARKUP_MSG_OFFSET = _options.get('markMessageBoxOffset');
const MARKUP_VSG_ANCHOR = _options.get('markSpamGoalAnchor');
const MARKUP_VSG_OFFSET = _options.get('markSpamGoalOffset');
const MARKUP_NOTICE_ANCHOR = _options.get('markNotificationsAnchor');
const MARKUP_NOTICE_OFFSET = _options.get('markNotificationsOffset');
const MARKUP_NOTICE_EFFECT_ANCHOR = _options.get('markRandomEffectAnchor');
const MARKUP_NOTICE_EFFECT_OFFSET = _options.get('markRandomEffectOffset');

function overlayMarkup() {
    // message-box, notice-container, pb-progress-container, notice-effect
    io.emit('markup', {element: 'message-box', corner: MARKUP_MSG_ANCHOR, offset: MARKUP_MSG_OFFSET});
    io.emit('markup', {element: 'pb-progress-container', corner: MARKUP_VSG_ANCHOR, offset: MARKUP_VSG_OFFSET});
    io.emit('markup', {element: 'notice-container', corner: MARKUP_NOTICE_ANCHOR, offset: MARKUP_NOTICE_OFFSET});
    io.emit('markup', {element: 'notice-effect', corner: MARKUP_NOTICE_EFFECT_ANCHOR, offset: MARKUP_NOTICE_EFFECT_OFFSET});
};
//  @vd SERVER START
//
// Запуск сервера
const LOCAL_NETWORK_ADDRESS = _options.get('localNetworkAddress');
const APP_CONSOLE_DESC = `Videoalerts 0.7.1 beta\nNode.js server (express, socket.io) | Build using Bun | by potapello`; // @rel
//
if(LOCAL_NETWORK_ADDRESS) {
    server.listen(PORT, '0.0.0.0', () => {
        console.info(APP_CONSOLE_DESC);
        console.log(`Server running on: http://localhost:${PORT}`);

        // Получаем IP в локальной сети
        const networkInterfaces = require('os').networkInterfaces();
        Object.values(networkInterfaces).forEach(interfaces => {
            interfaces.forEach(iface => {
                if (iface.family === 'IPv4' && !iface.internal && iface.address.indexOf('192.168.') != -1) {
                    console.log(`Local network address: http://${iface.address}:${PORT}\n`);
                }
            })
        })
    })
} else {
    server.listen(PORT, () => {
        console.info(APP_CONSOLE_DESC);
        console.log(`Server running on: http://localhost:${PORT}\n`);
    })
}
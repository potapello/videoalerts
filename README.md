# Videoalerts

*The project is under development! At the moment, it is posted here solely for development purposes and it won't be possible to use it as intended!*

[ВЕРСИЯ НА РУССКОМ ЯЗЫКЕ](https://github.com/potapello/videoalerts/wiki/README-(Русский))

## HOW TO START
1. Install **Node.js** (at least 24.12.0 LTS)
2. Download Videoalerts repository as **ZIP** and extract
3. Go to extracted Videoalerts folder, open `cmd` (Shift+RMB in folder > "Open Command Prompt") and run `npm install`

After installing node modules, you need config server

1. Open file **"options.cfg"**, here you can configure server. (After any changes to the **"options.cfg"**, you need to restart the server)
2. Find **"channel"** and write your (or streamer) Twitch login. You also can configure your **"moderators"** and other settings (All usernames should be written in lowercase!)
3. Try to launch **"start.bat"**

If server is working, need to setup client in OBS and test

1. Open **OBS**, add **Browser** source to your scene with url = `http://localhost:3000`. Place the **Browser** in the hierarchy above the capture of the game or screen, this way the alerts will be visible.
2. Set size to 1920x1080 (default size). You can use a different size, but first you need to specify it in the **"options.cfg"**.
3. Add **Color Key** filter for **Browser**, change color to `#00ff00` or `Green`, the green background (if he was) should disappear
5. Open your Twitch chat and use "!ma" command for videoalert (Guides for commands below)
6. Check OBS, your videoalert should appear
7. I recommend routing the **Browser** source audio to a separate mixer channel and setting it to about **-10dB** (to listen, set "Listening and output" mode for mixer)
8. In the "public" folder you can find the tester **"tester.html"**, you can run it in your browser. In it, you can test the server and control videoalerts.

You need to Update **Browser** source with videoalerts after startup videoalert server at each OBS startup!

> **If you have issues with starting server, open an issue on GitHub or contact me directly! (TG: @potapell0)**

## HOW TO USE COMMANDS

### Command `!ma <url> [modifier]` (all users)

`<url>` required. This is the link to the video for videoalert. By default, you can send the following links:
- Memealerts `cdns.memealerts.com` (you can get it on the https://memealerts.com/ website by clicking RMB on the video and copying the direct link)
- Youtube videos & shorts `youtube.com, youtu.be`
- Tiktok videos & images `tiktok.com`

You can also allow sending direct links to videos from any source (set **allowUnknownSourceVideos=true** in **options.cfg**). Not recommended!!!

`[?modifier]` optional. Users can apply modifiers on videoalerts. List of modifiers:
- `pos [x] [y]` sets position for videoalert
- `rotate` video will rotate
- `faster`, `slower` sets playback rate **(x1.5 and x0.7)**
- `speed [x]` sets custom playback rate, range -> **[0.25; 3.0]**
- `party` infinite color changing (hue-rotate) and shaking
- `cursed` video will be grayscale
- `wide`, `tall` extends videoalert width/height
- `invert` invert colors of videoalerts

Moderators can also send an effect as a modifier:

- `effect longlife` the video will "live" on the server longer (random time from 60 to 120 seconds)
- `effect fullscreen` fullscreen videoalert for short time **(~12 seconds)**
- `effect row` there will be 5 copies of videoalert running in a row instead of one

### Command `!mod <action> [args]` (only for moderators)

`<action>` required. The action to be performed:

- `rema` removes all videos from server
- `pb [x] [y]` sets VideoCannon event **count\total** values to **X\Y**
- `serv` enables/disables `!ma` command for all users

### Command `!msg <mode> [text]` (only for moderators)

Showing message for viewers on screen, on top left corner. 
It can be used by moderators for such messages: **Streamer has gone to eat :)**, **Watching "Kill la Kill", Episode 3** etc.

`<mode>` required, can be:
- `fast [text]` message will appear for a while, up to 30 seconds, depending on its length
- `set [text]` shows/updates the message, it doesn't disappear by itself
- `hide` hides all types of messages

## TODO

- Server stability, add more comments in code for devs
- Write better `README`, detailed, clear, and about everything
- Add support for `stream.gate-dzgas` platform (as alternative build)
- Maybe, add support for another streaming platforms
- Add the ability to change some configurations for moderators (for one server session)
- Decide what to do with the effects (maybe I'll leave only the modifiers)

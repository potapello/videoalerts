# Videoalerts
**by potapello**

*The project is under development! At the moment, it is posted here solely for development purposes and it won't be possible to use it as intended!*

[ВЕРСИЯ НА РУССКОМ ЯЗЫКЕ](https://github.com/potapello/videoalerts/wiki/README-(Русский))

## HOW TO START
1. Install **Node.js** (at least 24.12.0 LTS)
2. Download **ZIP** and extract
3. Go to extracted folder and run `npm install`

After installing node modules, you need config server

1. Open file **"options.cfg"**, here you can configure server
2. Find **"channel"** and write your (or streamer) Twitch login. You also can configure your **"moderators"**
3. Try to launch **"start.bat"**

If server is working, need to setup client in OBS and test

1. Open **OBS**, add **Browser** source to your scene with url = `http://locahost:3000`
2. Set size to 1920x1080 (default size). You can use a different size, but first you need to specify it in the **"options.cfg"**.
3. Add **Color Key** filter for **Browser**, change color to `#ff0000`
4. The green background should disappear
5. Open your Twitch chat and use "!ma" command for videoalert
6. Check OBS, your videoalert should appear
7. I recommend routing the **Browser** source audio to a separate mixer channel and setting it to about **-10dB**

> **If you have issues with starting server, open an issue on GitHub or contact me directly!**

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

Moderators can also send an effect as a modifier:

- `effect longlife` the video will "live" on the server longer (random time from 60 to 120 seconds)
- `effect fullscreen` fullscreen videoalert for short time **(~12 seconds)**
- `effect row` there will be 5 copies of videoalert running in a row instead of one

### Command `!mod <action> [args]` (only for moderators)

`<action>` required. The action to be performed:

- `rema` removes all videos from server
- `pb [x] [y]` sets VideoCannon event **count\total** values to **X\Y**
- `serv` enables/disables `!ma` command for all users

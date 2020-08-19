<img src="http://i.imgur.com/M9TvvSy.png" alt="clive-mascot" width=64px />

## ☝️ That's Clive

He's a very simple bot that monitors Twitch chat for clips and auto-posts them to Discord.

_**Like this!**_

<img src="https://i.imgur.com/N1CFDLD.png" title="Rich Discord Example" />

He runs on a diet of [nodejs](https://nodejs.org/en/) and [twitch-js](https://twitch-js.netlify.app/). He needs to live on a server (Like an [Amazon EC2 instance](https://aws.amazon.com/getting-started/tutorials/launch-a-virtual-machine/)). I use a [Pocket C.H.I.P.](https://getchip.com/pages/pocketchip) to host Clive.

**Some assembly required (it helps to be familiar with node).**

## 🤖 Instructions (OSX/Linux)

Before starting, make sure [nodejs](https://nodejs.org/en/download/) v12 or later is installed. You will also need a [webhook](https://support.discordapp.com/hc/en-us/articles/228383668-Intro-to-Webhooks) for the Discord channel where these clips will be posted.

1. Open terminal.
2. Navigate to a directory (like `~/Developer`).
3. Run `git clone https://github.com/mangosango/Clive.git && cd Clive`.
4. Run `npm install`
5. Copy `.env-example` to `.env`\*
6. Open `.env` in a text editor (like [atom](https://atom.io/)).
7. Refer to the settings flags below.
8. Save `.env`.
9. In terminal, run `npm start`.
10. ???
11. Profit.

\* **.env file is primarily for development and debugging.** Environment variables are preferred for production environment. _To use environment variables, you can set all the flags below. `TWITCH_CHANNELS` should be a space limited set of `channel_name`s. You can set these in the provided `clive.service` file, or by using the `export` command. Here's a [short guide](http://blog.mdda.net/oss/2015/02/16/forever-node-service-systemd). on how to use systemd._

### 🚩 Settings Flags

`SETTING_NAME` (required or optional to be set) \[default production setting]

- `NODE_ENV` (optional) \[production]
  - Set to dev for development or production for normal usage
- `LOG_LEVEL` (optional) \[error]
  - Set to which level of logging you'd like. `debug` is good for development. `info` or `error` is good for normal usage. Checkout [Winston](https://github.com/winstonjs/winston#logging-levels) for more info.
- `LOG_FILE` (required) \[/var/log/clive.log]
  - Set this to the location of where you would like a log file. Make sure Clive has write permissions!
- **`DB_FILE` (required)** \[db.json]
  - Set this to the location of your JSON db file. If running as a service make sure to use the absolute file path.
- **`DISCORD_WEBHOOK_URL` (required)**
  - Set this to your Discord webhook for the channel you want Clive to post in! [Discord webhook URL](http://i.imgur.com/sEUCxct.png)
- **`TWITCH_CHANNELS` (required)**
  - Set the channels you want Clive to monitor for clips. These are also used for `RESTRICT_CHANNELS` If you wanted to watch for clips in `Monstercat`'s chat, you would use `"monstercat"`. If you wanted to monitor multiple channels, you would use `"monstercat mrchowderclam updownleftdie"`.
- `TWITCH_CLIENT_ID` (optional, suggested) \[null]
  - Needed for Twitch API functionality. This allows Clive to get more data about the clip for its messages! More info: [Twitch Dev Getting Started](https://dev.twitch.tv/get-started)
- `TWITCH_CLIENT_SECRET` (optional, suggested) \[null]
  - Needed along with the client ID for Twitch API functionality. This allows Clive to get more data about the clip for its messages! More info: [Twitch Dev Getting Started](https://dev.twitch.tv/get-started)
- `RESTRICT_CHANNELS` (optional) \[true]
  - **REQUIRES**: `TWITCH_CLIENT_ID` to be set. If true, only shares clips that are listed in `TWITCH_CHANNELS`.
- `MODS_ONLY` (optional) \[false]
  - If true, only allows mods to post clips.
- `SUBS_ONLY` (optional) \[false]
  - If true, only allows subscribers to post clips.
- `BROADCASTER_ONLY` (optional) \[false]
  - If true, only allows the broadcaster to post clips. **NOTE**: broadcaster is **not** considered a mod by default on Twitch.
- `RICH_EMBED` (optional) \[true]

  - **REQUIRES**: `TWICH_CLIENT_ID` to be set. If true will post two messages to Discord the first being the video and the second being a rich embed box that contains more information about the clip. Two separate messages are necessary because Discord doesn't allow setting `video` element inside of the rich embed object.

`MODS_ONLY`, `SUBS_ONLY`, and `BROADCASTER_ONLY` can be combined. Example: turning all `BROADCASTER_ONLY` and `SUBS_ONLY` will only share clips posted by those two groups. All three set to `false` on means anyone can post a clip link. Be careful if you are not using a `TWITCH_CLIENT_ID` AND `RESTRICT_CHANNELS` or else ANY clips will be shared to your Discord.

## 📋 Todo

- Having a UI or hosting this somewhere would be nice.
- Make clive an actual Discord bot, but that would require actual work lol.
- ~~Option to only send clips of a certain channel or channels.~~
- ~~Option to only send clips posted by broadcaster, mods, or subs.~~
- ~~Set the `DISCORD_WEBHOOK_URL` to pull from an evar or something.~~
- ~~Track previously posted twitch clips~~
- ~~Use Discord Rich Embed messages~~
- ~~MFW the Readme is bigger than the app LUL~~

## 👯 Contributing

1. Create your own feature branch (using `git checkout -b ...` or whatever you want to use).
2. Write some nice code. Commit it! Push it!
3. Use Github's excellent pull request feature to submit a PR.
4. Someone will review your PR and merge to master!
5. Yay.

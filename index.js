'use strict';
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}
// Imports
const _ = require('lodash');
const FileSync = require('lowdb/adapters/FileSync');
const lowdb = require('lowdb');
const request = require('request-promise');
const tmi = require('tmi.js');
const URI = require('urijs');
const { createLogger, format, transports } = require('winston');

//Initialize constants
const DISCORD_WEBHOOK_URL = _.get(process, 'env.DISCORD_WEBHOOK_URL');
const TWITCH_CHANNELS = generateChannelList(
  _.get(process, 'env.TWITCH_CHANNELS'),
);
const DB_FILE = _.get(process, 'env.DB_FILE') || 'db.json';
const TWITCH_CLIENT_ID = _.get(process, 'env.TWITCH_CLIENT_ID') || null;
const RESTRICT_CHANNELS = _.get(process, 'env.RESTRICT_CHANNELS') || true;
const BROADCASTER_ONLY =
  _.get(process, 'env.BROADCASTER_ONLY') === 'true' || false;
const MODS_ONLY = _.get(process, 'env.MODS_ONLY') === 'true' || false;
const SUBS_ONLY = _.get(process, 'env.SUBS_ONLY') === 'true' || false;

//Initialize logger
const logger = createLogger({
  level: _.get(process, 'env.LOG_LEVEL') || 'error',
  format: format.combine(format.timestamp(), format.prettyPrint()),
  transports: [
    // - Write to all logs with level `info` and below to `clive.log`
    new transports.File({
      filename: _.get(process, 'env.LOG_FILE') || 'clive.log',
    }),
  ],
});
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.simple(),
    }),
  );
}

// If we have a twitch client ID and you want to restrict postings of clips to only those channels Clive is watching
// Do a one-time lookup of twitch login names to IDs
let TWITCH_CHANNEL_IDS = [];
if (TWITCH_CLIENT_ID && RESTRICT_CHANNELS) {
  resolveTwitchUsernamesToIds(TWITCH_CHANNELS).then(userIds => {
    TWITCH_CHANNEL_IDS = userIds;
    logStartInfo();
  });
} else {
  logStartInfo();
}

const adapter = new FileSync(DB_FILE);
const db = lowdb(adapter);
db.defaults({ postedClipIds: [] }).write();

function logStartInfo() {
  logger.log('info', 'CONFIG SETTINGS:\n', {
    DISCORD_WEBHOOK_URL,
    DB_FILE,
    TWITCH_CHANNELS,
    TWITCH_CHANNEL_IDS,
    RESTRICT_CHANNELS,
    BROADCASTER_ONLY,
    MODS_ONLY,
    SUBS_ONLY,
  });
  logger.log(
    'info',
    `Twitch Client ID is ${TWITCH_CLIENT_ID ? '' : 'NOT '}set`,
  );

  createTmiClient();
}

function createTmiClient() {
  const tmiOptions = {
    options: {
      debug: _.get(process, 'env.LOG_LEVEL') === 'debug' || false,
    },
    connection: {
      reconnect: true,
    },
    channels: TWITCH_CHANNELS,
  };

  const client = new tmi.client(tmiOptions);

  // Check messages that are posted in twitch chat
  client.on('message', (channel, userstate, message, self) => {
    const debugMessage = {
      channel,
      userstate,
      message,
    };
    logger.log('debug', 'NEW MESSAGE:\n', debugMessage);

    // Don't listen to my own messages..
    if (self) return;
    // Broadcaster only mode
    const isBroadcaster = userstate['badges'].broadcaster === '1';
    if (BROADCASTER_ONLY && !isBroadcaster) {
      logger.log('info', `NON-BROADCASTER posted a clip: ${message}`);
      return;
    }
    // Mods only mode
    if (MODS_ONLY && !(userstate['mod'] || isBroadcaster)) {
      logger.log('info', `NON-MOD posted a clip: ${message}`);
      return;
    }
    // Subs only mode
    if (SUBS_ONLY && !userstate['subscriber']) {
      logger.log('info', `NON-SUB posted a clip: ${message}`);
      return;
    }

    // Handle different message types..
    switch (userstate['message-type']) {
      case 'action':
        // This is an action message..
        break;
      case 'chat':
        if (message.indexOf('clips.twitch.tv/') !== -1) {
          logger.log('debug', `CLIP DETECTED: in message: ${message}`);
          const clipId = getUrlSlug(message);
          // check if its this clip has already been shared
          const postedClip = chceckDbForClip(clipId);
          if (postedClip) {
            logger.log(
              'info',
              `PREVIOUSLY SHARED CLIP: ${clipId} was pushed to Discord on ${new Date(
                postedClip.date,
              )}`,
            );
            return;
          }
          // If we have a client ID we can use the Twitch API
          if (TWITCH_CLIENT_ID) {
            postUsingTwitchAPI(clipId);
          } else {
            // Fallback to dumb method of posting
            postUsingMessageInfo({ clipId, message, userstate });
          }
        }
        break;
      case 'whisper':
        // This is a whisper..
        break;
      default:
        // Something else ?
        break;
    }
  });

  // Connect the client to the server..
  client.connect();
}

function postUsingTwitchAPI(clipId) {
  twitchApiGetCall('clips', clipId).then(clipInfo => {
    logger.log('debug', 'Twitch clip results:', clipInfo);

    if (
      RESTRICT_CHANNELS &&
      TWITCH_CHANNEL_IDS.indexOf(clipInfo.broadcaster_id) === -1
    ) {
      logger.log('info', 'OUTSIDER CLIP: Posted in chat from tracked channel');
      return;
    }

    Promise.all([
      twitchApiGetCall('users', clipInfo.creator_id),
      twitchApiGetCall('games', clipInfo.game_id),
    ]).then(results => {
      logger.log('debug', 'Async results:', results);
      postToDiscord({
        displayName: results[0].display_name,
        gameName: results[1].name,
        clipInfo,
      });
    });
  });
}

function postUsingMessageInfo({ clipId, message, userstate }) {
  // Reform legacy message to fit string template
  postToDiscord({
    displayName: userstate['display-name'],
    gameName: 'the last stream',
    clipInfo: {
      title: message,
      url: '',
      id: clipId,
    },
  });

function getUrlSlug(message) {
  // split message by spaces, then filter out anything that's not a twitch clip
  const urls = _.filter(_.split(message, ' '), messagePart => {
    return messagePart.indexOf('clips.twitch.tv/') !== -1;
  });
  logger.log('debug', `URLs FOUND: ${urls.length} urls: `, urls);
  if (urls.length < 1) {
    logger.log('error', 'ERROR: no urls found in message', message);
    return;
  }

  const path = URI(urls[0]).path();
  const clipId = path.replace('/', '');
  if (!path || !clipId) {
    logger.log('error', `MALFORMED URL: ${urls[0]}`);
    return;
  }
  logger.log('debug', `CLIP SLUG: ${clipId}`);
  return clipId;
}

function chceckDbForClip(clipId) {
  return db
    .get('postedClipIds')
    .find({ id: clipId })
    .value();
}

function insertClipIdToDb(clipId) {
  db
    .get('postedClipIds')
    .push({ id: clipId, date: Date.now() })
    .write();
}

async function twitchApiGetCall(endpoint, id) {
  if (!TWITCH_CLIENT_ID) return;
  const options = {
    uri: `https://api.twitch.tv/helix/${endpoint}`,
    qs: {
      id: id,
    },
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
    },
    json: true,
  };
  logger.log('info', `GET: /${endpoint}?id=${id}`);
  try {
    const response = await request(options);
    return response.data[0];
  } catch (err) {
    logger.log('error', `ERROR: GET twitch API /${endpoint}:`, err);
    return;
  }
}

async function resolveTwitchUsernamesToIds(usernames) {
  if (!TWITCH_CLIENT_ID) return [];

  const usernameFuncs = usernames.map(async username => {
    const options = {
      uri: `https://api.twitch.tv/helix/users`,
      qs: {
        login: username.replace('#', ''),
      },
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
      },
      json: true,
    };
    logger.log('info', `GET: /users?login=${username}`);
    try {
      const response = await request(options);
      request(options);
      return response.data[0].id;
    } catch (err) {
      logger.log('error', `ERROR: GET twitch API /users:`, err);
      return;
    }
  });
  return await Promise.all(usernameFuncs).then(userIds => userIds);
}

function postToDiscord({ displayName, gameName, clipInfo }) {
  request.post(
    DISCORD_WEBHOOK_URL,
    {
      json: {
        content: `**${displayName}** posted a clip during ${gameName}: *${
          clipInfo.title
        }*\n${clipInfo.url}`,
        username: 'Clive',
        avatar_url: 'http://i.imgur.com/9s3TBNv.png',
      },
    },
    (error, response, body) => {
      if (error) {
        logger.log('error', 'ERROR: posting to Discord', response, body);
      } else if (response.statusCode === 204) {
        insertClipIdToDb(clipInfo.id);
      }
    },
  );
}

// Takes space-separated string of twitch channels parses them, adds a # prefix, and puts them into an array
function generateChannelList(channelsString) {
  let channelArray = _.split(channelsString, ' ');

  return channelArray.map(channel => {
    return `#${channel.toLowerCase()}`;
  });
}

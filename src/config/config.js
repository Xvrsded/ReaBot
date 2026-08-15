require('dotenv').config();

const config = {
  // Discord Bot
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',

  // Database
  mongoUri: process.env.MONGODB_URI || '',

  channels: {
    welcome: null,
    verification: '1537851584246190120',
    rules: '1537773734704709652',
    streamerRegistration: '1537927009747996752',
    streamingNotification: '1537882839956070400',
    eventNotification: null
  },

  roles: {
    member: '1537781352055967754',
    streamer: '1537878549036408903'
  }
};

module.exports = config;

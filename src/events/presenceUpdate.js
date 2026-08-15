const { Events } = require('discord.js');
const { handlePresenceUpdate } = require('../services/streamingService');

module.exports = {
  name: Events.PresenceUpdate,
  async execute(oldPresence, newPresence) {
    await handlePresenceUpdate(oldPresence, newPresence);
  }
};

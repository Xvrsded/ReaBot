const { Events } = require('discord.js');
const { handleScheduledEventUpdate } = require('../services/eventNotificationService');

module.exports = {
  name: Events.GuildScheduledEventUpdate,
  async execute(oldEvent, newEvent) {
    await handleScheduledEventUpdate(oldEvent, newEvent);
  }
};

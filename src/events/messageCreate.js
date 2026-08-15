const { Events } = require('discord.js');
const UserActivity = require('../models/UserActivity');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    try {
      await UserActivity.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id },
        {
          lastChannelId: message.channel.id,
          lastMessageId: message.id,
          lastActivityTimestamp: new Date()
        },
        { upsert: true }
      );
    } catch (err) {
      logger.error('Error saving user activity:', err);
    }
  }
};

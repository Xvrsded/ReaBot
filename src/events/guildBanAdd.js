const { Events } = require('discord.js');
const { handleGuildBanAdd } = require('../services/moderationService');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(guildBan) {
    await handleGuildBanAdd(guildBan);
  }
};

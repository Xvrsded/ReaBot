const { Events } = require('discord.js');
const { handleMemberUpdate } = require('../services/moderationService');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    await handleMemberUpdate(oldMember, newMember);
  }
};

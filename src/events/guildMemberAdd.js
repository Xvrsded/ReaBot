const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config/config');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      if (!config.channels.welcome) {
        return;
      }

      const channel = await member.guild.channels
        .fetch(config.channels.welcome)
        .catch(() => null);

      if (!channel || !channel.isTextBased()) {
        logger.warn(`Welcome channel (${config.channels.welcome}) not found or not text-based.`);
        return;
      }

      const verificationText = config.verificationChannelId
        ? ` <#${config.verificationChannelId}>`
        : ' channel verification';

      const embed = new EmbedBuilder()
        .setTitle(`👋 Welcome to ${member.guild.name}!`)
        .setDescription(
          `👋 Selamat datang <@${member.id}>!\n\n` +
          `Silakan baca rules dan lakukan verification terlebih dahulu untuk mendapatkan akses ke server.`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setColor(0x5865F2)
        .setFooter({ text: `Member #${member.guild.memberCount}` })
        .setTimestamp();

      await channel.send({
        content: `👋 Welcome <@${member.id}>!`,
        embeds: [embed]
      });

      logger.info(`Welcome message sent for ${member.user.tag}`);
    } catch (error) {
      logger.error(`Error sending welcome message for ${member.user?.tag || member.id}:`, error);
    }
  }
};

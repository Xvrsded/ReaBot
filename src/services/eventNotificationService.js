const { EmbedBuilder, GuildScheduledEventStatus } = require('discord.js');
const config = require('../config/config');
const logger = require('../utils/logger');

// Set to track event IDs that have already triggered an active notification
const notifiedEvents = new Set();

/**
 * Handles guild scheduled event status updates
 * @param {import('discord.js').GuildScheduledEvent} oldEvent
 * @param {import('discord.js').GuildScheduledEvent} newEvent
 */
async function handleScheduledEventUpdate(oldEvent, newEvent) {
  try {
    if (!newEvent || !newEvent.guild) return;

    const isNewlyActive =
      newEvent.status === GuildScheduledEventStatus.Active &&
      (!oldEvent || oldEvent.status !== GuildScheduledEventStatus.Active);

    if (!isNewlyActive) return;

    if (notifiedEvents.has(newEvent.id)) {
      return;
    }

    notifiedEvents.add(newEvent.id);

    if (!config.eventNotificationChannelId) {
      return;
    }

    const channel = await newEvent.guild.channels
      .fetch(config.eventNotificationChannelId)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      logger.warn(`Event notification channel (${config.eventNotificationChannelId}) not found or not text-based.`);
      return;
    }

    let location = 'Discord Server';
    if (newEvent.channel) {
      location = `<#${newEvent.channel.id}>`;
    } else if (newEvent.entityMetadata?.location) {
      location = newEvent.entityMetadata.location;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 SERVER EVENT IS LIVE!')
      .setDescription(`**${newEvent.name}**\n\nEvent sudah dimulai! Ayo bergabung sekarang!`)
      .setColor(0x57F287)
      .addFields(
        { name: '📍 Location', value: location, inline: true },
        { name: '📝 Description', value: newEvent.description || 'Tidak ada deskripsi.', inline: false }
      )
      .setTimestamp();

    if (newEvent.coverImageURL()) {
      embed.setImage(newEvent.coverImageURL({ size: 1024 }));
    }

    if (newEvent.url) {
      embed.addFields({ name: '🔗 Join Event', value: `[Click Here to Join Event](${newEvent.url})`, inline: true });
    }

    await channel.send({
      content: `@everyone 🎉 **${newEvent.name}** is starting now!`,
      embeds: [embed]
    });

    logger.info(`Scheduled event alert sent for: ${newEvent.name} (${newEvent.id})`);
  } catch (error) {
    logger.error('Error handling scheduled event update:', error);
  }
}

module.exports = {
  handleScheduledEventUpdate,
  notifiedEvents
};

const { EmbedBuilder, ActivityType } = require('discord.js');
const config = require('../config/config');
const logger = require('../utils/logger');

// Set to track user IDs who are currently detected as live streaming
const activeStreamers = new Set();

/**
 * Checks and handles streaming presence changes
 * @param {import('discord.js').Presence} oldPresence
 * @param {import('discord.js').Presence} newPresence
 */
async function handlePresenceUpdate(oldPresence, newPresence) {
  try {
    if (!newPresence || !newPresence.member || !newPresence.guild) return;

    // Check if streamer role is configured and if member has it
    if (config.roles.streamer && !newPresence.member.roles.cache.has(config.roles.streamer)) {
      return;
    }

    const userId = newPresence.userId;
    const activities = newPresence.activities || [];
    const streamingActivity = activities.find(
      (activity) => activity.type === ActivityType.Streaming || activity.type === 1
    );

    // Member is currently streaming
    if (streamingActivity) {
      if (activeStreamers.has(userId)) {
        // Already notified and still streaming
        return;
      }

      // Mark as streaming
      activeStreamers.add(userId);

      if (!config.channels.streamingNotification) {
        return;
      }

      const channel = await newPresence.guild.channels
        .fetch(config.channels.streamingNotification)
        .catch(() => null);

      if (!channel || !channel.isTextBased()) {
        logger.warn(`Stream notification channel (${config.channels.streamingNotification}) not found or not text-based.`);
        return;
      }

      const streamUrl = streamingActivity.url || null;
      const gameName = streamingActivity.state || streamingActivity.details || streamingActivity.name || 'Streaming';
      const streamTitle = streamingActivity.details || streamingActivity.name || 'Live Stream';

      const embed = new EmbedBuilder()
        .setTitle('🔴 LIVE NOW!')
        .setDescription(`**${newPresence.member.displayName}** is now live!\n\n**${streamTitle}**`)
        .setColor(0xED4245)
        .setThumbnail(newPresence.member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '🎮 Game', value: gameName, inline: true }
        )
        .setTimestamp();

      if (streamUrl) {
        embed.addFields({ name: '🔗 Watch Stream', value: `[Click Here to Watch](${streamUrl})`, inline: true });
      }

      await channel.send({
        content: `📢 Hey everyone! <@${userId}> is now live on stream!`,
        embeds: [embed]
      });

      logger.info(`Stream notification sent for ${newPresence.member.user.tag}`);
    } else {
      // Member is no longer streaming
      if (activeStreamers.has(userId)) {
        activeStreamers.delete(userId);
        logger.info(`Stream ended for user ID: ${userId}`);
      }
    }
  } catch (error) {
    logger.error('Error handling streaming presence update:', error);
  }
}

module.exports = {
  handlePresenceUpdate,
  activeStreamers
};

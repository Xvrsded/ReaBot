const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const config = require('../config/config');
const logger = require('../utils/logger');
const UserActivity = require('../models/UserActivity');

// Sets for deduplication
const recentTimeouts = new Map();
const recentBans = new Set();

/**
 * Sends an embed to the configured moderation log channel
 * @param {string} userId
 * @param {import('discord.js').TextChannel} defaultChannel
 */
async function sendModerationLog(guild, embed, userId = null, defaultChannel = null) {
  try {
    let channel = defaultChannel;

    if (!channel && userId) {
      const activity = await UserActivity.findOne({ guildId: guild.id, userId });
      if (activity && activity.lastChannelId) {
        channel = await guild.channels.fetch(activity.lastChannelId).catch(() => null);
      }
    }

    if (!channel || !channel.isTextBased()) {
      // Fallback to system channel if no activity found
      channel = guild.systemChannel;
    }

    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    } else {
      logger.warn(`Could not determine a valid channel to send moderation log for user ${userId || 'unknown'}`);
    }
  } catch (error) {
    logger.error('Failed to send moderation log embed:', error);
  }
}

/**
 * Formats a duration in milliseconds into a human readable string
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ') || '0s';
}

/**
 * Handles member update to detect new timeouts
 * @param {import('discord.js').GuildMember} oldMember
 * @param {import('discord.js').GuildMember} newMember
 */
async function handleMemberUpdate(oldMember, newMember) {
  try {
    if (!newMember || !newMember.guild) return;

    const wasTimedOut = oldMember.communicationDisabledUntilTimestamp && oldMember.communicationDisabledUntilTimestamp > Date.now();
    const isTimedOut = newMember.communicationDisabledUntilTimestamp && newMember.communicationDisabledUntilTimestamp > Date.now();

    // Check if member has been newly timed out
    if (!wasTimedOut && isTimedOut) {
      const timeoutUntil = newMember.communicationDisabledUntilTimestamp;
      const key = `${newMember.id}-${timeoutUntil}`;

      if (recentTimeouts.has(key)) return;
      recentTimeouts.set(key, Date.now());

      // Cleanup cache older than 1 minute
      setTimeout(() => recentTimeouts.delete(key), 60000);

      let moderator = 'Unknown';
      let reason = 'No reason provided';

      // Check Audit Logs if bot has permission
      if (newMember.guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
        try {
          const auditLogs = await newMember.guild.fetchAuditLogs({
            limit: 5,
            type: AuditLogEvent.MemberUpdate
          });

          const entry = auditLogs.entries.find(
            (e) =>
              e.target?.id === newMember.id &&
              e.changes.some((c) => c.key === 'communication_disabled_until') &&
              Date.now() - e.createdTimestamp < 30000
          );

          if (entry) {
            if (entry.executor) {
              moderator = `${entry.executor.tag} (<@${entry.executor.id}>)`;
            }
            if (entry.reason) {
              reason = entry.reason;
            }
          }
        } catch (err) {
          logger.warn(`Could not fetch audit logs for timeout on ${newMember.user.tag}: ${err.message}`);
        }
      }

      const durationMs = timeoutUntil - Date.now();
      const durationStr = formatDuration(durationMs);

      const embed = new EmbedBuilder()
        .setTitle('🔨 MEMBER TIMEOUT')
        .setColor(0xFEE75C)
        .addFields(
          { name: '👤 User', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: false },
          { name: '👮 Moderator', value: moderator, inline: false },
          { name: '⏱️ Duration', value: `${durationStr} (Until: <t:${Math.floor(timeoutUntil / 1000)}:F>)`, inline: false },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await sendModerationLog(newMember.guild, embed, newMember.id);
      logger.info(`Timeout detected and logged for ${newMember.user.tag}`);
    }
  } catch (error) {
    logger.error('Error handling guildMemberUpdate timeout detection:', error);
  }
}

/**
 * Handles guild member ban to detect and log bans
 * @param {import('discord.js').GuildBan} guildBan
 */
async function handleGuildBanAdd(guildBan) {
  try {
    if (!guildBan || !guildBan.guild) return;

    const user = guildBan.user;
    if (recentBans.has(user.id)) return;
    recentBans.add(user.id);
    setTimeout(() => recentBans.delete(user.id), 60000);

    let moderator = 'Unknown';
    let reason = guildBan.reason || 'No reason provided';

    if (guildBan.guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
      try {
        const auditLogs = await guildBan.guild.fetchAuditLogs({
          limit: 5,
          type: AuditLogEvent.MemberBanAdd
        });

        const entry = auditLogs.entries.find(
          (e) => e.target?.id === user.id && Date.now() - e.createdTimestamp < 30000
        );

        if (entry) {
          if (entry.executor) {
            moderator = `${entry.executor.tag} (<@${entry.executor.id}>)`;
          }
          if (entry.reason) {
            reason = entry.reason;
          }
        }
      } catch (err) {
        logger.warn(`Could not fetch audit logs for ban on ${user.tag}: ${err.message}`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🔨 MEMBER BANNED')
      .setColor(0xED4245)
      .addFields(
        { name: '👤 User', value: `${user.tag} (<@${user.id}>)`, inline: false },
        { name: '👮 Moderator', value: moderator, inline: false },
        { name: '📝 Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await sendModerationLog(guildBan.guild, embed, user.id);
    logger.info(`Ban detected and logged for ${user.tag}`);
  } catch (error) {
    logger.error('Error handling guildBanAdd:', error);
  }
}

module.exports = {
  sendModerationLog,
  handleMemberUpdate,
  handleGuildBanAdd
};

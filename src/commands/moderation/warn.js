const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ModerationCase = require('../../models/ModerationCase');
const { sendModerationLog } = require('../../services/moderationService');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Memberikan peringatan (warning) kepada member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member yang ingin diberi warning')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Alasan pemberian warning')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const guildId = interaction.guildId;

      if (!targetUser) {
        return interaction.reply({ content: '❌ User tidak ditemukan.', ephemeral: true });
      }

      if (targetUser.bot) {
        return interaction.reply({ content: '❌ Kamu tidak bisa memberikan warning kepada bot.', ephemeral: true });
      }

      if (targetUser.id === interaction.user.id) {
        return interaction.reply({ content: '❌ Kamu tidak bisa memberikan warning kepada diri sendiri.', ephemeral: true });
      }

      // Save to MongoDB
      const newCase = await ModerationCase.create({
        guildId,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        type: 'WARN',
        reason
      });

      // Count total warnings
      const totalWarnings = await ModerationCase.countDocuments({
        guildId,
        userId: targetUser.id,
        type: 'WARN'
      });

      const logEmbed = new EmbedBuilder()
        .setTitle('⚠️ MEMBER WARNED')
        .setColor(0xFEE75C)
        .addFields(
          { name: '👤 User', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: false },
          { name: '👮 Moderator', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
          { name: '📝 Reason', value: reason, inline: false },
          { name: '🔢 Total Warnings', value: `${totalWarnings}`, inline: false }
        )
        .setTimestamp();

      await sendModerationLog(interaction.guild, logEmbed, targetUser.id, interaction.channel);

      return interaction.reply({
        content: `✅ **${targetUser.tag}** berhasil diberi warning. (Total Warning: **${totalWarnings}**)`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error executing /warn command:', error);
      return interaction.reply({
        content: '❌ Terjadi kesalahan saat menyimpan data warning.',
        ephemeral: true
      });
    }
  }
};

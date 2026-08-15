const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ModerationCase = require('../../models/ModerationCase');
const { sendModerationLog } = require('../../services/moderationService');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Menghapus semua catatan warning dari seorang member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member yang ingin dihapus seluruh riwayat warningnya')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const guildId = interaction.guildId;

      if (!targetUser) {
        return interaction.reply({ content: '❌ User tidak ditemukan.', ephemeral: true });
      }

      const result = await ModerationCase.deleteMany({
        guildId,
        userId: targetUser.id,
        type: 'WARN'
      });

      if (result.deletedCount === 0) {
        return interaction.reply({
          content: `ℹ️ **${targetUser.tag}** tidak memiliki riwayat warning untuk dihapus.`,
          ephemeral: true
        });
      }

      const logEmbed = new EmbedBuilder()
        .setTitle('🧹 WARNINGS CLEARED')
        .setColor(0x57F287)
        .addFields(
          { name: '👤 User', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: false },
          { name: '👮 Moderator', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: false },
          { name: '🗑️ Cleared Warnings', value: `${result.deletedCount}`, inline: false }
        )
        .setTimestamp();

      await sendModerationLog(interaction.guild, logEmbed);

      return interaction.reply({
        content: `✅ Berhasil menghapus **${result.deletedCount}** warning dari **${targetUser.tag}**.`,
        ephemeral: false
      });
    } catch (error) {
      logger.error('Error executing /clearwarnings command:', error);
      return interaction.reply({
        content: '❌ Terjadi kesalahan saat menghapus data warning.',
        ephemeral: true
      });
    }
  }
};

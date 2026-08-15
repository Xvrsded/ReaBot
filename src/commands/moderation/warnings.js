const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ModerationCase = require('../../models/ModerationCase');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Melihat riwayat warning dari seorang member.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Member yang ingin dicek riwayat warningnya')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const guildId = interaction.guildId;

      if (!targetUser) {
        return interaction.reply({ content: '❌ User tidak ditemukan.', ephemeral: true });
      }

      const warnings = await ModerationCase.find({
        guildId,
        userId: targetUser.id,
        type: 'WARN'
      }).sort({ timestamp: -1 });

      const totalWarnings = warnings.length;

      const embed = new EmbedBuilder()
        .setTitle(`📋 Warning History — ${targetUser.tag}`)
        .setColor(totalWarnings > 0 ? 0xFEE75C : 0x57F287)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(`**Total Warnings:** ${totalWarnings}`)
        .setTimestamp();

      if (totalWarnings === 0) {
        embed.addFields({
          name: 'Status',
          value: 'Member ini bersih dan belum memiliki catatan warning.'
        });
      } else {
        const historyText = warnings
          .slice(0, 10) // Display last 10 warnings
          .map((w, index) => {
            const time = Math.floor(new Date(w.timestamp).getTime() / 1000);
            return `**#${totalWarnings - index}** | <t:${time}:d>\n• **Moderator:** <@${w.moderatorId}>\n• **Reason:** ${w.reason}`;
          })
          .join('\n\n');

        embed.addFields({
          name: `Riwayat Warning (Menampilkan ${Math.min(totalWarnings, 10)} terbaru)`,
          value: historyText.length > 1024 ? historyText.substring(0, 1020) + '...' : historyText
        });
      }

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error executing /warnings command:', error);
      return interaction.reply({
        content: '❌ Terjadi kesalahan saat mengambil riwayat warning.',
        ephemeral: true
      });
    }
  }
};

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config/config');
const logger = require('../utils/logger');
const StreamerAccount = require('../models/StreamerAccount');

const monitors = {
  tiktok: require('./monitors/TikTokMonitor'),
  twitch: require('./monitors/TwitchMonitor'),
  youtube: require('./monitors/YouTubeMonitor')
};

async function initStreamerRegistrationMessage(client) {
  const registrationChannelId = config.channels.streamerRegistration;
  if (!registrationChannelId) return;

  try {
    const channel = await client.channels.fetch(registrationChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`Streamer registration channel (${registrationChannelId}) not found.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎥 STREAMER REGISTRATION')
      .setColor(0x9146FF)
      .setDescription(
        'Punya akun streaming?\n\n' +
        'Daftarkan akun streaming kamu agar member server mendapatkan notifikasi otomatis ketika kamu sedang LIVE.\n\n' +
        'Kamu harus memiliki role Streamer untuk menggunakan fitur ini.\n\n' +
        'Pilih platform yang ingin kamu daftarkan di bawah:'
      );

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('streamer_register_tiktok')
        .setLabel('TikTok')
        .setEmoji('🎵')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('streamer_register_twitch')
        .setLabel('Twitch')
        .setEmoji('🟣')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('streamer_register_youtube')
        .setLabel('YouTube')
        .setEmoji('🔴')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('streamer_my_accounts')
        .setLabel('My Accounts')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Primary)
    );

    // Check recent messages for existing embed to reuse
    const recentMessages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const existingMessage = recentMessages?.find(
      (m) => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title === '🎥 STREAMER REGISTRATION'
    );

    if (existingMessage) {
      await existingMessage.edit({ embeds: [embed], components: [row1, row2] });
      logger.info(`Reused existing streamer registration message (${existingMessage.id}).`);
    } else {
      await channel.send({ embeds: [embed], components: [row1, row2] });
      logger.info('Created new streamer registration message.');
    }
  } catch (err) {
    logger.error('Failed to init streamer registration message:', err);
  }
}

async function handleStreamerButtons(interaction) {
  const roleId = config.roles.streamer;

  if (!interaction.member.roles.cache.has(roleId)) {
    return interaction.reply({
      content: '❌ Kamu harus memiliki role Streamer untuk mendaftarkan akun streaming.',
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith('streamer_register_')) {
    const platform = interaction.customId.replace('streamer_register_', '');
    const modal = new ModalBuilder()
      .setCustomId(`modal_streamer_${platform}`)
      .setTitle(`Register ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);

    let placeholder = 'Contoh: gunturgaming';
    let label = 'Username';
    if (platform === 'tiktok') placeholder = 'Contoh: @gunturgaming';
    if (platform === 'youtube') {
      placeholder = 'URL atau @handle (Cth: @GunturGaming)';
      label = 'YouTube Channel / Handle';
    }

    const input = new TextInputBuilder()
      .setCustomId('input_username')
      .setLabel(label)
      .setPlaceholder(placeholder)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);

  } else if (interaction.customId === 'streamer_my_accounts') {
    const accounts = await StreamerAccount.find({ discordUserId: interaction.user.id, guildId: interaction.guild.id });
    
    if (accounts.length === 0) {
      return interaction.reply({ content: 'ℹ️ Kamu belum mendaftarkan akun streaming.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎥 YOUR STREAMING ACCOUNTS')
      .setColor(0x9146FF);

    const rows = [];
    let currentRow = new ActionRowBuilder();

    accounts.forEach(acc => {
      let emoji = '🔗';
      if (acc.platform === 'tiktok') emoji = '🎵';
      if (acc.platform === 'twitch') emoji = '🟣';
      if (acc.platform === 'youtube') emoji = '🔴';

      const platformName = acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1);
      
      embed.addFields({
        name: `${emoji} ${platformName}`,
        value: `${acc.platform === 'youtube' ? '' : '@'}${acc.username}\nStatus: ${acc.liveStatus ? '🟢 LIVE' : '🔴 Monitoring'}`,
        inline: false
      });

      if (currentRow.components.length >= 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }

      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`streamer_remove_${acc._id}`)
          .setLabel(`Remove ${platformName}`)
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger)
      );
    });

    if (currentRow.components.length > 0) rows.push(currentRow);

    return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  } else if (interaction.customId.startsWith('streamer_remove_')) {
    const accountId = interaction.customId.replace('streamer_remove_', '');
    const account = await StreamerAccount.findById(accountId);
    
    if (!account) {
      return interaction.reply({ content: '❌ Akun tidak ditemukan.', ephemeral: true });
    }

    if (account.discordUserId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Kamu hanya bisa menghapus akunmu sendiri.', ephemeral: true });
    }

    await StreamerAccount.findByIdAndDelete(accountId);
    return interaction.reply({ content: `✅ Berhasil menghapus akun **${account.platform}** Anda.`, ephemeral: true });
  }
}

async function handleStreamerModals(interaction) {
  if (interaction.customId.startsWith('modal_streamer_')) {
    const platform = interaction.customId.replace('modal_streamer_', '');
    const input = interaction.fields.getTextInputValue('input_username');

    await interaction.deferReply({ ephemeral: true });

    try {
      const monitor = monitors[platform];
      if (!monitor) throw new Error('Unsupported platform');

      const resolved = await monitor.resolveUser(input);
      if (!resolved) {
        return interaction.editReply({ content: `❌ Akun ${platform} tidak valid atau tidak ditemukan.` });
      }

      // Check duplicate in same server
      const existsId = await StreamerAccount.findOne({ guildId: interaction.guild.id, platform, platformUserId: resolved.platformUserId });
      if (existsId) {
        if (existsId.discordUserId === interaction.user.id) return interaction.editReply({ content: `❌ Akun ${platform} tersebut sudah terdaftar di akunmu.` });
        return interaction.editReply({ content: `❌ Akun tersebut sudah terdaftar sebagai streamer lain.` });
      }

      const existsUser = await StreamerAccount.findOne({ guildId: interaction.guild.id, platform, username: resolved.username });
      if (existsUser) {
        return interaction.editReply({ content: `❌ Username ${platform} tersebut sudah terdaftar.` });
      }

      const acc = new StreamerAccount({
        guildId: interaction.guild.id,
        discordUserId: interaction.user.id,
        platform: platform,
        username: resolved.username,
        displayName: resolved.displayName,
        platformUserId: resolved.platformUserId,
        enabled: true
      });

      await acc.save();
      return interaction.editReply({ content: `✅ Berhasil mendaftarkan akun ${platform} **${resolved.displayName || resolved.username}**!\nBot akan memantau status LIVE kamu.` });
    } catch (err) {
      logger.error(`Error saving ${platform} account:`, err.message);
      return interaction.editReply({ content: `❌ Terjadi kesalahan saat memverifikasi akun ${platform}.` });
    }
  }
}

// Background Monitor
let isMonitoring = false;

async function startStreamMonitor(client) {
  if (isMonitoring) return;
  isMonitoring = true;

  // Run every 2 minutes
  setInterval(async () => {
    try {
      const accounts = await StreamerAccount.find({ enabled: true });
      if (accounts.length === 0) return;

      const notificationChannelId = config.channels.streamingNotification;
      const channel = client.channels.cache.get(notificationChannelId);
      
      if (!channel) return;

      // Group accounts by platform to optimize/batch if needed, but for now we poll individually safely
      for (const account of accounts) {
        const monitor = monitors[account.platform];
        if (!monitor) continue;

        let result = null;
        try {
          result = await monitor.checkLiveStatus(account);
        } catch (err) {
          logger.warn(`Unhandled monitor error for ${account.platform}: ${err.message}`);
          continue; // skip on error
        }

        if (result === null) continue; // Network/API error, do NOT change status

        const { isLive } = result;

        if (isLive && !account.liveStatus) {
          // Went LIVE
          account.liveStatus = true;
          account.lastLiveAt = new Date();
          account.liveUrl = result.url;
          account.streamTitle = result.title;
          account.category = result.category;
          account.viewerCount = result.viewerCount;
          account.thumbnailUrl = result.thumbnailUrl;
          await account.save();

          let embedColor = 0xFF0050; // TikTok
          if (account.platform === 'twitch') embedColor = 0x9146FF;
          if (account.platform === 'youtube') embedColor = 0xFF0000;

          const embed = new EmbedBuilder()
            .setTitle('🔴 LIVE NOW')
            .setColor(embedColor)
            .setDescription(`**${result.displayName}** sedang LIVE!`);

          if (result.title) embed.addFields({ name: '📺 Title', value: result.title, inline: false });
          if (result.category) embed.addFields({ name: '🎮 Category', value: result.category, inline: true });
          if (result.viewerCount) embed.addFields({ name: '👀 Viewers', value: result.viewerCount.toString(), inline: true });
          if (result.thumbnailUrl) embed.setImage(`${result.thumbnailUrl}?t=${Date.now()}`); // cache buster

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Watch Live')
              .setEmoji('🔗')
              .setStyle(ButtonStyle.Link)
              .setURL(result.url)
          );

          const platformEmoji = account.platform === 'tiktok' ? '🎵' : (account.platform === 'twitch' ? '🟣' : '🔴');
          const platformName = account.platform.charAt(0).toUpperCase() + account.platform.slice(1);

          await channel.send({
            content: `${platformEmoji} **${platformName}** | Hey everyone! <@${account.discordUserId}> is now LIVE!`,
            embeds: [embed],
            components: [row]
          }).catch(err => logger.error('Failed to send live notification:', err));
          
          logger.info(`[STREAMER] ${account.platform} @${account.username} is LIVE`);

        } else if (!isLive && account.liveStatus) {
          // Went OFFLINE
          account.liveStatus = false;
          await account.save();
          logger.info(`[STREAMER] ${account.platform} @${account.username} went OFFLINE`);
        } else {
          // Still live or still offline, just save lastCheckedAt
          account.lastCheckedAt = new Date();
          await account.save();
        }
      }
    } catch (err) {
      logger.error('Error in stream monitor loop:', err);
    }
  }, 120000); // 2 minutes interval
}

module.exports = {
  initStreamerRegistrationMessage,
  handleStreamerButtons,
  handleStreamerModals,
  startStreamMonitor
};

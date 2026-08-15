const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config/config');
const logger = require('../utils/logger');
const StreamerAccount = require('../models/StreamerAccount');
const axios = require('axios'); // Requires axios for http requests

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
        'Pilih platform yang ingin kamu daftarkan di bawah.'
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('streamer_register_tiktok')
        .setLabel('Register TikTok')
        .setEmoji('🎵')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('streamer_my_accounts')
        .setLabel('My Accounts')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary)
    );

    // Check recent messages for existing embed to reuse
    const recentMessages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const existingMessage = recentMessages?.find(
      (m) => m.author.id === client.user.id && m.components.some(r => r.components.some(c => c.customId === 'streamer_register_tiktok'))
    );

    if (existingMessage) {
      await existingMessage.edit({ embeds: [embed], components: [row] });
      logger.info(`Reused existing streamer registration message (${existingMessage.id}).`);
    } else {
      await channel.send({ embeds: [embed], components: [row] });
      logger.info('Created new streamer registration message.');
    }
  } catch (err) {
    logger.error('Failed to init streamer registration message:', err);
  }
}

async function handleStreamerButtons(interaction) {
  const roleId = config.roles.streamer;

  // Check role first
  if (!interaction.member.roles.cache.has(roleId)) {
    return interaction.reply({
      content: '❌ Kamu tidak memiliki role Streamer.\n\nKamu harus memiliki role Streamer untuk mendaftarkan akun streaming.',
      ephemeral: true
    });
  }

  if (interaction.customId === 'streamer_register_tiktok') {
    const modal = new ModalBuilder()
      .setCustomId('modal_streamer_tiktok')
      .setTitle('Register TikTok');

    const input = new TextInputBuilder()
      .setCustomId('input_tiktok_username')
      .setLabel('TikTok Username')
      .setPlaceholder('Contoh: gunturgaming')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  } else if (interaction.customId === 'streamer_my_accounts') {
    const accounts = await StreamerAccount.find({ discordUserId: interaction.user.id, guildId: interaction.guild.id });
    
    if (accounts.length === 0) {
      return interaction.reply({ content: 'ℹ️ Kamu belum mendaftarkan akun streaming apapun.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎥 Your Streaming Accounts')
      .setColor(0x9146FF);

    const row = new ActionRowBuilder();

    accounts.forEach(acc => {
      embed.addFields({
        name: `${acc.platform === 'tiktok' ? '🎵 TikTok' : acc.platform}`,
        value: `@${acc.username}\nStatus: ${acc.liveStatus ? '🔴 LIVE' : '🟢 Monitoring'}`
      });

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`streamer_remove_${acc._id}`)
          .setLabel(`Remove ${acc.username}`)
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger)
      );
    });

    return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
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
    return interaction.reply({ content: `✅ Berhasil menghapus akun **@${account.username}**.`, ephemeral: true });
  }
}

async function handleStreamerModals(interaction) {
  if (interaction.customId === 'modal_streamer_tiktok') {
    let username = interaction.fields.getTextInputValue('input_tiktok_username');
    username = username.trim().replace(/^@/, '').toLowerCase();

    if (!username) {
      return interaction.reply({ content: '❌ Username TikTok tidak valid.', ephemeral: true });
    }

    try {
      // Basic check if it exists globally
      const existsGlobally = await StreamerAccount.findOne({ guildId: interaction.guild.id, platform: 'tiktok', username });
      if (existsGlobally) {
        if (existsGlobally.discordUserId === interaction.user.id) {
          return interaction.reply({ content: '❌ Akun TikTok tersebut sudah terdaftar.', ephemeral: true });
        }
        return interaction.reply({ content: '❌ Akun TikTok tersebut sudah terdaftar sebagai streamer oleh orang lain.', ephemeral: true });
      }

      // Simple web validation (TikTok web returns 404 for missing users usually, though it's protected by anti-bot. We do a basic GET).
      // Note: Full validation in a prod environment requires proper APIs. We use a simple Axios GET here to ensure the profile loads without 404.
      try {
        const response = await axios.get(`https://www.tiktok.com/@${username}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 5000
        });
        if (response.status !== 200) throw new Error('Not found');
      } catch (err) {
        // Many times TikTok returns captcha or 403. We'll only block on 404 explicitly.
        if (err.response && err.response.status === 404) {
             return interaction.reply({ content: '❌ Akun TikTok tidak ditemukan.\n\nPastikan username yang kamu masukkan benar.', ephemeral: true });
        }
        // Proceed if 403 or other errors due to anti-bot.
      }

      const acc = new StreamerAccount({
        guildId: interaction.guild.id,
        discordUserId: interaction.user.id,
        platform: 'tiktok',
        username: username,
        enabled: true
      });

      await acc.save();
      return interaction.reply({ content: `✅ Berhasil mendaftarkan akun TikTok **@${username}**!\nBot akan segera memantau status LIVE kamu.`, ephemeral: true });
    } catch (err) {
      logger.error('Error saving TikTok account:', err);
      return interaction.reply({ content: '❌ Terjadi kesalahan pada server saat mendaftarkan akun.', ephemeral: true });
    }
  }
}

// Background Monitor
let isMonitoring = false;

async function checkTikTokLive(account) {
  try {
    // Unofficial method to check live via tiktok page
    // Look for "roomId" > 0 in the page source or other indicators.
    // NOTE: This is a best-effort approach since TikTok has no public API.
    const url = `https://www.tiktok.com/@${account.username}/live`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000
    });

    const html = response.data;
    
    // TikTok page usually contains SIGI_STATE or indicates if the room is active.
    // If a user is not live, /live redirects to their profile or shows "LIVE has ended".
    // Alternatively, a regex to find "roomId":"12345" where 12345 is not empty/null.
    const isLive = html.includes('"roomId":"') && !html.includes('"roomId":""') && html.includes('room_status":2'); // 2 usually implies active

    // A more lenient check: if the page title explicitly says "LIVE" or the URL didn't redirect.
    // Actually, just checking if "room_id" exists and has a valid value.
    const roomMatch = html.match(/"roomId":"(\d+)"/);
    const actuallyLive = roomMatch && roomMatch[1] && roomMatch[1] !== '0';

    return {
      isLive: !!actuallyLive,
      url: `https://www.tiktok.com/@${account.username}/live`
    };
  } catch (err) {
    if (err.response && err.response.status === 404) {
       // Account not found or deleted
       return { isLive: false, url: null };
    }
    logger.warn(`Failed to check TikTok account @${account.username}: ${err.message}`);
    return null; // Return null so we don't accidentally mark offline on network error
  }
}

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

      for (const account of accounts) {
        account.lastCheckedAt = new Date();
        
        let result = null;
        if (account.platform === 'tiktok') {
          result = await checkTikTokLive(account);
        }

        if (result === null) continue; // Network error, skip

        const { isLive, url } = result;

        if (isLive && !account.liveStatus) {
          // Went LIVE
          account.liveStatus = true;
          account.lastLiveAt = new Date();
          account.liveUrl = url;
          await account.save();

          const embed = new EmbedBuilder()
            .setTitle('🔴 IS LIVE!')
            .setColor(0xFF0050)
            .setDescription(`**@${account.username}** sedang LIVE sekarang!`)
            .addFields(
              { name: '🎵 Platform', value: 'TikTok', inline: true },
              { name: '👤 Streamer', value: `<@${account.discordUserId}>`, inline: true }
            );

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Watch Live')
              .setEmoji('🔗')
              .setStyle(ButtonStyle.Link)
              .setURL(url || `https://www.tiktok.com/@${account.username}/live`)
          );

          await channel.send({
            content: `🔴 <@${account.discordUserId}> is LIVE!`,
            embeds: [embed],
            components: [row]
          }).catch(err => logger.error('Failed to send live notification:', err));
          
          logger.info(`[STREAMER] @${account.username} is LIVE`);

        } else if (!isLive && account.liveStatus) {
          // Went OFFLINE
          account.liveStatus = false;
          await account.save();
          logger.info(`[STREAMER] @${account.username} went OFFLINE`);
        } else {
          // Still live or still offline, just save lastCheckedAt
          await account.save();
        }
      }
    } catch (err) {
      logger.error('Error in stream monitor:', err);
    }
  }, 120000); // 2 minutes
}

module.exports = {
  initStreamerRegistrationMessage,
  handleStreamerButtons,
  handleStreamerModals,
  startStreamMonitor
};

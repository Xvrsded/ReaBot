const axios = require('axios');
const logger = require('../../utils/logger');

class TikTokMonitor {
  async resolveUser(username) {
    // For TikTok, we just normalize username. No official API for ID.
    const norm = username.trim().replace(/^@/, '').toLowerCase();
    
    // Quick validate
    try {
      const response = await axios.get(`https://www.tiktok.com/@${norm}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 5000
      });
      if (response.status !== 200) return null;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return null; // Invalid username
      }
    }

    return {
      platformUserId: norm,
      username: norm,
      displayName: norm
    };
  }

  async checkLiveStatus(account) {
    try {
      const url = `https://www.tiktok.com/@${account.username}/live`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'text/html'
        },
        timeout: 10000
      });

      const html = response.data;
      const roomMatch = html.match(/"roomId":"(\d+)"/);
      const isLive = roomMatch && roomMatch[1] && roomMatch[1] !== '0';

      if (!isLive) {
        return { isLive: false };
      }

      return {
        platform: 'tiktok',
        isLive: true,
        username: account.username,
        displayName: account.displayName || account.username,
        url: url
      };
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return { isLive: false };
      }
      logger.warn(`TikTokMonitor API Error for @${account.username}: ${err.message}`);
      return null; // Return null so we don't accidentally mark offline
    }
  }
}

module.exports = new TikTokMonitor();

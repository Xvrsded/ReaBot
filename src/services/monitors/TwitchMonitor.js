const axios = require('axios');
const logger = require('../../utils/logger');

class TwitchMonitor {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  async getAccessToken() {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) return null;

    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const res = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`);
      this.accessToken = res.data.access_token;
      this.tokenExpiresAt = Date.now() + (res.data.expires_in * 1000) - 60000; // Buffer 1 min
      return this.accessToken;
    } catch (err) {
      logger.error('Failed to fetch Twitch Access Token:', err.response?.data || err.message);
      return null;
    }
  }

  async resolveUser(username) {
    const token = await this.getAccessToken();
    if (!token) throw new Error('Twitch API credentials missing or invalid');

    const clientId = process.env.TWITCH_CLIENT_ID;
    const norm = username.trim().toLowerCase();

    try {
      const res = await axios.get(`https://api.twitch.tv/helix/users?login=${norm}`, {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`
        }
      });

      const user = res.data.data[0];
      if (!user) return null; // Not found

      return {
        platformUserId: user.id,
        username: user.login,
        displayName: user.display_name
      };
    } catch (err) {
      logger.error(`TwitchMonitor resolveUser Error: ${err.message}`);
      throw err;
    }
  }

  async checkLiveStatus(account) {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const res = await axios.get(`https://api.twitch.tv/helix/streams?user_id=${account.platformUserId}`, {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        }
      });

      const stream = res.data.data[0];
      if (!stream) {
        return { isLive: false };
      }

      return {
        platform: 'twitch',
        isLive: true,
        username: stream.user_login,
        displayName: stream.user_name,
        title: stream.title,
        category: stream.game_name,
        viewerCount: stream.viewer_count,
        url: `https://twitch.tv/${stream.user_login}`,
        thumbnailUrl: stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
        startedAt: stream.started_at
      };
    } catch (err) {
      logger.warn(`TwitchMonitor API Error for ${account.username}: ${err.message}`);
      return null; // Prevent false offline
    }
  }
}

module.exports = new TwitchMonitor();

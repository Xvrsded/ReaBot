const axios = require('axios');
const logger = require('../../utils/logger');

class YouTubeMonitor {
  async resolveUser(input) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error('YouTube API Key missing');

    let channelId = null;
    let norm = input.trim();

    // Support extracting from URL or @ handle
    if (norm.includes('youtube.com/channel/')) {
      channelId = norm.split('youtube.com/channel/')[1].split('/')[0];
    } else if (norm.includes('youtube.com/@') || norm.startsWith('@')) {
      const handle = norm.includes('youtube.com/@') ? norm.split('youtube.com/@')[1].split('/')[0] : norm.substring(1);
      
      // Resolve handle to channel ID using search API (since v3 doesn't have a direct handle endpoint easily without HTML scrape)
      try {
        const res = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=%40${handle}&type=channel&key=${apiKey}`);
        if (res.data.items && res.data.items.length > 0) {
          channelId = res.data.items[0].snippet.channelId;
        }
      } catch (err) {
        logger.error(`YouTubeMonitor handle resolve error: ${err.message}`);
      }
    } else {
      // Assume input is raw channel ID
      channelId = norm;
    }

    if (!channelId) return null;

    try {
      const res = await axios.get(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`);
      const channel = res.data.items?.[0];
      if (!channel) return null;

      return {
        platformUserId: channelId,
        username: channel.snippet.customUrl || channelId, // customUrl contains @handle usually
        displayName: channel.snippet.title
      };
    } catch (err) {
      logger.error(`YouTubeMonitor resolveUser Error: ${err.message}`);
      throw err;
    }
  }

  async checkLiveStatus(account) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return null;

    try {
      // Only search for active live streams by this channel
      const res = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${account.platformUserId}&type=video&eventType=live&key=${apiKey}`);
      
      const stream = res.data.items?.[0];
      if (!stream) {
        return { isLive: false };
      }

      return {
        platform: 'youtube',
        isLive: true,
        username: account.username,
        displayName: stream.snippet.channelTitle,
        title: stream.snippet.title,
        url: `https://www.youtube.com/watch?v=${stream.id.videoId}`,
        thumbnailUrl: stream.snippet.thumbnails?.high?.url || stream.snippet.thumbnails?.default?.url,
        startedAt: stream.snippet.publishedAt
      };
    } catch (err) {
      if (err.response && err.response.status === 403) {
        logger.warn(`YouTubeMonitor Quota Exceeded or Forbidden: ${err.message}`);
      } else {
        logger.warn(`YouTubeMonitor API Error for ${account.username}: ${err.message}`);
      }
      return null;
    }
  }
}

module.exports = new YouTubeMonitor();

/**
 * Simple and clean logger utility for ReaBot
 */

const logger = {
  info: (message) => {
    console.log(`[INFO] ${message}`);
  },
  warn: (message) => {
    console.warn(`[WARN] ${message}`);
  },
  error: (message, err) => {
    if (err) {
      console.error(`[ERROR] ${message}`, err);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }
};

module.exports = logger;

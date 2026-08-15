# ReaBot

ReaBot is a dedicated Discord Bot built with Node.js, Discord.js v14, and MongoDB (Mongoose). It provides server verification, welcome messages, live streaming alerts, scheduled event notifications, and a full moderation suite.

---

## 🛠️ Requirements & Installation

1. **Node.js**: v16.9.0 or higher
2. **MongoDB**: A running MongoDB instance or MongoDB Atlas connection string.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and fill in your values:
```env
DISCORD_TOKEN=your_discord_bot_token_here
GUILD_ID=your_guild_id_here
MONGODB_URI=mongodb://localhost:27017/reabot

WELCOME_CHANNEL_ID=your_welcome_channel_id
VERIFICATION_CHANNEL_ID=1537851584246190120
VERIFIED_ROLE_ID=1537781352055967754
VERIFICATION_MESSAGE_ID=

STREAMER_ROLE_ID=your_streamer_role_id
STREAM_NOTIFICATION_CHANNEL_ID=your_stream_channel_id

EVENT_NOTIFICATION_CHANNEL_ID=your_event_channel_id
MODERATION_NOTIFICATION_CHANNEL_ID=your_moderation_log_channel_id
```

### 3. Run the Bot
```bash
npm run bot
```

---

## ⚙️ Discord Developer Portal Configuration

Before running ReaBot, ensure the following settings are enabled in the [Discord Developer Portal](https://discord.com/developers/applications):

1. Navigate to **Applications** → Select your Bot → **Bot** tab.
2. Under **Privileged Gateway Intents**, enable:
   - ✅ **Presence Intent** *(Required for live streaming detection)*
   - ✅ **Server Members Intent** *(Required for welcome messages & verification role management)*
   - ✅ **Message Content Intent**

---

## 🛡️ Bot Permissions & Role Hierarchy

### Required Bot Permissions
- **Manage Roles**
- **View Audit Log**
- **Send Messages**
- **Embed Links**
- **Read Message History**
- **Use Application Commands**

### ⚠️ Critical Role Hierarchy Note
In Discord Server Settings → **Roles**, make sure the bot's highest role is positioned **ABOVE** the `Verified Role` (`1537781352055967754`). Otherwise, Discord will prevent the bot from granting the role to users.

---

## 📋 Features

- **Rules Verification**: Interactive embed with idempotent message creation/editing and `verify` button to give members the Verified role.
- **Welcome System**: Welcomes new joiners and guides them to verification.
- **Live Stream Alerts**: Detects when members with the streamer role go live on Twitch/YouTube/Discord and posts notification.
- **Scheduled Event Alerts**: Notifies server members when a Discord Scheduled Event starts.
- **Moderation Suite**:
  - `/warn @user [reason]` - Issues a warning and logs to MongoDB.
  - `/warnings @user` - Views warning history for a user.
  - `/clearwarnings @user` - Clears all warnings for a user.
  - **Timeout Detection** - Detects timeout in audit logs and sends embed notification.
  - **Ban Detection** - Detects member ban in audit logs and sends embed notification.

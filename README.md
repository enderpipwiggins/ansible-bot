# ansible-bot

A small Twitch chat bot that welcomes fellow streamers to your channel.

The first time someone chats during a session, the bot looks them up on Twitch. If they have a stream category set, it posts a welcome with the game they last streamed, their stream title, and a link to their channel:

> 📡 Incoming transmission! Welcome SomeStreamer — last seen playing Celeste: "Strawberry hunting!" → https://twitch.tv/somestreamer

Details:

- Each person is welcomed **once per channel**. The list resets when the bot restarts, so restart it at the start of each stream.
- Viewers who have never set a stream category are not welcomed.
- The bot never welcomes itself, the channels it has joined, or common bots (StreamElements, Nightbot, Moobot, Fossabot). You can change the bot list.
- One bot can join several channels at once.
- You can write your own welcome message.

---

## Contents

1. [Install Node.js](#1-install-nodejs)
2. [Get a copy of the bot](#2-get-a-copy-of-the-bot)
3. [Create your `.env` file](#3-create-your-env-file)
4. [Run the bot](#4-run-the-bot)
5. [Configuration reference](#configuration-reference)
6. [Troubleshooting](#troubleshooting)

---

## 1. Install Node.js

The bot needs **Node.js 20.6 or newer**. To check whether you already have it, open a terminal (Terminal on macOS, PowerShell on Windows) and run:

```sh
node --version
```

If that prints `v20.6.0` or higher, skip to [step 2](#2-get-a-copy-of-the-bot). If it prints an error or an older version, install Node using one of the options below.

### Option A: Installer (easiest)

1. Go to https://nodejs.org.
2. Download the **LTS** version for your operating system.
3. Run the installer and accept the defaults.
4. Close and reopen your terminal, then run `node --version` again to confirm.

### Option B: Package manager

**macOS** (with [Homebrew](https://brew.sh)):

```sh
brew install node
```

**Windows** (with winget, built into Windows 10/11):

```powershell
winget install OpenJS.NodeJS.LTS
```

**Linux** (Debian/Ubuntu, or any system): use [nvm](https://github.com/nvm-sh/nvm), which lets you install and switch Node versions without `sudo`:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# close and reopen your terminal, then:
nvm install --lts
```

Installing Node also installs `npm`, which is used below.

---

## 2. Get a copy of the bot

You also need [Git](https://git-scm.com/downloads). Run `git --version` to check whether it is installed.

### Fork it (recommended if you want your own version on GitHub)

Forking gives you your own copy on GitHub. You can change it and push updates, and it stays linked to the original.

1. Sign in to GitHub and open this repository.
2. Click **Fork** (top right), then **Create fork**.
3. Clone **your fork** to your computer, replacing `YOUR_GITHUB_NAME`:

   ```sh
   git clone https://github.com/YOUR_GITHUB_NAME/ansible-bot.git
   cd ansible-bot
   ```

### Or just clone it

If you only want to run the bot and don't plan to change it:

```sh
git clone https://github.com/enderpipwiggins/ansible-bot.git
cd ansible-bot
```

### Install dependencies

From inside the `ansible-bot` folder:

```sh
npm install
```

---

## 3. Create your `.env` file

The bot reads its settings and secrets from a file named `.env`. A template is included. Copy it:

```sh
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` in a text editor and fill in the values described below.

> ⚠️ `.env` contains passwords for your Twitch account. It is listed in `.gitignore` so Git won't commit it. **Never share it, commit it, or show it on stream.**

### `BOT_USERNAME`

The Twitch account the bot chats as, in lowercase. This can be:

- **Your own account.** Messages will appear from you.
- **A separate bot account** (for example `mychannel_bot`). Create a normal Twitch account for it. In your channel, run `/mod mychannel_bot` so the bot isn't blocked by chat restrictions such as link filtering or slow mode.

### `CHANNELS`

The channel(s) to join, in lowercase, without `#`, separated by commas:

```ini
CHANNELS=mychannel
# or several:
CHANNELS=mychannel,myfriendschannel
```

To post in someone else's channel, ask them first. They will probably want to mod the bot.

### `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`

These identify your "app" to Twitch. The bot uses them to look up what game a viewer last streamed.

1. Go to the [Twitch Developer Console](https://dev.twitch.tv/console/apps) and sign in. You may need to turn on two-factor authentication for your Twitch account first.
2. Click **Register Your Application**.
3. Fill in:
   - **Name:** anything unique, e.g. `mychannel-welcome-bot`
   - **OAuth Redirect URLs:** `http://localhost:3000` (used by the Twitch CLI in the next step)
   - **Category:** Chat Bot
   - **Client Type:** Confidential
4. Click **Create**, then **Manage** next to your new app.
5. Copy the **Client ID** into `TWITCH_CLIENT_ID`.
6. Click **New Secret** and copy the secret into `TWITCH_CLIENT_SECRET`. Twitch shows the secret only once. If you lose it, generate a new one.

### `BOT_OAUTH`

This is the password the bot uses to log in to chat as `BOT_USERNAME`. It is an OAuth token with the `chat:read` and `chat:edit` scopes.

The most reliable way to get one is the official [Twitch CLI](https://dev.twitch.tv/docs/cli/):

1. Install the Twitch CLI:

   ```sh
   # macOS
   brew install twitchdev/twitch/twitch-cli

   # Windows (with Scoop: https://scoop.sh)
   scoop bucket add twitch https://github.com/twitchdev/scoop-bucket.git
   scoop install twitch-cli
   ```

   For other systems, download a release from https://github.com/twitchdev/twitch-cli/releases.

2. Give the CLI your app's credentials. Paste the Client ID and Secret from the previous step when asked:

   ```sh
   twitch configure
   ```

3. **Sign in to Twitch in your browser as the bot account** (`BOT_USERNAME`). If you use a separate bot account, sign out of your main account first or use a private window.

4. Generate the token:

   ```sh
   twitch token -u -s "chat:read chat:edit"
   ```

   A browser window opens and asks you to authorize the app. Approve it, and the terminal prints a **User Access Token**.

5. Put the token in `.env` with `oauth:` in front:

   ```ini
   BOT_OAUTH=oauth:abc123yourtokenhere
   ```

> User tokens expire. If the bot later fails to log in with an authentication error, repeat step 4 to get a new token. You can also run `twitch token --refresh <refresh-token>` with the refresh token printed in step 4.

### Finished example

```ini
BOT_USERNAME=mychannel_bot
BOT_OAUTH=oauth:abc123yourtokenhere
CHANNELS=mychannel
TWITCH_CLIENT_ID=a1b2c3d4e5f6g7h8i9j0
TWITCH_CLIENT_SECRET=z9y8x7w6v5u4t3s2r1q0
```

---

## 4. Run the bot

```sh
npm start
```

When it connects, you'll see:

```
Connected as mychannel_bot to: mychannel
```

Leave the terminal open while you stream. Press **Ctrl+C** to stop the bot. Restarting it clears the list of people who have already been welcomed, so start it fresh each stream.

To test it, ask a friend who streams to say something in your chat.

---

## Configuration reference

All settings go in `.env`.

| Variable | Required | Description |
| --- | --- | --- |
| `BOT_USERNAME` | ✅ | Twitch account the bot chats as |
| `BOT_OAUTH` | ✅ | Chat token for that account (`oauth:...`, scopes `chat:read chat:edit`) |
| `CHANNELS` | ✅ | Comma-separated channels to join |
| `TWITCH_CLIENT_ID` | ✅ | From the Twitch Developer Console |
| `TWITCH_CLIENT_SECRET` | ✅ | From the Twitch Developer Console |
| `SKIP_USERS` | | Comma-separated usernames to never welcome. Default: `streamelements,nightbot,moobot,fossabot`. The bot and joined channels are always skipped. |
| `WELCOME_MESSAGE` | | Custom welcome text (see below) |

### Custom welcome message

`WELCOME_MESSAGE` can include these placeholders:

| Placeholder | Replaced with |
| --- | --- |
| `{displayName}` | The viewer's display name, e.g. `SomeStreamer` |
| `{login}` | Their lowercase username, e.g. `somestreamer` |
| `{game}` | The category they last streamed |
| `{title}` | Their last stream title |

Example:

```ini
WELCOME_MESSAGE=Hey {displayName}! Go check them out, last seen streaming {game} → https://twitch.tv/{login}
```

---

## Troubleshooting

**`Missing required env var: ...`**
That setting is missing or empty in `.env`. Make sure the file is named exactly `.env` (not `.env.txt`) and is in the same folder as `index.js`.

**`node: bad option: --env-file=.env`**
Your Node.js is older than 20.6. Upgrade it (see [step 1](#1-install-nodejs)).

**`Login authentication failed`**
`BOT_OAUTH` is wrong or has expired, or it was generated while signed in as a different account than `BOT_USERNAME`. Generate a new token (see [`BOT_OAUTH`](#bot_oauth)).

**`Failed to get app token: 400` or `403`**
`TWITCH_CLIENT_ID` or `TWITCH_CLIENT_SECRET` is wrong. Copy them again from the Developer Console.

**The bot connects but never welcomes anyone**
- The person may have no stream category set. The bot only welcomes people who have streamed.
- Each person is welcomed only once per run. Restart the bot to reset.
- The bot ignores the channel owner and itself. Test with a different account.
- If the bot's message is posted but hidden, chat restrictions are blocking it. Mod the bot account.

---

## License

[MIT](LICENSE) © 2026 Phillip Andreason

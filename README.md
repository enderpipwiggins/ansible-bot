# ansible-bot

A small Twitch chat bot that welcomes fellow streamers to your channel.

The first time someone chats during a session, the bot looks them up on Twitch. If they have a stream category set, it posts a welcome with the game they last streamed, their stream title, and a link to their channel:

> 📡 Incoming transmission! Welcome SomeStreamer — last seen playing Celeste: "Strawberry hunting!" → https://twitch.tv/somestreamer

Details:

- Each person is welcomed **once per channel**. The list resets when the bot restarts, so restart it at the start of each stream.
- Viewers who have never set a stream category are not welcomed.
- The bot never welcomes itself, the channels it has joined, or common bots (StreamElements, Streamlabs, Nightbot, Moobot, Fossabot). You can change the bot list.
- One bot can join several channels at once.
- You can write your own welcome message, or have the bot run a shoutout command you already use, such as `!so` (see [Using your own `!so` command](#using-your-own-so-command)).

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

   A browser window opens and asks you to authorize the app. Approve it, and the terminal prints a **User Access Token** and a **Refresh Token**.

5. Put both in `.env`. The access token needs `oauth:` in front; the refresh token does not:

   ```ini
   BOT_OAUTH=oauth:abc123yourtokenhere
   BOT_REFRESH_TOKEN=xyz789yourrefreshtokenhere
   ```

### `BOT_REFRESH_TOKEN` (optional, recommended)

The chat token in `BOT_OAUTH` expires after a few hours. With `BOT_REFRESH_TOKEN` set, the bot renews it for you. On startup, on every reconnect, and once an hour while running, the bot checks whether `BOT_OAUTH` still works. If it is expired or about to expire, the bot uses the refresh token to get a new one.

Each refresh gives a new `BOT_OAUTH` **and** a new `BOT_REFRESH_TOKEN`. The bot writes both back into your `.env` file, so you don't have to update anything. You'll see this message in the terminal when it happens:

```
Refreshed BOT_OAUTH and saved it to .env
```

Notes:

- The refresh token only works with the app that created it. `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` must be the same ones you gave to `twitch configure`.
- Refresh tokens stop working if the bot account's password changes or the app is disconnected under Twitch **Settings → Connections**. If that happens, the bot prints `Failed to refresh BOT_OAUTH`. Repeat steps 3–5 above to get a new pair.
- If you leave `BOT_REFRESH_TOKEN` out, the bot uses `BOT_OAUTH` as it is. You will need to generate a new token by hand whenever it expires.

### Finished example

```ini
BOT_USERNAME=mychannel_bot
BOT_OAUTH=oauth:abc123yourtokenhere
BOT_REFRESH_TOKEN=xyz789yourrefreshtokenhere
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

### Keep it running with pm2 (optional)

If the bot can't get a chat token while reconnecting, it exits instead of sitting offline. This can happen after a network drop, or because the refresh token was revoked. A process manager such as [pm2](https://pm2.keymetrics.io) restarts it automatically:

Run these from the `ansible-bot` folder, so `.env` is found. They work on macOS, Linux and Windows:

```sh
npm install -g pm2
pm2 start index.js --name ansible-bot --node-args="--env-file=.env" --exp-backoff-restart-delay=1000
```

`--exp-backoff-restart-delay` makes pm2 wait longer after each failed restart. A revoked token then can't cause a tight restart loop. Other useful commands:

```sh
pm2 logs ansible-bot     # watch the output
pm2 restart ansible-bot  # restart (clears who has been welcomed)
pm2 stop ansible-bot     # stop the bot
```

To start the bot automatically when your computer starts (macOS and Linux):

```sh
pm2 startup   # prints a command to run once; copy and run it
pm2 save      # remembers the running bot so it comes back after a reboot
```

On Windows, `pm2 startup` isn't supported. Use a helper such as [pm2-installer](https://github.com/jessety/pm2-installer), or just run `pm2 start` again after rebooting.

If the logs keep showing `Failed to refresh BOT_OAUTH`, the refresh token no longer works. Generate new tokens (see [`BOT_OAUTH`](#bot_oauth)).

---

## Configuration reference

All settings go in `.env`.

| Variable | Required | Description |
| --- | --- | --- |
| `BOT_USERNAME` | ✅ | Twitch account the bot chats as |
| `BOT_OAUTH` | ✅ | Chat token for that account (`oauth:...`, scopes `chat:read chat:edit`) |
| `BOT_REFRESH_TOKEN` | | Refresh token for `BOT_OAUTH`. When set, the bot renews the chat token automatically and saves both back into `.env`. |
| `CHANNELS` | ✅ | Comma-separated channels to join |
| `TWITCH_CLIENT_ID` | ✅ | From the Twitch Developer Console |
| `TWITCH_CLIENT_SECRET` | ✅ | From the Twitch Developer Console |
| `SKIP_USERS` | | Comma-separated usernames to never welcome (see below) |
| `WELCOME_MESSAGE` | | What the bot posts for a first-time streamer (see below) |

### Skipping users

`SKIP_USERS` lists accounts the bot should never welcome, usually other chat bots. If it is not set, the default is:

```ini
SKIP_USERS=streamelements,streamlabs,nightbot,moobot,fossabot
```

Setting `SKIP_USERS` **replaces** the default list rather than adding to it, so include any of the defaults you still want skipped. For example, to also skip a friend's bot:

```ini
SKIP_USERS=streamelements,streamlabs,nightbot,moobot,fossabot,friends_bot
```

The bot account (`BOT_USERNAME`) and the channels in `CHANNELS` are always skipped, whatever this is set to.

Skipping matters most for chat bots that reply in your chat. Without it, a bot account that has a stream category set would get welcomed itself.

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

### Using your own `!so` command

If you already have a shoutout command in Streamlabs, StreamElements or Nightbot, the bot can run it for you instead of writing its own message:

```ini
WELCOME_MESSAGE=!so {login}
```

When a streamer chats for the first time, the bot posts `!so theirname`, and your chat bot replies with the shoutout you set up. For example, a Streamlabs command like this:

```
!command add !so 📡 Incoming transmission on the ansible! Go check out ${1} — they were last seen playing ${game ${1}}: "${title ${1}}" → https://twitch.tv/${channel ${1}}
```

The bot still skips people with no stream category before sending `!so`, so regulars aren't shouted out.

For this to work:

1. **The bot account must be allowed to use the command.** If `BOT_USERNAME` is your own channel account, it already is. If it's a separate bot account, make it a mod (`/mod yourbotname`). Shoutout commands are usually limited to mods.
2. **The chat bot that replies must be in `SKIP_USERS`.** Streamlabs, StreamElements and Nightbot are skipped by default. If you set `SKIP_USERS` yourself, keep the bot you use in the list. Otherwise its reply could get it shouted out.

If your command has a different name (for example `!shoutout`), use that instead: `WELCOME_MESSAGE=!shoutout {login}`.

---

## Troubleshooting

**`Missing required env var: ...`**
That setting is missing or empty in `.env`. Make sure the file is named exactly `.env` (not `.env.txt`) and is in the same folder as `index.js`.

**`node: bad option: --env-file=.env`**
Your Node.js is older than 20.6. Upgrade it (see [step 1](#1-install-nodejs)).

**`Login authentication failed`**
`BOT_OAUTH` is wrong or has expired, or it was generated while signed in as a different account than `BOT_USERNAME`. Generate a new token (see [`BOT_OAUTH`](#bot_oauth)). Set [`BOT_REFRESH_TOKEN`](#bot_refresh_token-optional-recommended) as well, so expiry is handled automatically.

**`Failed to refresh BOT_OAUTH: 400 ... Invalid refresh token`**
The refresh token is wrong, has been revoked, or came from a different app than `TWITCH_CLIENT_ID`. Generate a new token and refresh token (see [`BOT_OAUTH`](#bot_oauth)) and put both in `.env`.

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

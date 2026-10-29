const fs = require('node:fs');
const path = require('node:path');
const tmi = require('tmi.js');

// ---- Config (see .env.example) ----
function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name} (see .env.example)`);
    process.exit(1);
  }
  return value;
}

const list = (value) =>
  (value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const BOT_USERNAME = required('BOT_USERNAME').toLowerCase();
const BOT_OAUTH = required('BOT_OAUTH');
const CHANNELS = list(required('CHANNELS'));
const CLIENT_ID = required('TWITCH_CLIENT_ID');
const CLIENT_SECRET = required('TWITCH_CLIENT_SECRET');
const WELCOME_MESSAGE =
  process.env.WELCOME_MESSAGE ||
  '📡 Incoming transmission! Welcome {displayName} — last seen playing {game}: "{title}" → https://twitch.tv/{login}';

// Never shout out the bot itself, the channels it sits in, or common bots.
const SKIP = new Set([
  BOT_USERNAME,
  ...CHANNELS,
  ...list(process.env.SKIP_USERS || 'streamelements,streamlabs,nightbot,moobot,fossabot'),
]);

// Per-channel record of who has been welcomed. Resets when the bot restarts.
const seen = new Map(CHANNELS.map((c) => [c, new Set()]));

// ---- Helix API (app access token via client credentials) ----
let appToken = null;

async function fetchAppToken() {
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  if (!r.ok) throw new Error(`Failed to get app token: ${r.status} ${await r.text()}`);
  appToken = (await r.json()).access_token;
}

async function helix(path, retry = true) {
  if (!appToken) await fetchAppToken();
  const r = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: { 'Client-ID': CLIENT_ID, Authorization: `Bearer ${appToken}` },
  });
  // App tokens expire; grab a fresh one and retry once.
  if (r.status === 401 && retry) {
    appToken = null;
    return helix(path, false);
  }
  if (!r.ok) throw new Error(`Helix ${path} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

function render(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

// ---- Chat token (user access token, refreshed with BOT_REFRESH_TOKEN) ----
const ENV_PATH = path.join(__dirname, '.env');
let botToken = BOT_OAUTH.replace(/^oauth:/, '');
let botRefreshToken = process.env.BOT_REFRESH_TOKEN || null;

// True if the token works and has at least 10 minutes left.
async function botTokenIsValid() {
  try {
    const r = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${botToken}` },
    });
    if (!r.ok) return false;
    const { expires_in } = await r.json();
    return expires_in === 0 || expires_in > 600; // 0 = token never expires
  } catch (err) {
    // Network problem, not a bad token. Throwing here would leave tmi.js stuck
    // mid-reconnect, so keep the current token and let tmi.js retry as usual.
    console.error('Token validation unreachable, using current token:', err.message);
    return true;
  }
}

async function refreshBotToken() {
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: botRefreshToken,
    }),
  });
  if (!r.ok) {
    throw new Error(
      `Failed to refresh BOT_OAUTH: ${r.status} ${await r.text()}. ` +
        'Generate a new token and refresh token (see README).'
    );
  }
  const data = await r.json();
  botToken = data.access_token;
  botRefreshToken = data.refresh_token;
  saveEnv({ BOT_OAUTH: `oauth:${botToken}`, BOT_REFRESH_TOKEN: botRefreshToken });
  console.log('Refreshed BOT_OAUTH and saved it to .env');
}

// Rewrite (or append) KEY=value lines in .env so the next start uses the new tokens.
function saveEnv(values) {
  if (!fs.existsSync(ENV_PATH)) return;
  let text = fs.readFileSync(ENV_PATH, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    text = pattern.test(text)
      ? text.replace(pattern, () => line)
      : `${text.replace(/\n?$/, '\n')}${line}\n`;
  }
  // Write a temp file and rename it over .env, so a crash mid-write can't wipe the secrets.
  const tmpPath = `${ENV_PATH}.tmp`;
  fs.writeFileSync(tmpPath, text, { mode: fs.statSync(ENV_PATH).mode });
  fs.renameSync(tmpPath, ENV_PATH);
}

// Shared promise so the hourly check and a reconnect never refresh at the same time
// (Twitch rotates the refresh token, so a second concurrent refresh would fail).
let refreshing = null;

// Called by tmi.js on every connect/reconnect.
async function getBotPassword() {
  try {
    if (botRefreshToken && !(await botTokenIsValid())) {
      refreshing ??= refreshBotToken().finally(() => {
        refreshing = null;
      });
      await refreshing;
    }
    return `oauth:${botToken}`;
  } catch (err) {
    // Log here: tmi.js only reports "Could not get a token." and the bot exits right after.
    console.error(err.message);
    throw err;
  }
}

// ---- Chat client ----
const client = new tmi.Client({
  options: { debug: false },
  identity: { username: BOT_USERNAME, password: getBotPassword },
  channels: CHANNELS,
});

client.on('message', async (channel, tags, msg, self) => {
  const login = tags.username;
  const room = channel.replace(/^#/, '').toLowerCase();
  const seenHere = seen.get(room) ?? seen.set(room, new Set()).get(room);

  if (self || SKIP.has(login) || seenHere.has(login)) return;
  seenHere.add(login);

  let ch;
  try {
    // /channels accepts broadcaster_id only, but the user id is already in the chat tags.
    const info = await helix(`channels?broadcaster_id=${tags['user-id']}`);
    ch = info.data?.[0];
  } catch (err) {
    // Forget them so their next message gets another try.
    seenHere.delete(login);
    console.error(`Lookup for ${login} failed:`, err.message);
    return;
  }
  if (!ch?.game_name) return; // never streamed / no category set

  try {
    await client.say(
      channel,
      render(WELCOME_MESSAGE, {
        displayName: tags['display-name'] || login,
        login,
        game: ch.game_name,
        title: ch.title,
      })
    );
  } catch (err) {
    console.error(`Welcome for ${login} in ${channel} failed:`, err.message);
  }
});

client.on('connected', () => {
  console.log(`Connected as ${BOT_USERNAME} to: ${CHANNELS.join(', ')}`);
});

// If getBotPassword() throws during a reconnect, tmi.js gives up without retrying.
// Exit so a process manager (e.g. pm2) restarts the bot with a fresh connection.
client.on('disconnected', (reason) => {
  if (reason === 'Could not get a token.') {
    console.error('Could not get a chat token; exiting so the process manager can restart.');
    process.exit(1);
  }
});

client.connect().catch((err) => {
  console.error('Failed to connect:', err);
  process.exit(1);
});

// Twitch asks apps to re-validate tokens hourly; this also keeps .env fresh on long streams.
if (botRefreshToken) {
  setInterval(() => {
    getBotPassword().catch((err) => console.error(err.message));
  }, 60 * 60 * 1000);
}

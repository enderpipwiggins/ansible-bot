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

// ---- Chat client ----
const client = new tmi.Client({
  options: { debug: false },
  identity: { username: BOT_USERNAME, password: BOT_OAUTH },
  channels: CHANNELS,
});

client.on('message', async (channel, tags, msg, self) => {
  const login = tags.username;
  const room = channel.replace(/^#/, '').toLowerCase();
  const seenHere = seen.get(room) ?? seen.set(room, new Set()).get(room);

  if (self || SKIP.has(login) || seenHere.has(login)) return;
  seenHere.add(login);

  try {
    // /channels accepts broadcaster_id only, but the user id is already in the chat tags.
    const info = await helix(`channels?broadcaster_id=${tags['user-id']}`);
    const ch = info.data?.[0];
    if (!ch?.game_name) return; // never streamed / no category set

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

client.connect().catch((err) => {
  console.error('Failed to connect:', err);
  process.exit(1);
});

require('dotenv').config();
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { startDiscord } = require('./discord');
const {
  state,
  setInitialKeywords,
  addKeyword,
  updateKeywordConfig,
  removeKeyword,
  setBlacklistForKeyword,
  createPersistentState,
  getMatchingKeywordsForPersistent,
  hydratePersistent,
  getPersistentSnapshot
} = require('./state');

const PORT = Number(process.env.PORT || 2607);
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const INITIAL_KEYWORDS = (process.env.KEYWORDS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

setInitialKeywords(INITIAL_KEYWORDS);

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..')));

app.get('/api/state', (_req, res) => {
  res.json({
    keywords: state.keywords,
    keywordConfigs: state.keywordConfigs,
    columns: state.columns,
    guilds: state.guilds,
    channelsSeen: Object.values(state.channelsSeen),
    blacklistByKeyword: state.blacklistByKeyword,
    status: state.status,
    tag: state.tag,
    lastDiscordMessageAt: state.lastDiscordMessageAt
  });
});

app.get('/', (_req, res) => res.sendFile(path.resolve(__dirname, '..', 'index.html')));

const server = app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
const wss = new WebSocketServer({ server });

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(data);
  }
}

function getClientPersistent(ws) {
  if (!ws.clientPersistent) {
    ws.clientPersistent = getPersistentSnapshot();
  }
  return ws.clientPersistent;
}

function fullInit(ws) {
  const persistent = getClientPersistent(ws);
  return {
    type: 'init',
    keywords: persistent.keywords,
    keywordConfigs: persistent.keywordConfigs,
    columns: {},
    guilds: state.guilds,
    channelsSeen: Object.values(state.channelsSeen),
    blacklistByKeyword: persistent.blacklistByKeyword,
    status: state.status,
    tag: state.tag,
    lastDiscordMessageAt: state.lastDiscordMessageAt,
    persistent
  };
}

function messageToPayload(message, persistent) {
  const content = message.content || '';
  const channelId = message.channel.id;
  const authorId = message.author.id;
  const guild = message.guild;

  const matchedKeywords = getMatchingKeywordsForPersistent(persistent, content, channelId, authorId);
  if (!matchedKeywords.length) return null;

  return {
    type: 'message',
    id: message.id,
    content,
    timestamp: message.createdTimestamp || Date.now(),
    guild: { id: guild.id, name: guild.name },
    channel: { id: channelId, name: message.channel.name || 'unknown' },
    messageUrl: `https://discord.com/channels/${guild.id}/${channelId}/${message.id}`,
    author: {
      id: authorId,
      username: message.author.username,
      displayName: message.member?.displayName || message.author.username,
      avatar: message.author.displayAvatarURL?.({ dynamic: true, size: 128 }) || null
    },
    attachments: [...message.attachments.values()].map((a) => ({
      id: a.id,
      name: a.name || 'attachment',
      url: a.url,
      contentType: a.contentType || ''
    })),
    keywords: matchedKeywords
  };
}

wss.on('connection', (ws) => {
  ws.clientPersistent = getPersistentSnapshot();
  ws.send(JSON.stringify(fullInit(ws)));

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }

    if (data.type === 'resync') {
      return ws.send(JSON.stringify(fullInit(ws)));
    }

    if (data.type === 'hydrate') {
      ws.clientPersistent = createPersistentState(data.persistent || {});
      return ws.send(JSON.stringify(fullInit(ws)));
    }

    // Legacy global handlers retained for compatibility with older clients.
    if (data.type === 'add_keyword') {
      const created = addKeyword(data.keyword || '', data.channels || [], data.guildId || null);
      if (!created) return;
      hydratePersistent(getPersistentSnapshot());
      return broadcast({ type: 'keyword_added', keyword: created, keywords: state.keywords, keywordConfigs: state.keywordConfigs, persistent: getPersistentSnapshot() });
    }

    if (data.type === 'update_keyword_config') {
      const cfg = updateKeywordConfig(data.keyword || '', data.patch || {});
      if (!cfg) return;
      hydratePersistent(getPersistentSnapshot());
      return broadcast({ type: 'keyword_config_updated', keyword: data.keyword, keywordConfigs: state.keywordConfigs, persistent: getPersistentSnapshot() });
    }

    if (data.type === 'remove_keyword') {
      const removed = removeKeyword(data.keyword || '');
      if (!removed) return;
      return broadcast({ type: 'keyword_removed', keyword: removed, keywords: state.keywords, keywordConfigs: state.keywordConfigs, persistent: getPersistentSnapshot() });
    }

    if (data.type === 'blacklist_user') {
      const blocked = data.blocked !== false;
      setBlacklistForKeyword(data.keyword || '', data.user, blocked);
      return broadcast({ type: 'blacklist_updated', blacklistByKeyword: state.blacklistByKeyword, persistent: getPersistentSnapshot() });
    }

    if (data.type === 'unblacklist_user') {
      setBlacklistForKeyword(data.keyword || '', data.user, false);
      return broadcast({ type: 'blacklist_updated', blacklistByKeyword: state.blacklistByKeyword, persistent: getPersistentSnapshot() });
    }
  });
});

startDiscord({
  token: DISCORD_TOKEN,
  onStatus: (s) => {
    state.status = s.status;
    state.tag = s.tag || '';
    broadcast({ type: 'status', ...s });
  },
  onMatchedMessage: (message) => {
    state.lastDiscordMessageAt = Date.now();
    broadcast({ type: 'guilds_updated', guilds: state.guilds });

    for (const client of wss.clients) {
      if (client.readyState !== 1) continue;
      const payload = messageToPayload(message, getClientPersistent(client));
      if (!payload) continue;
      client.send(JSON.stringify(payload));
    }
  }
});

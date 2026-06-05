require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { startDiscord } = require('./discord');
const { state, setInitialKeywords, addKeyword, updateKeywordConfig, removeKeyword, setBlacklistForKeyword, registerChannel, getMatchingKeywords, pushMessageForKeyword, hydratePersistent, getPersistentSnapshot } = require('./state');

const PORT = Number(process.env.PORT || 2607);
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const DISCORD_GUILD = process.env.DISCORD_GUILD || '';
const INITIAL_KEYWORDS = (process.env.KEYWORDS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PERSIST_PATH = path.join(DATA_DIR, 'settings.json');

const loadPersisted = () => { try { return fs.existsSync(PERSIST_PATH) ? JSON.parse(fs.readFileSync(PERSIST_PATH, 'utf8')) : null; } catch { return null; } };
const savePersisted = () => { try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(PERSIST_PATH, JSON.stringify(getPersistentSnapshot(), null, 2), 'utf8'); } catch {} };

const persisted = loadPersisted(); if (persisted) hydratePersistent(persisted); else setInitialKeywords(INITIAL_KEYWORDS);

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..')));
app.get('/api/state', (_req, res) => res.json({ keywords: state.keywords, keywordConfigs: state.keywordConfigs, columns: state.columns, channelsSeen: Object.values(state.channelsSeen), blacklistByKeyword: state.blacklistByKeyword, status: state.status, tag: state.tag, lastDiscordMessageAt: state.lastDiscordMessageAt }));
app.get('/', (_req, res) => res.sendFile(path.resolve(__dirname, '..', 'index.html')));
const server = app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
const wss = new WebSocketServer({ server });

function broadcast(payload) { const data = JSON.stringify(payload); for (const c of wss.clients) if (c.readyState === 1) c.send(data); }
function fullInit() { return { type: 'init', keywords: state.keywords, keywordConfigs: state.keywordConfigs, columns: state.columns, channelsSeen: Object.values(state.channelsSeen), blacklistByKeyword: state.blacklistByKeyword, status: state.status, tag: state.tag, lastDiscordMessageAt: state.lastDiscordMessageAt }; }

function messageToPayload(message) {
  const content = message.content || '';
  const channelId = message.channel.id;
  const authorId = message.author.id;
  registerChannel(channelId, message.channel.name || 'unknown');
  const matchedKeywords = getMatchingKeywords(content, channelId, authorId);
  if (!matchedKeywords.length) return null;
  return { type: 'message', id: message.id, content, timestamp: message.createdTimestamp || Date.now(), guild: { id: message.guild.id, name: message.guild.name }, channel: { id: channelId, name: message.channel.name || 'unknown' }, messageUrl: `https://discord.com/channels/${message.guild.id}/${channelId}/${message.id}`, author: { id: authorId, username: message.author.username, displayName: message.member?.displayName || message.author.username, avatar: message.author.displayAvatarURL?.({ dynamic: true, size: 128 }) || null }, attachments: [...message.attachments.values()].map((a) => ({ id: a.id, name: a.name || 'attachment', url: a.url, contentType: a.contentType || '' })), keywords: matchedKeywords };
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(fullInit()));
  ws.on('message', (raw) => {
    let data; try { data = JSON.parse(raw.toString()); } catch { return; }
    if (data.type === 'resync') return ws.send(JSON.stringify(fullInit()));
    if (data.type === 'add_keyword') { const created = addKeyword(data.keyword || '', data.channels || []); if (!created) return; savePersisted(); return broadcast({ type: 'keyword_added', keyword: created, keywords: state.keywords, keywordConfigs: state.keywordConfigs }); }
    if (data.type === 'update_keyword_config') { const cfg = updateKeywordConfig(data.keyword || '', data.patch || {}); if (!cfg) return; savePersisted(); return broadcast({ type: 'keyword_config_updated', keyword: data.keyword, keywordConfigs: state.keywordConfigs }); }
    if (data.type === 'remove_keyword') { const removed = removeKeyword(data.keyword || ''); if (!removed) return; savePersisted(); return broadcast({ type: 'keyword_removed', keyword: removed, keywords: state.keywords, keywordConfigs: state.keywordConfigs }); }
    if (data.type === 'blacklist_user') { setBlacklistForKeyword(data.keyword || '', data.user, true); savePersisted(); return broadcast({ type: 'blacklist_updated', blacklistByKeyword: state.blacklistByKeyword }); }
    if (data.type === 'unblacklist_user') { setBlacklistForKeyword(data.keyword || '', data.user, false); savePersisted(); return broadcast({ type: 'blacklist_updated', blacklistByKeyword: state.blacklistByKeyword }); }
  });
});

setInterval(() => broadcast({ type: 'health', status: state.status, lastDiscordMessageAt: state.lastDiscordMessageAt, wsClients: wss.clients.size }), 15000);

if (!DISCORD_TOKEN) console.warn('[discord] DISCORD_TOKEN missing.');
else startDiscord({ token: DISCORD_TOKEN, guildId: DISCORD_GUILD, onStatus: ({ status, message, tag }) => { state.status = status; if (tag) state.tag = tag; broadcast({ type: 'status', status, message, tag: state.tag }); }, onMatchedMessage: (message) => { state.lastDiscordMessageAt = Date.now(); const channel = registerChannel(message.channel.id, message.channel.name || 'unknown'); if (channel) broadcast({ type: 'channel_seen', channel }); const payload = messageToPayload(message); if (!payload) return; for (const kw of payload.keywords) pushMessageForKeyword(kw, payload); broadcast(payload); } });

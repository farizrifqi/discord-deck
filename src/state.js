const MAX_PER_KEYWORD = 30;

const state = {
  keywords: [],
  keywordConfigs: {},
  columns: {},
  channelsSeen: {},
  blacklistByKeyword: {}, // { [keyword]: { [userId]: user } }
  status: 'connecting',
  tag: '',
  lastDiscordMessageAt: 0,
};

function normalizeKeyword(keyword = '') {
  let k = String(keyword || '').trim().toLowerCase();
  // normalize over-escaped surrounding quotes: \"abc\" -> "abc"
  if (k.startsWith('\\"') && k.endsWith('\\"') && k.length >= 4) {
    k = `"${k.slice(2, -2)}"`;
  }
  return k;
}
function normalizeChannels(channels) { return Array.isArray(channels) ? [...new Set(channels.map((c) => String(c).trim()).filter(Boolean))] : []; }
function defaultConfig(channels = []) { return { channels: normalizeChannels(channels), caseSensitive: false, showBlacklisted: false }; }

function ensureKeyword(kw) {
  if (!state.columns[kw]) state.columns[kw] = [];
  if (!state.keywordConfigs[kw]) state.keywordConfigs[kw] = defaultConfig();
  if (!state.blacklistByKeyword[kw]) state.blacklistByKeyword[kw] = {};
}

function setInitialKeywords(list = []) {
  state.keywords = [...new Set(list.map(normalizeKeyword).filter(Boolean))];
  state.keywordConfigs = {};
  state.columns = {};
  state.blacklistByKeyword = {};
  state.keywords.forEach((kw) => ensureKeyword(kw));
}

function addKeyword(keyword, channels = []) {
  const kw = normalizeKeyword(keyword);
  if (!kw || state.keywords.includes(kw)) return null;
  state.keywords.push(kw);
  ensureKeyword(kw);
  state.keywordConfigs[kw] = defaultConfig(channels);
  return kw;
}

function updateKeywordConfig(keyword, patch = {}) {
  const kw = normalizeKeyword(keyword);
  if (!state.keywords.includes(kw)) return null;
  const prev = state.keywordConfigs[kw] || defaultConfig();
  state.keywordConfigs[kw] = {
    channels: patch.channels ? normalizeChannels(patch.channels) : prev.channels,
    caseSensitive: typeof patch.caseSensitive === 'boolean' ? patch.caseSensitive : prev.caseSensitive,
    showBlacklisted: typeof patch.showBlacklisted === 'boolean' ? patch.showBlacklisted : prev.showBlacklisted
  };
  return state.keywordConfigs[kw];
}

function removeKeyword(keyword) {
  const kw = normalizeKeyword(keyword);
  if (!state.keywords.includes(kw)) return null;
  state.keywords = state.keywords.filter((k) => k !== kw);
  delete state.columns[kw];
  delete state.keywordConfigs[kw];
  delete state.blacklistByKeyword[kw];
  return kw;
}

function setBlacklistForKeyword(keyword, user, blocked) {
  const kw = normalizeKeyword(keyword);
  if (!user?.id || !state.keywords.includes(kw)) return;
  ensureKeyword(kw);
  if (blocked) state.blacklistByKeyword[kw][user.id] = user;
  else delete state.blacklistByKeyword[kw][user.id];
}

function registerChannel(channelId, channelName) {
  const id = String(channelId || '').trim();
  if (!id) return null;
  state.channelsSeen[id] = { id, name: String(channelName || 'unknown') };
  return state.channelsSeen[id];
}

function keywordHit(content, lower, kw, caseSensitive) {
  const raw = String(kw || '').trim();
  if (!raw) return false;

  // Quoted keyword => exact phrase mode, e.g. "offer car"
  const isQuoted = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"');
  if (isQuoted) {
    const phrase = raw.slice(1, -1).trim();
    if (!phrase) return false;
    const phraseLower = phrase.toLowerCase();
    return caseSensitive ? content.includes(phrase) : lower.includes(phraseLower);
  }

  // Unquoted multi-word => AND mode (all tokens must exist)
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const tokenLower = tokens[0].toLowerCase();
    return caseSensitive ? content.includes(tokens[0]) : lower.includes(tokenLower);
  }

  return tokens.every((t) => {
    const tLower = t.toLowerCase();
    return caseSensitive ? content.includes(t) : lower.includes(tLower);
  });
}

function getMatchingKeywords(content, channelId, authorId) {
  const lower = content.toLowerCase();
  return state.keywords.filter((kw) => {
    const cfg = state.keywordConfigs[kw] || defaultConfig();
    const hit = keywordHit(content, lower, kw, cfg.caseSensitive);
    if (!hit) return false;
    if (cfg.channels.length > 0 && !cfg.channels.includes(channelId)) return false;
    if (!cfg.showBlacklisted && state.blacklistByKeyword[kw]?.[authorId]) return false;
    return true;
  });
}

function pushMessageForKeyword(keyword, msg) {
  if (!state.columns[keyword]) state.columns[keyword] = [];
  state.columns[keyword].unshift(msg);
  while (state.columns[keyword].length > MAX_PER_KEYWORD) state.columns[keyword].pop();
}

function hydratePersistent(p = {}) {
  setInitialKeywords(Array.isArray(p.keywords) ? p.keywords : []);

  const legacyList = Array.isArray(p.blacklist) ? p.blacklist : [];
  const legacyMap = {};
  for (const u of legacyList) {
    if (!u?.id) continue;
    legacyMap[String(u.id)] = { id: String(u.id), username: u.username || '', displayName: u.displayName || u.username || String(u.id) };
  }

  for (const kw of state.keywords) {
    const cfg = p.keywordConfigs?.[kw] || {};
    state.keywordConfigs[kw] = { channels: normalizeChannels(cfg.channels || []), caseSensitive: !!cfg.caseSensitive, showBlacklisted: !!cfg.showBlacklisted };
    const bl = p.blacklistByKeyword?.[kw] || legacyMap;
    state.blacklistByKeyword[kw] = {};
    Object.keys(bl).forEach((uid) => { state.blacklistByKeyword[kw][uid] = bl[uid]; });
  }
}

function getPersistentSnapshot() { return { keywords: [...state.keywords], keywordConfigs: state.keywordConfigs, blacklistByKeyword: state.blacklistByKeyword }; }

module.exports = { state, setInitialKeywords, addKeyword, updateKeywordConfig, removeKeyword, setBlacklistForKeyword, registerChannel, getMatchingKeywords, pushMessageForKeyword, hydratePersistent, getPersistentSnapshot };

const MAX_PER_KEYWORD = 30;

const state = {
  keywords: [],
  keywordConfigs: {},
  columns: {},
  guilds: {},                    // { [guildId]: { id, name, channels: { [channelId]: {id, name} } } }
  channelsSeen: {},
  blacklistByKeyword: {},
  status: 'connecting',
  tag: '',
  lastDiscordMessageAt: 0,
};

function normalizeKeyword(keyword = '') {
  let k = String(keyword || '').trim().toLowerCase();
  if (k.startsWith('\\"') && k.endsWith('\\"') && k.length >= 4) {
    k = `"${k.slice(2, -2)}"`;
  }
  return k;
}

function normalizeChannels(channels) {
  return Array.isArray(channels) ? [...new Set(channels.map((c) => String(c).trim()).filter(Boolean))] : [];
}

function defaultConfig(channels = []) {
  return { channels: normalizeChannels(channels), caseSensitive: false, showBlacklisted: false, guildId: null };
}

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

function addKeyword(keyword, channels = [], guildId = null) {
  const kw = normalizeKeyword(keyword);
  if (!kw || state.keywords.includes(kw)) return null;
  state.keywords.push(kw);
  ensureKeyword(kw);
  state.keywordConfigs[kw] = defaultConfig(channels);
  if (guildId) state.keywordConfigs[kw].guildId = guildId;
  return kw;
}

function updateKeywordConfig(keyword, patch = {}) {
  const kw = normalizeKeyword(keyword);
  if (!state.keywords.includes(kw)) return null;
  const prev = state.keywordConfigs[kw] || defaultConfig();
  state.keywordConfigs[kw] = {
    channels: patch.channels ? normalizeChannels(patch.channels) : prev.channels,
    caseSensitive: typeof patch.caseSensitive === 'boolean' ? patch.caseSensitive : prev.caseSensitive,
    showBlacklisted: typeof patch.showBlacklisted === 'boolean' ? patch.showBlacklisted : prev.showBlacklisted,
    guildId: patch.guildId || prev.guildId || null
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

function registerGuild(guild) {
  if (!guild?.id) return null;
  if (!state.guilds[guild.id]) {
    state.guilds[guild.id] = {
      id: guild.id,
      name: guild.name || 'Unknown Guild',
      channels: {}
    };
  }
  return state.guilds[guild.id];
}

function registerChannel(channelId, channelName, guild = null) {
  const id = String(channelId || '').trim();
  if (!id) return null;

  // Register guild if provided
  if (guild) {
    registerGuild(guild);
    if (state.guilds[guild.id]) {
      state.guilds[guild.id].channels[id] = { id, name: String(channelName || 'unknown') };
    }
  }

  state.channelsSeen[id] = { id, name: String(channelName || 'unknown') };
  return state.channelsSeen[id];
}

function keywordHit(content, lower, kw, caseSensitive) {
  const raw = String(kw || '').trim();
  if (!raw) return false;

  const isQuoted = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"');
  if (isQuoted) {
    const phrase = raw.slice(1, -1).trim();
    if (!phrase) return false;
    const phraseLower = phrase.toLowerCase();
    return caseSensitive ? content.includes(phrase) : lower.includes(phraseLower);
  }

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

  for (const kw of state.keywords) {
    const cfg = p.keywordConfigs?.[kw] || {};
    state.keywordConfigs[kw] = {
      channels: normalizeChannels(cfg.channels || []),
      caseSensitive: !!cfg.caseSensitive,
      showBlacklisted: !!cfg.showBlacklisted,
      guildId: cfg.guildId || null
    };
    const bl = p.blacklistByKeyword?.[kw] || {};
    state.blacklistByKeyword[kw] = {};
    Object.keys(bl).forEach((uid) => { state.blacklistByKeyword[kw][uid] = bl[uid]; });
  }
}

function getPersistentSnapshot() {
  return {
    keywords: [...state.keywords],
    keywordConfigs: state.keywordConfigs,
    blacklistByKeyword: state.blacklistByKeyword
  };
}

module.exports = {
  state,
  setInitialKeywords,
  addKeyword,
  updateKeywordConfig,
  removeKeyword,
  setBlacklistForKeyword,
  registerGuild,
  registerChannel,
  getMatchingKeywords,
  pushMessageForKeyword,
  hydratePersistent,
  getPersistentSnapshot
};
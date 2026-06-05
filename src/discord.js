const { Client } = require('discord.js-selfbot-v13');

function startDiscord({ token, guildId, onStatus, onMatchedMessage }) {
  const client = new Client({ checkUpdate: false });

  client.on('ready', async () => {
    onStatus?.({ status: 'connected', message: 'connected', tag: client.user?.tag || '' });
    console.log(`[discord] Logged in as ${client.user?.tag}`);
  });

  client.on('messageCreate', (message) => {
    if (!message?.guild || message.author?.id === client.user?.id) return;
    if (guildId && message.guild.id !== guildId) return;
    onMatchedMessage?.(message);
  });

  client.on('error', (err) => {
    console.error('[discord] error', err);
    onStatus?.({ status: 'error', message: 'discord error' });
  });

  client.on('disconnect', () => {
    onStatus?.({ status: 'disconnected', message: 'disconnected' });
  });

  client.login(token).catch((err) => {
    console.error('[discord] login failed', err);
    onStatus?.({ status: 'error', message: 'login failed' });
  });

  return client;
}

module.exports = { startDiscord };

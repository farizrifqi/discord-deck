const { Client } = require('discord.js-selfbot-v13');
const { registerChannel } = require('./state');

function startDiscord({ token, onStatus, onMatchedMessage, onChannelSeen }) {
  const client = new Client({ checkUpdate: false });

  client.on('ready', async () => {
    onStatus?.({ status: 'connected', message: 'connected', tag: client.user?.tag || '' });
    console.log(`[discord] Logged in as ${client.user?.tag}`);
  });

  client.on('messageCreate', (message) => {
    if (!message?.guild || message.author?.id === client.user?.id) return;

    // Dynamically register guild + channel from incoming messages
    const seen = registerChannel(message.channel.id, message.channel.name, message.guild);
    if (seen?.changed) onChannelSeen?.(seen);

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

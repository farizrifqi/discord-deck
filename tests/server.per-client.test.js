'use strict';

jest.mock('../src/discord', () => ({
  startDiscord: jest.fn()
}));

jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    listen: jest.fn((port, cb) => {
      if (cb) cb();
      return { on: jest.fn(), close: jest.fn() };
    })
  };
  const express = jest.fn(() => mockApp);
  express.json = jest.fn(() => jest.fn());
  express.static = jest.fn(() => jest.fn());
  return express;
});

let capturedConnectionHandler = null;
global.__mockPerClientWssClients = new Set();

global.__capturePerClientConnectionHandler = (handler) => {
  capturedConnectionHandler = handler;
};

jest.mock('ws', () => {
  const { EventEmitter } = require('events');

  class MockWebSocketServer extends EventEmitter {
    get clients() {
      return global.__mockPerClientWssClients;
    }

    on(event, handler) {
      if (event === 'connection' && typeof global.__capturePerClientConnectionHandler === 'function') {
        global.__capturePerClientConnectionHandler(handler);
      }
      return super.on(event, handler);
    }
  }

  return { WebSocketServer: MockWebSocketServer };
});

function createMockClient() {
  const { EventEmitter } = require('events');
  const client = new EventEmitter();
  client.readyState = 1;
  client.send = jest.fn();
  global.__mockPerClientWssClients.add(client);
  capturedConnectionHandler(client);
  return client;
}

function sendMessage(client, obj) {
  client.emit('message', JSON.stringify(obj));
}

function lastPayloadOfType(client, type) {
  const calls = client.send.mock.calls
    .map(([payload]) => {
      try { return JSON.parse(payload); }
      catch { return null; }
    })
    .filter(Boolean)
    .filter((payload) => payload.type === type);

  return calls[calls.length - 1];
}

function makeDiscordMessage(content) {
  return {
    id: `msg-${content}`,
    content,
    createdTimestamp: Date.now(),
    guild: { id: 'guild-1', name: 'Guild One' },
    channel: { id: 'channel-1', name: 'general' },
    author: {
      id: 'author-1',
      username: 'alice',
      displayAvatarURL: () => null
    },
    member: { displayName: 'Alice' },
    attachments: new Map()
  };
}

beforeAll(() => {
  require('../src/server');
});

beforeEach(() => {
  global.__mockPerClientWssClients.clear();
});

afterAll(() => {
  jest.resetModules();
  delete global.__capturePerClientConnectionHandler;
  delete global.__mockPerClientWssClients;
});

describe('per-client browser configuration', () => {
  test('resync returns that client\'s hydrated keyword state instead of the last browser\'s state', () => {
    const clientA = createMockClient();
    const clientB = createMockClient();

    clientA.send.mockClear();
    clientB.send.mockClear();

    sendMessage(clientA, {
      type: 'hydrate',
      persistent: {
        keywords: ['alpha'],
        keywordConfigs: { alpha: { channels: [], caseSensitive: false, showBlacklisted: false, guildId: null } },
        blacklistByKeyword: {}
      }
    });

    sendMessage(clientB, {
      type: 'hydrate',
      persistent: {
        keywords: ['beta'],
        keywordConfigs: { beta: { channels: [], caseSensitive: false, showBlacklisted: false, guildId: null } },
        blacklistByKeyword: {}
      }
    });

    clientA.send.mockClear();
    sendMessage(clientA, { type: 'resync' });

    const initPayload = lastPayloadOfType(clientA, 'init');
    expect(initPayload.keywords).toEqual(['alpha']);
  });

  test('incoming Discord messages are filtered using each browser\'s own keywords', () => {
    const { startDiscord } = require('../src/discord');
    const onMatchedMessage = startDiscord.mock.calls[0][0].onMatchedMessage;

    const clientA = createMockClient();
    const clientB = createMockClient();

    sendMessage(clientA, {
      type: 'hydrate',
      persistent: {
        keywords: ['alpha'],
        keywordConfigs: { alpha: { channels: [], caseSensitive: false, showBlacklisted: false, guildId: null } },
        blacklistByKeyword: {}
      }
    });

    sendMessage(clientB, {
      type: 'hydrate',
      persistent: {
        keywords: ['beta'],
        keywordConfigs: { beta: { channels: [], caseSensitive: false, showBlacklisted: false, guildId: null } },
        blacklistByKeyword: {}
      }
    });

    clientA.send.mockClear();
    clientB.send.mockClear();

    onMatchedMessage(makeDiscordMessage('beta launch tonight'));

    expect(lastPayloadOfType(clientA, 'message')).toBeUndefined();
    expect(lastPayloadOfType(clientB, 'message')).toMatchObject({
      type: 'message',
      keywords: ['beta'],
      content: 'beta launch tonight'
    });
  });
});

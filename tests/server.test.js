'use strict';

/**
 * Tests for src/server.js - focused on the PR changes:
 *   - Removed: `unblacklist_user` WebSocket message handler
 *   - Retained: `blacklist_user` WebSocket message handler
 */

// --- Mock discord module (prevents actual Discord connection) ---
jest.mock('../src/discord', () => ({
  startDiscord: jest.fn()
}));

// --- Mock fs to avoid actual file I/O ---
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// --- Mock express to prevent actual HTTP server binding ---
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    listen: jest.fn((port, cb) => {
      if (cb) cb();
      // Return a mock server object
      return { on: jest.fn(), close: jest.fn() };
    })
  };
  const express = jest.fn(() => mockApp);
  express.json = jest.fn(() => jest.fn());
  express.static = jest.fn(() => jest.fn());
  return express;
});

// Capture the WebSocketServer connection handler so tests can invoke it directly
let capturedConnectionHandler = null;

// Use a global shared Set so that both the jest.mock factory and test body can access it
global.__mockWssClients = new Set();

jest.mock('ws', () => {
  // Use require inside the factory to avoid out-of-scope variable issues
  const { EventEmitter } = require('events');

  class MockWebSocket extends EventEmitter {
    constructor() {
      super();
      this.readyState = 1; // OPEN
      this.send = jest.fn();
    }
  }

  class MockWebSocketServer extends EventEmitter {
    constructor() {
      super();
    }
    get clients() {
      // Read from the globally shared Set so tests can add clients
      return global.__mockWssClients;
    }
    on(event, handler) {
      if (event === 'connection') {
        if (typeof global.__captureConnectionHandler === 'function') {
          global.__captureConnectionHandler(handler);
        }
      }
      return super.on(event, handler);
    }
  }

  MockWebSocket.OPEN = 1;
  return { WebSocketServer: MockWebSocketServer, _MockWebSocket: MockWebSocket };
});

// Set up capture before server loads
global.__captureConnectionHandler = (handler) => {
  capturedConnectionHandler = handler;
};

// Helper: create a mock client, add it to the shared clients Set, and simulate a connection
function createMockClient() {
  const { EventEmitter } = require('events');
  const client = new EventEmitter();
  client.readyState = 1;
  client.send = jest.fn();

  global.__mockWssClients.add(client);

  if (capturedConnectionHandler) {
    capturedConnectionHandler(client);
  }
  return client;
}

// Helper: clean up client from shared set after test
function removeClient(client) {
  global.__mockWssClients.delete(client);
}

// Helper: simulate a client sending a WebSocket message
function sendMessage(client, obj) {
  client.emit('message', JSON.stringify(obj));
}

// --- Load server after all mocks are in place ---
beforeAll(() => {
  require('../src/server');
});

beforeEach(() => {
  // Reset state between tests
  const stateModule = require('../src/state');
  stateModule.setInitialKeywords(['testkw']);
  stateModule.state.blacklistByKeyword = { testkw: {} };
  // Clear clients from previous test
  global.__mockWssClients.clear();
});

afterAll(() => {
  jest.resetModules();
  delete global.__captureConnectionHandler;
});

// ---------------------------------------------------------------------------
// Tests for the removed `unblacklist_user` handler
// ---------------------------------------------------------------------------
describe('unblacklist_user message (removed in PR)', () => {
  test('does NOT remove a user from the blacklist when sent', () => {
    const { state: stateModule } = require('../src/state');
    const kw = 'testkw';
    const userId = 'user-abc';

    // Manually add user to blacklist so we can verify it stays there
    stateModule.blacklistByKeyword[kw] = { [userId]: { id: userId, username: 'testuser' } };

    const client = createMockClient();
    sendMessage(client, { type: 'unblacklist_user', keyword: kw, user: { id: userId } });

    // User should still be in the blacklist (handler was removed, so no effect)
    expect(stateModule.blacklistByKeyword[kw][userId]).toBeDefined();
    expect(stateModule.blacklistByKeyword[kw][userId].id).toBe(userId);
  });

  test('does NOT throw or crash the server when unblacklist_user is sent with valid payload', () => {
    const client = createMockClient();
    expect(() => {
      sendMessage(client, { type: 'unblacklist_user', keyword: 'testkw', user: { id: 'u1', username: 'user1' } });
    }).not.toThrow();
  });

  test('does NOT throw or crash when unblacklist_user is sent with missing user', () => {
    const client = createMockClient();
    expect(() => {
      sendMessage(client, { type: 'unblacklist_user', keyword: 'testkw' });
    }).not.toThrow();
  });

  test('does NOT throw or crash when unblacklist_user is sent with missing keyword', () => {
    const client = createMockClient();
    expect(() => {
      sendMessage(client, { type: 'unblacklist_user', user: { id: 'u1' } });
    }).not.toThrow();
  });

  test('send count does not increase when unblacklist_user is sent (no response back)', () => {
    const client = createMockClient();
    // The connection itself triggers one send (fullInit), so clear that
    client.send.mockClear();
    sendMessage(client, { type: 'unblacklist_user', keyword: 'testkw', user: { id: 'some-user' } });
    // No direct response expected (unblacklist_user handler is removed)
    expect(client.send).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests for the retained `blacklist_user` handler
// ---------------------------------------------------------------------------
describe('blacklist_user message (still present after PR)', () => {
  test('adds user to blacklist state when blacklist_user is sent', () => {
    const { state: stateModule } = require('../src/state');
    const kw = 'testkw';
    const user = { id: 'user-bl-1', username: 'blocked_user' };

    const client = createMockClient();
    sendMessage(client, { type: 'blacklist_user', keyword: kw, user });

    expect(stateModule.blacklistByKeyword[kw]).toBeDefined();
    expect(stateModule.blacklistByKeyword[kw][user.id]).toBeDefined();
    expect(stateModule.blacklistByKeyword[kw][user.id].id).toBe(user.id);
  });

  test('blacklist_user with unknown keyword does not add to blacklist state', () => {
    const { state: stateModule } = require('../src/state');
    const user = { id: 'user-bl-3', username: 'ghost' };

    const client = createMockClient();
    sendMessage(client, { type: 'blacklist_user', keyword: 'nonexistent_kw', user });

    expect(stateModule.blacklistByKeyword['nonexistent_kw']).toBeUndefined();
  });

  test('blacklist_user with missing user id does not crash', () => {
    const client = createMockClient();
    expect(() => {
      sendMessage(client, { type: 'blacklist_user', keyword: 'testkw', user: {} });
    }).not.toThrow();
  });

  test('blacklist_user responds back to all clients', () => {
    const { state: stateModule } = require('../src/state');
    const kw = 'testkw';
    const user = { id: 'user-bl-2', username: 'another_blocked' };

    const client = createMockClient();
    client.send.mockClear();
    sendMessage(client, { type: 'blacklist_user', keyword: kw, user });

    // broadcast should have sent a blacklist_updated message back
    const calls = client.send.mock.calls;
    const broadcastCall = calls.find(call => {
      try { return JSON.parse(call[0]).type === 'blacklist_updated'; }
      catch { return false; }
    });
    expect(broadcastCall).toBeDefined();
    const payload = JSON.parse(broadcastCall[0]);
    expect(payload.blacklistByKeyword).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Regression: removing unblacklist_user handler doesn't break other handlers
// ---------------------------------------------------------------------------
describe('other WebSocket handlers still work after unblacklist_user removal', () => {
  test('resync returns full init payload to requesting client', () => {
    const client = createMockClient();
    client.send.mockClear();

    sendMessage(client, { type: 'resync' });

    expect(client.send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(client.send.mock.calls[0][0]);
    expect(payload.type).toBe('init');
    expect(payload.keywords).toBeDefined();
  });

  test('new client connection receives init payload immediately', () => {
    const client = createMockClient();
    // The first send call on a new connection is the init message
    expect(client.send).toHaveBeenCalled();
    const payload = JSON.parse(client.send.mock.calls[0][0]);
    expect(payload.type).toBe('init');
  });

  test('add_keyword updates state and sends keyword_added response', () => {
    const { state: stateModule } = require('../src/state');
    const initialCount = stateModule.keywords.length;

    const client = createMockClient();
    client.send.mockClear();
    sendMessage(client, { type: 'add_keyword', keyword: 'newkeyword', channels: [] });

    expect(stateModule.keywords).toContain('newkeyword');
    expect(stateModule.keywords.length).toBe(initialCount + 1);

    const broadcastCall = client.send.mock.calls.find(call => {
      try { return JSON.parse(call[0]).type === 'keyword_added'; }
      catch { return false; }
    });
    expect(broadcastCall).toBeDefined();
  });

  test('remove_keyword updates state and sends keyword_removed response', () => {
    const { state: stateModule } = require('../src/state');

    // Ensure 'testkw' exists
    if (!stateModule.keywords.includes('testkw')) {
      require('../src/state').addKeyword('testkw', [], null);
    }

    const client = createMockClient();
    client.send.mockClear();
    sendMessage(client, { type: 'remove_keyword', keyword: 'testkw' });

    expect(stateModule.keywords).not.toContain('testkw');

    const broadcastCall = client.send.mock.calls.find(call => {
      try { return JSON.parse(call[0]).type === 'keyword_removed'; }
      catch { return false; }
    });
    expect(broadcastCall).toBeDefined();
  });

  test('update_keyword_config updates config and sends keyword_config_updated response', () => {
    const { state: stateModule } = require('../src/state');

    const client = createMockClient();
    client.send.mockClear();
    sendMessage(client, { type: 'update_keyword_config', keyword: 'testkw', patch: { caseSensitive: true } });

    expect(stateModule.keywordConfigs['testkw'].caseSensitive).toBe(true);

    const broadcastCall = client.send.mock.calls.find(call => {
      try { return JSON.parse(call[0]).type === 'keyword_config_updated'; }
      catch { return false; }
    });
    expect(broadcastCall).toBeDefined();
  });

  test('invalid JSON message does not crash the server', () => {
    const client = createMockClient();
    expect(() => {
      client.emit('message', '{ invalid json ');
    }).not.toThrow();
  });

  test('unknown message type is silently ignored (no crash)', () => {
    const client = createMockClient();
    expect(() => {
      sendMessage(client, { type: 'unknown_type_that_does_not_exist', data: 'test' });
    }).not.toThrow();
  });
});

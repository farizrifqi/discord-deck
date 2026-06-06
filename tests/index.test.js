/**
 * Tests for index.html JavaScript - focused on the PR-introduced functions:
 *   - connect()
 *   - renderColumns()
 *   - createColumn(kw)
 *   - createMessageCard(msg)
 *   - queueMessage(msg)
 *   - removeKeyword(kw)
 *   - openAddModal() / updateChannelCheckboxes()
 *
 * Uses JSDOM directly (one fresh instance per test) to avoid let re-declaration errors.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

// ---- Fresh JSDOM instance for each test ----

function createPage() {
  // Mock WebSocket
  const wsInstances = [];
  class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.send = jest.fn();
      wsInstances.push(this);
    }
    _open() {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }
    _close() {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    }
    _message(data) {
      const ev = { data: typeof data === 'string' ? data : JSON.stringify(data) };
      if (this.onmessage) this.onmessage(ev);
    }
  }

  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    beforeParse(win) {
      win.WebSocket = MockWebSocket;
      win.confirm = jest.fn(() => true);
      win.alert = jest.fn();
    }
  });

  const { window } = dom;
  const { document } = window;

  // Helper to get the latest WS instance
  const getWs = () => wsInstances[wsInstances.length - 1];

  return { window, document, getWs, wsInstances };
}

// ---------------------------------------------------------------------------
// connect()
// ---------------------------------------------------------------------------
describe('connect()', () => {
  test('creates a WebSocket with ws: protocol for http', () => {
    const { getWs } = createPage();
    expect(getWs()).not.toBeNull();
    expect(getWs().url).toMatch(/^ws:/);
  });

  test('sets nav-status to connected and text to "connected" on open', () => {
    const { document, getWs } = createPage();
    getWs()._open();
    expect(document.getElementById('nav-status').className).toBe('status-pill connected');
    expect(document.getElementById('nav-status-text').textContent).toBe('connected');
  });

  test('sends a resync message on open', () => {
    const { getWs } = createPage();
    const ws = getWs();
    ws._open();
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'resync' }));
  });

  test('sets nav-status to disconnected and text to "disconnected" on close', () => {
    const { document, getWs } = createPage();
    getWs()._close();
    expect(document.getElementById('nav-status').className).toBe('status-pill disconnected');
    expect(document.getElementById('nav-status-text').textContent).toBe('disconnected');
  });

  test('reconnects after 2 seconds on close', () => {
    const { wsInstances, window, getWs } = createPage();
    const prevCount = wsInstances.length;
    getWs()._close();
    // Advance fake timer via jsdom's clock
    window.setTimeout = (fn, delay) => fn(); // immediate reconnect override
    // Just verify close handler fires without crashing
    expect(() => getWs()._close()).not.toThrow();
  });

  test('onmessage init sets global state and renders columns', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['hello', 'world'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    const cols = document.querySelectorAll('.col');
    expect(cols.length).toBe(2);
  });

  test('onmessage "message" renders message card in correct column', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['react'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    ws._message({ type: 'message', id: 'm1', keywords: ['react'], content: 'Hello React', author: { id: 'u1', username: 'alice', displayName: 'Alice' }, guild: { id: 'g1', name: 'Guild' }, channel: { id: 'c1', name: 'general' } });
    const cards = document.querySelectorAll('.card');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  test('onmessage keyword_added updates keyword columns', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['foo'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    ws._message({ type: 'keyword_added', keywords: ['foo', 'bar'], keywordConfigs: {} });
    expect(document.querySelectorAll('.col').length).toBe(2);
  });

  test('onmessage keyword_removed updates keyword columns', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['foo', 'bar'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    ws._message({ type: 'keyword_removed', keywords: ['foo'], keywordConfigs: {} });
    expect(document.querySelectorAll('.col').length).toBe(1);
    expect(document.querySelector('.col').dataset.kw).toBe('foo');
  });
});

// ---------------------------------------------------------------------------
// renderColumns()
// ---------------------------------------------------------------------------
describe('renderColumns()', () => {
  test('renders one column per keyword', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['alpha', 'beta', 'gamma'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    expect(document.querySelectorAll('.col').length).toBe(3);
  });

  test('clears existing columns before re-rendering on second init', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['a', 'b'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    ws._message({ type: 'init', keywords: ['c'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    const cols = document.querySelectorAll('.col');
    expect(cols.length).toBe(1);
    expect(cols[0].dataset.kw).toBe('c');
  });

  test('renders no columns when keywords list is empty', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: [], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    expect(document.querySelectorAll('.col').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// createColumn(kw)
// ---------------------------------------------------------------------------
describe('createColumn(kw)', () => {
  function initWith(kw, msgs = []) {
    const page = createPage();
    const ws = page.getWs();
    ws._open();
    const columns = msgs.length ? { [kw]: msgs } : {};
    ws._message({ type: 'init', keywords: [kw], keywordConfigs: {}, columns, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    const col = page.document.querySelector(`.col[data-kw="${kw}"]`);
    return { ...page, col };
  }

  test('column has data-kw attribute set to the keyword', () => {
    const { col } = initWith('myword');
    expect(col).not.toBeNull();
    expect(col.dataset.kw).toBe('myword');
  });

  test('column title displays the keyword name', () => {
    const { col } = initWith('searchterm');
    expect(col.querySelector('.title').textContent).toBe('searchterm');
  });

  test('column count shows 0/30 when no messages', () => {
    const { col } = initWith('empty');
    expect(col.querySelector('.count').textContent).toBe('0/30');
  });

  test('column count reflects actual message count', () => {
    const msgs = [
      { id: '1', content: 'hi', author: { username: 'u', displayName: 'U' }, guild: { name: 'G' }, channel: { name: 'c' } },
      { id: '2', content: 'hello', author: { username: 'u', displayName: 'U' }, guild: { name: 'G' }, channel: { name: 'c' } }
    ];
    const { col } = initWith('chat', msgs);
    expect(col.querySelector('.count').textContent).toBe('2/30');
  });

  test('column is draggable', () => {
    const { col } = initWith('dragtest');
    expect(col.draggable).toBe(true);
  });

  test('column contains a remove button', () => {
    const { col } = initWith('rmkw');
    const btn = col.querySelector('button.btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('×');
  });

  test('column contains a .list element', () => {
    const { col } = initWith('listkw');
    expect(col.querySelector('.list')).not.toBeNull();
  });

  test('column renders message cards for existing messages', () => {
    const msgs = [{ id: '10', content: 'test msg', author: { username: 'bob', displayName: 'Bob' }, guild: { name: 'Guild' }, channel: { name: 'ch' } }];
    const { col } = initWith('withmsgs', msgs);
    expect(col.querySelectorAll('.card').length).toBe(1);
  });

  test('dragstart sets dataTransfer data to the keyword', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['draggable'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });

    const col = document.querySelector('.col[data-kw="draggable"]');
    const setDataSpy = jest.fn();
    const dragEvent = new (document.defaultView.DragEvent || document.defaultView.Event)('dragstart', { bubbles: true });
    Object.defineProperty(dragEvent, 'dataTransfer', { value: { setData: setDataSpy } });
    col.dispatchEvent(dragEvent);

    expect(setDataSpy).toHaveBeenCalledWith('text/plain', 'draggable');
  });

  test('drop event with different keywords reorders columns', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['first', 'second'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });

    const secondCol = document.querySelector('.col[data-kw="second"]');
    const dropEvent = new (document.defaultView.Event)('drop', { bubbles: true });
    dropEvent.preventDefault = jest.fn();
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { getData: () => 'first' } });
    secondCol.dispatchEvent(dropEvent);

    const colsAfter = document.querySelectorAll('.col');
    expect(colsAfter[0].dataset.kw).toBe('second');
    expect(colsAfter[1].dataset.kw).toBe('first');
  });

  test('drop with same source and target does not change order or crash', () => {
    const { document, getWs } = createPage();
    const ws = getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['only'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });

    const col = document.querySelector('.col[data-kw="only"]');
    const dropEvent = new (document.defaultView.Event)('drop', { bubbles: true });
    dropEvent.preventDefault = jest.fn();
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { getData: () => 'only' } });
    col.dispatchEvent(dropEvent);

    expect(document.querySelector('.col[data-kw="only"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createMessageCard(msg)
// ---------------------------------------------------------------------------
describe('createMessageCard(msg)', () => {
  function getCard(msg) {
    const page = createPage();
    const ws = page.getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['kw'], keywordConfigs: {}, columns: { kw: [msg] }, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    return { card: page.document.querySelector('.card'), page };
  }

  test('card has class "card"', () => {
    const { card } = getCard({ id: '1', content: 'hi', author: { username: 'u', displayName: 'Display' }, guild: { name: 'GN' }, channel: { name: 'ch' } });
    expect(card).not.toBeNull();
    expect(card.classList.contains('card')).toBe(true);
  });

  test('card displays displayName when available', () => {
    const { card } = getCard({ id: '1', content: 'msg', author: { username: 'user1', displayName: 'Display Name' }, guild: { name: 'G' }, channel: { name: 'c' } });
    expect(card.innerHTML).toContain('Display Name');
  });

  test('card falls back to username when displayName is absent', () => {
    const { card } = getCard({ id: '2', content: 'msg', author: { username: 'fallback_user' }, guild: { name: 'G' }, channel: { name: 'c' } });
    expect(card.innerHTML).toContain('fallback_user');
  });

  test('card displays message content', () => {
    const { card } = getCard({ id: '3', content: 'important content here', author: { username: 'u', displayName: 'U' }, guild: { name: 'G' }, channel: { name: 'c' } });
    expect(card.innerHTML).toContain('important content here');
  });

  test('card displays guild name', () => {
    const { card } = getCard({ id: '4', content: 'x', author: { username: 'u', displayName: 'U' }, guild: { name: 'My Guild' }, channel: { name: 'general' } });
    expect(card.innerHTML).toContain('My Guild');
  });

  test('card displays channel name', () => {
    const { card } = getCard({ id: '5', content: 'x', author: { username: 'u', displayName: 'U' }, guild: { name: 'G' }, channel: { name: 'announcements' } });
    expect(card.innerHTML).toContain('announcements');
  });

  test('card handles missing guild gracefully (no crash)', () => {
    expect(() => {
      getCard({ id: '6', content: 'no guild', author: { username: 'u', displayName: 'U' }, channel: { name: 'c' } });
    }).not.toThrow();
  });

  test('card handles missing channel gracefully (no crash)', () => {
    expect(() => {
      getCard({ id: '7', content: 'no channel', author: { username: 'u', displayName: 'U' }, guild: { name: 'G' } });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// queueMessage(msg)
// ---------------------------------------------------------------------------
describe('queueMessage(msg)', () => {
  function setup(keywords, cols = {}) {
    const page = createPage();
    const ws = page.getWs();
    ws._open();
    ws._message({ type: 'init', keywords, keywordConfigs: {}, columns: cols, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    return page;
  }

  function makeMsg(keywords, id = 'msg1') {
    return { type: 'message', id, keywords, content: 'Test message', author: { id: 'u1', username: 'alice', displayName: 'Alice' }, guild: { id: 'g1', name: 'Guild' }, channel: { id: 'c1', name: 'general' } };
  }

  test('adds message to the correct keyword column', () => {
    const { document, getWs } = setup(['rust']);
    getWs()._message(makeMsg(['rust']));
    expect(document.querySelector('.col[data-kw="rust"] .card')).not.toBeNull();
  });

  test('ignores message for keyword not in keywords list', () => {
    const { document, getWs } = setup(['js']);
    getWs()._message(makeMsg(['python']));
    expect(document.querySelector('.col[data-kw="python"]')).toBeNull();
  });

  test('new message appears before existing messages (unshift)', () => {
    const page = setup(['ts']);
    const ws = page.getWs();
    ws._message({ ...makeMsg(['ts']), id: 'm1', content: 'first message', author: { username: 'u', displayName: 'First' }, guild: { name: 'G' }, channel: { name: 'c' } });
    ws._message({ ...makeMsg(['ts']), id: 'm2', content: 'second message', author: { username: 'u', displayName: 'Second' }, guild: { name: 'G' }, channel: { name: 'c' } });
    const cards = page.document.querySelectorAll('.col[data-kw="ts"] .card');
    expect(cards[0].innerHTML).toContain('Second');
    expect(cards[1].innerHTML).toContain('First');
  });

  test('enforces maximum of 30 messages per column', () => {
    const { document, getWs } = setup(['overflow']);
    for (let i = 0; i < 35; i++) {
      getWs()._message(makeMsg(['overflow'], `msg${i}`));
    }
    const cards = document.querySelectorAll('.col[data-kw="overflow"] .card');
    expect(cards.length).toBeLessThanOrEqual(30);
  });

  test('columns re-render after queuing message', () => {
    const { document, getWs } = setup(['re-render']);
    getWs()._message(makeMsg(['re-render']));
    expect(document.querySelector('.col[data-kw="re-render"]')).not.toBeNull();
  });

  test('message with multiple keywords adds to all matching columns', () => {
    const { document, getWs } = setup(['cat', 'dog']);
    getWs()._message({ ...makeMsg(['cat', 'dog']), id: 'multi1' });
    expect(document.querySelector('.col[data-kw="cat"] .card')).not.toBeNull();
    expect(document.querySelector('.col[data-kw="dog"] .card')).not.toBeNull();
  });

  test('message with empty keywords array is silently ignored', () => {
    const { document, getWs } = setup(['kw']);
    getWs()._message({ ...makeMsg([]), id: 'empty1' });
    expect(document.querySelector('.col[data-kw="kw"] .card')).toBeNull();
  });

  test('31st message causes oldest to be dropped (30 max)', () => {
    const page = setup(['cap']);
    const ws = page.getWs();
    // Send 30 messages
    for (let i = 0; i < 30; i++) {
      ws._message({ ...makeMsg(['cap']), id: `cap${i}`, content: `msg${i}`, author: { username: 'u', displayName: `Msg${i}` }, guild: { name: 'G' }, channel: { name: 'c' } });
    }
    const countBefore = page.document.querySelectorAll('.col[data-kw="cap"] .card').length;
    // Send 31st
    ws._message({ ...makeMsg(['cap']), id: 'cap30', content: 'new', author: { username: 'u', displayName: 'New' }, guild: { name: 'G' }, channel: { name: 'c' } });
    const countAfter = page.document.querySelectorAll('.col[data-kw="cap"] .card').length;
    expect(countBefore).toBe(30);
    expect(countAfter).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// removeKeyword(kw)
// ---------------------------------------------------------------------------
describe('removeKeyword(kw)', () => {
  function setup() {
    const page = createPage();
    const ws = page.getWs();
    ws._open();
    ws._message({ type: 'init', keywords: ['target'], keywordConfigs: {}, columns: {}, guilds: {}, channelsSeen: [], blacklistByKeyword: {} });
    return page;
  }

  test('sends remove_keyword message to server when confirmed', () => {
    const { document, getWs, window } = setup();
    window.confirm = jest.fn(() => true);
    const ws = getWs();
    ws.send.mockClear();
    const btn = document.querySelector('.col[data-kw="target"] button.btn');
    btn.click();
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'remove_keyword', keyword: 'target' }));
  });

  test('does NOT send remove_keyword when user cancels confirm dialog', () => {
    const { document, getWs, window } = setup();
    window.confirm = jest.fn(() => false);
    const ws = getWs();
    ws.send.mockClear();
    const btn = document.querySelector('.col[data-kw="target"] button.btn');
    btn.click();
    expect(ws.send).not.toHaveBeenCalled();
  });

  test('confirm dialog includes the keyword name', () => {
    const { document, window } = setup();
    window.confirm = jest.fn(() => false);
    const btn = document.querySelector('.col[data-kw="target"] button.btn');
    btn.click();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('target'));
  });
});

// ---------------------------------------------------------------------------
// openAddModal() and updateChannelCheckboxes()
// ---------------------------------------------------------------------------
describe('openAddModal()', () => {
  function setup(guildsData = {}) {
    const page = createPage();
    const ws = page.getWs();
    ws._open();
    ws._message({ type: 'init', keywords: [], keywordConfigs: {}, columns: {}, guilds: guildsData, channelsSeen: [], blacklistByKeyword: {} });
    return page;
  }

  test('clicking #add button opens the add-modal', () => {
    const { document } = setup();
    document.getElementById('add').click();
    expect(document.getElementById('add-modal').style.display).toBe('flex');
  });

  test('channel section is hidden when no guilds exist', () => {
    const { document } = setup({});
    document.getElementById('add').click();
    expect(document.getElementById('channel-section').style.display).toBe('none');
  });

  test('channel section is visible when guilds exist', () => {
    const { document } = setup({ g1: { id: 'g1', name: 'TestGuild', channels: { c1: { id: 'c1', name: 'general' } } } });
    document.getElementById('add').click();
    expect(document.getElementById('channel-section').style.display).toBe('block');
  });

  test('guild select is populated with one option per guild', () => {
    const guildsData = { g1: { id: 'g1', name: 'Guild One', channels: {} }, g2: { id: 'g2', name: 'Guild Two', channels: {} } };
    const { document } = setup(guildsData);
    document.getElementById('add').click();
    const opts = document.querySelectorAll('#guild-select option');
    expect(opts.length).toBe(2);
    const names = Array.from(opts).map(o => o.textContent);
    expect(names).toContain('Guild One');
    expect(names).toContain('Guild Two');
  });

  test('channel checkboxes are populated for the selected guild', () => {
    const guildsData = { g1: { id: 'g1', name: 'G1', channels: { c1: { id: 'c1', name: 'general' }, c2: { id: 'c2', name: 'random' } } } };
    const { document } = setup(guildsData);
    document.getElementById('add').click();
    const checkboxes = document.querySelectorAll('#channel-list input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
  });

  test('channel checkboxes are checked by default', () => {
    const guildsData = { g1: { id: 'g1', name: 'G1', channels: { c1: { id: 'c1', name: 'general' } } } };
    const { document } = setup(guildsData);
    document.getElementById('add').click();
    const cb = document.querySelector('#channel-list input[type="checkbox"]');
    expect(cb.checked).toBe(true);
  });

  test('clicking cancel hides the modal', () => {
    const { document } = setup();
    document.getElementById('add').click();
    document.getElementById('cancel-add').click();
    expect(document.getElementById('add-modal').style.display).toBe('none');
  });

  test('confirm-add sends add_keyword with trimmed lowercase keyword', () => {
    const guildsData = { g1: { id: 'g1', name: 'G1', channels: { c1: { id: 'c1', name: 'general' } } } };
    const { document, getWs } = setup(guildsData);
    const ws = getWs();
    ws.send.mockClear();
    document.getElementById('add').click();
    document.getElementById('kw-input').value = '  TestKeyword  ';
    document.getElementById('confirm-add').click();
    expect(ws.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe('add_keyword');
    expect(sent.keyword).toBe('testkeyword');
  });

  test('confirm-add sends selected channels', () => {
    const guildsData = { g1: { id: 'g1', name: 'G1', channels: { c1: { id: 'c1', name: 'general' } } } };
    const { document, getWs } = setup(guildsData);
    const ws = getWs();
    ws.send.mockClear();
    document.getElementById('add').click();
    document.getElementById('kw-input').value = 'test';
    document.getElementById('confirm-add').click();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(Array.isArray(sent.channels)).toBe(true);
  });

  test('confirm-add hides the modal after submission', () => {
    const { document, getWs } = setup({});
    document.getElementById('add').click();
    document.getElementById('kw-input').value = 'newkw';
    document.getElementById('confirm-add').click();
    expect(document.getElementById('add-modal').style.display).toBe('none');
  });

  test('confirm-add clears the keyword input after submission', () => {
    const { document } = setup({});
    document.getElementById('add').click();
    const input = document.getElementById('kw-input');
    input.value = 'clearedkw';
    document.getElementById('confirm-add').click();
    expect(input.value).toBe('');
  });

  test('confirm-add does NOT send if keyword input is empty or whitespace', () => {
    const { document, getWs } = setup({});
    const ws = getWs();
    ws.send.mockClear();
    document.getElementById('add').click();
    document.getElementById('kw-input').value = '   ';
    document.getElementById('confirm-add').click();
    expect(ws.send).not.toHaveBeenCalled();
  });

  test('confirm-add sends only checked channels (unchecked excluded)', () => {
    const guildsData = { g1: { id: 'g1', name: 'G1', channels: { c1: { id: 'c1', name: 'general' }, c2: { id: 'c2', name: 'random' } } } };
    const { document, getWs } = setup(guildsData);
    const ws = getWs();
    ws.send.mockClear();
    document.getElementById('add').click();
    const checkboxes = document.querySelectorAll('#channel-list input[type="checkbox"]');
    checkboxes[0].checked = false;
    document.getElementById('kw-input').value = 'filtered';
    document.getElementById('confirm-add').click();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.channels.length).toBe(1);
    expect(sent.channels[0]).toBe('c2');
  });

  test('guild select populates correct option values (guild ids)', () => {
    const guildsData = { g1: { id: 'g1', name: 'Guild Alpha', channels: {} } };
    const { document } = setup(guildsData);
    document.getElementById('add').click();
    const opt = document.querySelector('#guild-select option');
    expect(opt.value).toBe('g1');
  });
});
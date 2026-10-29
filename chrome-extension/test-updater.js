const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fakeBackground(replies) {
  const listeners = [];
  const saved = {};
  const actions = [];
  const notices = [];
  let reloaded = false;
  const chrome = {
    storage: { local: { async set(values) { Object.assign(saved, values); } } },
    tabs: {
      async query() { return [{ id: 12 }]; },
      async sendMessage(id, message) { notices.push({ id, message }); }
    },
    runtime: {
      id: 'test-extension',
      getURL: (path) => `chrome-extension://test-extension/${path}`,
      onMessage: { addListener(listener) { listeners.push(listener); } },
      reload() { reloaded = true; },
      connectNative(host) {
        assert.equal(host, 'com.prestova.cleaning_updater');
        let onMessage;
        return {
          onMessage: { addListener(listener) { onMessage = listener; } },
          onDisconnect: { addListener() {} },
          postMessage(request) {
            actions.push(request.action);
            const reply = replies.shift();
            Promise.resolve().then(() => onMessage(reply));
          },
          disconnect() {}
        };
      }
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('./background.js'), 'utf8'), {
    chrome, console, Promise, Date, Number, Error,
    setTimeout(callback, delay) { if (delay < 120000) queueMicrotask(callback); return 1; },
    clearTimeout() {}
  });
  const request = (sender = { id: 'test-extension', url: 'chrome-extension://test-extension/popup.html' }) =>
    new Promise((resolve) => listeners[0]({ type: 'CHECK_EXTENSION_UPDATE' }, sender, resolve));
  return { request, saved, actions, notices, wasReloaded: () => reloaded };
}

(async () => {
  let fake = fakeBackground([{ ok: true, status: 'up_to_date', currentVersion: '1.0' }]);
  await fake.request();
  assert.deepEqual(fake.actions, ['check']);
  assert.equal(fake.saved.extensionUpdateStatus.stage, 'up_to_date');
  assert.equal(fake.wasReloaded(), false);

  fake = fakeBackground([
    { ok: true, status: 'available', availableVersion: '1.1' },
    { ok: true, status: 'installed', availableVersion: '1.1' }
  ]);
  await fake.request();
  assert.deepEqual(fake.actions, ['check', 'install']);
  assert.equal(fake.saved.extensionUpdateStatus.stage, 'installed');
  assert.equal(fake.saved.extensionUpdateStatus.version, '1.1');
  assert.equal(fake.notices[0].message.type, 'SHOW_UPDATE_RELOAD_NOTICE');
  assert.equal(fake.wasReloaded(), true);

  fake = fakeBackground([{ ok: false, status: 'error', message: 'assinatura inválida' }]);
  await fake.request();
  assert.equal(fake.saved.extensionUpdateStatus.stage, 'error');
  assert.equal(fake.wasReloaded(), false);
  assert.deepEqual(fake.actions, ['check']);

  fake = fakeBackground([
    { ok: true, status: 'available', availableVersion: '1.1' },
    { ok: false, status: 'error', message: 'pacote inválido' }
  ]);
  await fake.request();
  assert.deepEqual(fake.actions, ['check', 'install']);
  assert.equal(fake.saved.extensionUpdateStatus.stage, 'error');
  assert.equal(fake.wasReloaded(), false);
  assert.equal(fake.notices.length, 0);

  fake = fakeBackground([]);
  const denied = await fake.request({ id: 'test-extension', url: 'https://biz.yelp.com/' });
  assert.equal(denied.ok, false);
  assert.deepEqual(fake.actions, []);
  console.log('Update UI workflow checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

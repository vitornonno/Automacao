const UPDATE_HOST = 'com.prestova.cleaning_updater';
const UPDATE_STATE_KEY = 'extensionUpdateStatus';
const UPDATE_DEBUG_KEY = 'extensionUpdateDebug';
let updateInProgress = false;
let updateDebug = null;

async function updateDebugEvent(step, details = {}) {
  if (!updateDebug) return;
  updateDebug.events.push({ at: new Date().toISOString(), elapsedMs: Date.now() - updateDebug.startMs, step, ...details });
  await chrome.storage.local.set({ [UPDATE_DEBUG_KEY]: updateDebug });
}

function nativeUpdateRequest(action) {
  return new Promise((resolve, reject) => {
    let port;
    try { port = chrome.runtime.connectNative(UPDATE_HOST); }
    catch (error) { reject(error); return; }
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      try { port.disconnect(); } catch { /* Already disconnected. */ }
      if (error) reject(error); else resolve(value);
    };
    const timeout = setTimeout(() => finish(new Error('O auxiliar demorou para responder. Tente novamente.')), 120000);
    port.onMessage.addListener((response) => finish(null, response));
    port.onDisconnect.addListener(() => {
      const reason = chrome.runtime.lastError?.message || '';
      const message = /native messaging host not found|specified native messaging host not found/i.test(reason)
        ? 'Auxiliar de atualização não encontrado. Instale ou configure o auxiliar neste computador.'
        : reason || 'O auxiliar não respondeu. Verifique sua instalação.';
      finish(new Error(message));
    });
    try { port.postMessage({ action }); } catch (error) { finish(error); }
  });
}

async function setUpdateStatus(stage, message, version = null) {
  await chrome.storage.local.set({ [UPDATE_STATE_KEY]: { stage, message, version, updatedAt: new Date().toISOString() } });
}

async function notifyOpenLeadPages() {
  const tabs = await chrome.tabs.query({ url: ['https://*.yelp.com/*', 'https://*.yelp.com.br/*', 'https://*.thumbtack.com/*'] });
  await Promise.allSettled(tabs.filter((tab) => Number.isInteger(tab.id)).map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'SHOW_UPDATE_RELOAD_NOTICE' }, { frameId: 0 })));
}

function compareUpdateVersions(left, right) {
  if (!/^\d+(?:\.\d+){0,3}$/.test(left || '') || !/^\d+(?:\.\d+){0,3}$/.test(right || '')) return null;
  const a = left.split('.').map(Number); const b = right.split('.').map(Number);
  for (let i = 0; i < 4; i += 1) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

async function finishUpdateForProfile(version) {
  await setUpdateStatus('installed', 'Atualização disponível neste perfil. Atualize a página do Yelp após o recarregamento da extensão.', version);
  await updateDebugEvent('profile_reload_requested', { version });
  try { await notifyOpenLeadPages(); } catch { /* O aviso persistirá no popup. */ }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  chrome.runtime.reload();
}

async function handleCurrentDiskVersion(version) {
  const comparison = compareUpdateVersions(version, chrome.runtime.getManifest().version);
  if (comparison === null || comparison < 0) throw new Error('A versão da pasta não corresponde à extensão deste perfil. Confira a configuração do auxiliar.');
  if (comparison > 0) { await finishUpdateForProfile(version); return; }
  await setUpdateStatus('up_to_date', 'A extensão está atualizada.', version);
}

async function checkAndInstallUpdate() {
  updateDebug = { startedAt: new Date().toISOString(), startMs: Date.now(), extensionVersion: chrome.runtime.getManifest().version, events: [] };
  await updateDebugEvent('check_started');
  await setUpdateStatus('checking', 'Verificando atualizações…');
  try {
    let started = Date.now();
    await updateDebugEvent('native_check_started');
    const check = await nativeUpdateRequest('check');
    await updateDebugEvent('native_check_finished', { durationMs: Date.now() - started, status: check?.status || null, hostSteps: check?.steps || null });
    if (!check?.ok) throw new Error(check?.message || 'Não foi possível verificar atualizações.');
    if (check.status === 'up_to_date') {
      await handleCurrentDiskVersion(check.currentVersion);
      return;
    }
    if (check.status !== 'available') throw new Error('O auxiliar retornou uma resposta inesperada.');
    await setUpdateStatus('installing', 'Atualização encontrada. Instalando…', check.availableVersion || null);
    started = Date.now();
    await updateDebugEvent('native_install_started', { version: check.availableVersion || null });
    const installed = await nativeUpdateRequest('install');
    await updateDebugEvent('native_install_finished', { durationMs: Date.now() - started, status: installed?.status || null, hostSteps: installed?.steps || null });
    if (!installed?.ok) throw new Error(installed?.message || 'Não foi possível instalar a atualização.');
    if (installed.status === 'up_to_date') {
      await handleCurrentDiskVersion(installed.currentVersion);
      return;
    }
    if (installed.status !== 'installed') throw new Error('O auxiliar não confirmou a instalação.');
    await finishUpdateForProfile(installed.availableVersion || null);
  } catch (error) {
    await updateDebugEvent('failed', { message: error?.message || 'Não foi possível verificar atualizações.' });
    await setUpdateStatus('error', error?.message || 'Não foi possível verificar atualizações.');
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CHECK_EXTENSION_UPDATE') {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) {
      sendResponse({ ok: false, error: 'Solicitação de atualização não autorizada.' });
      return undefined;
    }
    if (updateInProgress) { sendResponse({ ok: false, error: 'Já existe uma verificação em andamento.' }); return undefined; }
    updateInProgress = true;
    checkAndInstallUpdate().then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || 'Falha na atualização.' }))
      .finally(() => { updateInProgress = false; });
    return true;
  }
  if (message.type === 'PICKER_SERVICE_SELECTED') {
    if (sender.id !== chrome.runtime.id || !sender.tab?.id || !sender.url?.startsWith(chrome.runtime.getURL('service-picker.html'))) {
      sendResponse({ ok: false });
      return undefined;
    }
    chrome.tabs.sendMessage(sender.tab.id, { type: 'PICKER_SERVICE_APPLY', nonce: message.nonce, serviceId: message.serviceId }, { frameId: 0 })
      .then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'TEST_ROUTE_RELAY') {
    chrome.storage.local.get('routeRelay').then(async ({ routeRelay }) => {
      const baseUrl = String(routeRelay?.url || '').replace(/\/+$/, '');
      const token = String(routeRelay?.token || '');
      if (!baseUrl || !token) throw new Error('Save the relay URL and extension token first.');
      const response = await fetch(`${baseUrl}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          origin: { latitude: 37.9029281, longitude: -122.033732 },
          destination: { latitude: 37.896, longitude: -122.06 }
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !Number.isFinite(body.durationSeconds)) throw new Error(body.detail || body.error || 'Relay route test failed.');
      sendResponse({ ok: true });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'ROUTE_RELAY_REQUEST') {
    chrome.storage.local.get('routeRelay').then(async ({ routeRelay }) => {
      const baseUrl = String(routeRelay?.url || '').replace(/\/+$/, '');
      const token = String(routeRelay?.token || '');
      if (!baseUrl || !token) throw new Error('Configure the route relay URL and extension token first.');
      const response = await fetch(`${baseUrl}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(message.request || {})
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Route request failed.');
      sendResponse({ ok: true, route: body });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'GEOCODE_RELAY_REQUEST') {
    chrome.storage.local.get('routeRelay').then(async ({ routeRelay }) => {
      const baseUrl = String(routeRelay?.url || '').replace(/\/+$/, '');
      const token = String(routeRelay?.token || '');
      if (!baseUrl || !token) throw new Error('Configure the route relay URL and extension token first.');
      const response = await fetch(`${baseUrl}/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: message.query, region: message.region || null })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Location lookup failed.');
      sendResponse({ ok: true, location: body });
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'SAVE_REVIEW') {
    const now = new Date().toISOString();
    const review = {
      ...message.review,
      savedAt: now,
      updatedAt: now,
      url: sender.tab?.url || message.review.url,
      state: 'pending_human_approval'
    };
    chrome.storage.local.set({ [`lead:${review.id}`]: review }).then(() => sendResponse({ ok: true, review }));
    return true;
  }
  if (message.type === 'UPDATE_REVIEW_STATE') {
    const key = `lead:${message.id}`;
    chrome.storage.local.get(key).then((records) => {
      const existing = records[key];
      if (!existing) throw new Error('Review not found.');
      const review = { ...existing, state: message.state, updatedAt: new Date().toISOString() };
      return chrome.storage.local.set({ [key]: review }).then(() => sendResponse({ ok: true, review }));
    }).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return undefined;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

(() => {
  const params = new URLSearchParams(location.search);
  const nonce = params.get('nonce');
  const selector = document.querySelector('#service-type');
  const prompt = document.querySelector('#move-prompt');
  const sendSelection = (serviceId) => chrome.runtime.sendMessage({ type: 'PICKER_SERVICE_SELECTED', nonce, serviceId }).catch(() => {});
  if (params.get('mode') === 'prompt') {
    selector.hidden = true;
    prompt.hidden = false;
    prompt.addEventListener('click', (event) => {
      const serviceId = event.target.closest('[data-service]')?.dataset.service;
      if (serviceId) sendSelection(serviceId);
    });
  }
  selector.value = params.get('selected') || '';
  selector.addEventListener('change', () => {
    if (!selector.value) return;
    sendSelection(selector.value);
  });
})();

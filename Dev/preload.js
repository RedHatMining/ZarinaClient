const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  // Prioritize WebSockets over HTTP if available
  ipcRenderer.on('web-request-optimize', (event, details) => {
    if (details.protocol === 'wss:' || details.protocol === 'ws:') {
      details.priority = 'high';
    }
  });
});

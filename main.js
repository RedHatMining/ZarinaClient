const { app, BrowserWindow, ipcMain, Menu, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs-extra'); // fs-extra for easier directory copying
const os = require('os'); // For temp directory
const { Client } = require('discord-rpc');

let mainWindow;
const clientId = '1254292681878929460';
const rpc = new Client({ transport: 'ipc' });

const patch = async () => {
  const extensionPath = path.join(__dirname, 'EvPatch');
  const tempPath = path.join(os.tmpdir(), 'EvPatch');

  try {
    await fs.copy(extensionPath, tempPath);
    await session.defaultSession.loadExtension(tempPath);
    console.log('Extension loaded from temp path:', tempPath);
  } catch (err) {
    console.error('Failed to load extension from temp:', err);
  }
};

const setPerformanceFlags = (gpuType) => {
  // General flags applied to all users
  app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('enable-webgl2-compute-context');
  app.commandLine.appendSwitch('enable-quic');
  app.commandLine.appendSwitch('disable-http2');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-ipc-flooding-protection');
  app.commandLine.appendSwitch('enable-oop-rasterization');
  app.commandLine.appendSwitch('enable-checker-imaging');
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');

  if (gpuType === 'discrete') {
    // Standalone GPU-specific flags
    app.commandLine.appendSwitch('force_high_performance_gpu');
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('ignore-gpu-blacklist');
    app.commandLine.appendSwitch('enable-zero-copy');
  } else if (gpuType === 'integrated') {
    // Integrated GPU-specific flags
    app.commandLine.appendSwitch('enable-low-end-device-mode');
    app.commandLine.appendSwitch('disable-accelerated-video-decode');
    app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
  } else {
    // CPU-only system
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
  }
};

// Create main window
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      offscreen: false,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, 'logo.ico'),
  });

  mainWindow.setTitle('ZarinaClient');
  mainWindow.loadFile(path.join(__dirname, 'mainpage.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    const currentUrl = mainWindow.webContents.getURL();
    if (currentUrl.includes('ev.io/user/login')) {
      mainWindow.setTitle('ZarinaClient - Login');
    } else if (currentUrl.includes('ev.io/')) {
      mainWindow.setTitle('ZarinaClient - Playing');
    } else {
      mainWindow.setTitle('ZarinaClient');
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'Toggle Fullscreen',
      click: () => {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      },
    },
    {
      label: 'Hub',
      click: () => {
        mainWindow.loadFile(path.join(__dirname, 'mainpage.html'));
      },
    },
  ]);

  Menu.setApplicationMenu(menu);

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.destroy();
    app.quit();
  });
};

// When app is ready, handle GPU detection and extension loading
app.whenReady().then(() => {
  app.getGPUInfo('complete')
    .then((gpuInfo) => {
      const isDiscreteGPU = gpuInfo.gpuDevice
        ? gpuInfo.gpuDevice.some((device) => device.gpuPreference === 2) // High-performance discrete GPU
        : false;

      const isIntegratedGPU = gpuInfo.gpuDevice
        ? gpuInfo.gpuDevice.some((device) => device.gpuPreference === 0) // Integrated GPU
        : false;

      if (isDiscreteGPU) {
        setPerformanceFlags('discrete');
      } else if (isIntegratedGPU) {
        setPerformanceFlags('integrated');
      } else {
        setPerformanceFlags('cpu');
      }

      patch();
      createWindow();
    })
    .catch((err) => {
      console.error('Failed to detect GPU information:', err);
      patch('cpu');
      loadExtensionToTmp();
      createWindow();
    });

  rpc.on('ready', () => {
    console.log('Rich Presence is ready');
    rpc.setActivity({
      details: 'Playing ev.io at maximum speed',
      state: 'V2.0.0',
      startTimestamp: Math.floor(Date.now() / 1000),
      largeImageKey: 'logo',
      smallImageKey: 'ev',
      buttons: [{ label: 'Download', url: 'https://github.com/RedHatMining/ZarinaClient' }],
    });
  });

  rpc.login({ clientId }).catch(console.error);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.responseHeaders['upgrade'] && details.responseHeaders['upgrade'].includes('websocket')) {
      details.responseHeaders['X-WebSocket-Latency'] = ['low'];
    }
    callback({ cancel: false, responseHeaders: details.responseHeaders });
  });
});

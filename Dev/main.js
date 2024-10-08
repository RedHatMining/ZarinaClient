const { app, BrowserWindow, ipcMain, Menu, dialog, session, clipboard } = require('electron');
const path = require('path');
const { Client } = require('discord-rpc');

let mainWindow;
const clientId = '1254292681878929460';
const rpc = new Client({ transport: 'ipc' });

const setPerformanceFlags = (gpuType) => {
  // General GPU flags applied to all users
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
      backgroundThrottling: false
    },
    icon: path.join(__dirname, 'logo.ico'), // Set the application icon
  });

  mainWindow.setTitle('ZarinaClient');

  mainWindow.loadURL('https://ev.io/');

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
      label: 'Pages',
      submenu: [
        {
          label: 'Play',
          click: () => {
            mainWindow.loadURL('https://ev.io/').catch(err => {
              console.error('Failed to load Play page:', err);
            });
          }
        },
        {
          label: 'Login',
          click: () => {
            mainWindow.loadURL('https://ev.io/user/login').catch(err => {
              console.error('Failed to load Login page:', err);
            });
          }
        },
        {
          label: 'Join Game',
          click: async () => {
            const gameUrl = await clipboard.readText();
            if (gameUrl) {
              mainWindow.loadURL(gameUrl).catch(err => {
                console.error('Failed to load Game URL:', err);
              });
            } else {
              await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'No URL Found',
                message: 'No URL was found in the clipboard.',
                buttons: ['OK'],
              });
            }
          }
        }
      ]
    },
    {
      label: 'Toggle Fullscreen',
      click: () => {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
    }
  ]);

  Menu.setApplicationMenu(menu);

  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.destroy();
    app.quit();
  });
};

app.whenReady().then(() => {
	app.getGPUInfo('complete').then((gpuInfo) => {
	  console.log(gpuInfo);

	  const isDiscreteGPU = gpuInfo.gpuDevice
		? gpuInfo.gpuDevice.some(device => device.gpuPreference === 2) // High-performance discrete GPU
		: false;
	  
	  const isIntegratedGPU = gpuInfo.gpuDevice
		? gpuInfo.gpuDevice.some(device => device.gpuPreference === 0) // Integrated GPU
		: false;

	  if (isDiscreteGPU) {
		setPerformanceFlags('discrete');
	  } else if (isIntegratedGPU) {
		setPerformanceFlags('integrated');
	  } else {
		setPerformanceFlags('cpu');
	  }

	  createWindow();
	}).catch(err => {
	  console.error('Failed to detect GPU information:', err);
	  // Fallback to CPU only mode
	  setPerformanceFlags('cpu');
	  createWindow();
	});


  rpc.on('ready', () => {
    console.log("Rich Presence is ready");
    rpc.setActivity({
      details: 'Playing ev.io at maximum speed',
      state: "V1.1.0",
      startTimestamp: Math.floor(Date.now() / 1000),
      largeImageKey: 'logo',
      smallImageKey: 'ev',
      buttons: [{label: 'Download', url: 'https://github.com/RedHatMining/EV_Client'}]
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

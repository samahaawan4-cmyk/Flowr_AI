// @ts-nocheck
const {app, BrowserWindow, Menu, ipcMain, shell} = require('electron');
const {spawn} = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

let mainWindow = null;
let serverProcess = null;

function getConfigPath() {
  return path.join(app.getPath('userData'), 'flowr-desktop.json');
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(getConfigPath()), {recursive: true});
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8');
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const {port} = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(`${url}/api/health`);
        if (res.ok) {
          resolve();
          return;
        }
      } catch {
        // Server still booting
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Flowr local server timed out while starting.'));
        return;
      }
      setTimeout(check, 200);
    };
    void check();
  });
}

function stopLocalServer() {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // Ignore
    }
    serverProcess = null;
  }
}

async function startLocalServer(apiKey) {
  stopLocalServer();
  const port = await findFreePort();
  const appRoot = app.getAppPath();
  const serverEntry = path.join(appRoot, 'server.mjs');
  const distDir = path.join(appRoot, 'dist');

  serverProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      GEMINI_API_KEY: apiKey,
      FLOWR_DIST_DIR: distDir,
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  const localUrl = `http://127.0.0.1:${port}`;
  await waitForServer(localUrl);
  return localUrl;
}

async function loadConfiguredExperience(win) {
  const config = readConfig();

  if (config?.mode === 'remote' && config.remoteUrl) {
    stopLocalServer();
    await win.loadURL(config.remoteUrl);
    return;
  }

  const key = config?.mode === 'local' ? config.apiKey : process.env.GEMINI_API_KEY;
  if (key) {
    const localUrl = await startLocalServer(key);
    await win.loadURL(localUrl);
    return;
  }

  await win.loadFile(path.join(__dirname, 'setup.html'));
}

function buildMenu(win) {
  const template = [
    {
      label: 'Flowr',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => win.reload(),
        },
        {
          label: 'Switch Connection / API Key',
          click: async () => {
            stopLocalServer();
            try {
              fs.unlinkSync(getConfigPath());
            } catch {
              // Ignore
            }
            await win.loadFile(path.join(__dirname, 'setup.html'));
          },
        },
        {type: 'separator'},
        {role: 'quit'},
      ],
    },
    {role: 'editMenu'},
    {role: 'viewMenu'},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const iconPng = path.join(
    app.getAppPath(),
    'public/assets/aistudio/a88fd0eb-38f8-44c1-9e03-66d496fdc0ca_624e8b59.png',
  );

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 820,
    minHeight: 600,
    backgroundColor: '#000000',
    title: 'Flowr',
    icon: fs.existsSync(iconPng) ? iconPng : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    shell.openExternal(url);
    return {action: 'deny'};
  });

  buildMenu(mainWindow);
  void loadConfiguredExperience(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('flowr:save-remote', async (_event, rawUrl) => {
  const trimmed = String(rawUrl || '').trim();
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('URL must start with https:// or http://');
  }
  writeConfig({mode: 'remote', remoteUrl: parsed.toString()});
  if (mainWindow) {
    await loadConfiguredExperience(mainWindow);
  }
  return true;
});

ipcMain.handle('flowr:save-local', async (_event, rawKey) => {
  const apiKey = String(rawKey || '').trim();
  if (!apiKey) {
    throw new Error('Please enter a valid Gemini API key.');
  }
  writeConfig({mode: 'local', apiKey});
  if (mainWindow) {
    await loadConfiguredExperience(mainWindow);
  }
  return true;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopLocalServer();
});

app.on('window-all-closed', () => {
  stopLocalServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

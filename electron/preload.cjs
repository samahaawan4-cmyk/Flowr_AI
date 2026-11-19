// @ts-nocheck
const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('flowrDesktop', {
  saveRemoteUrl: (url) => ipcRenderer.invoke('flowr:save-remote', url),
  saveLocalApiKey: (apiKey) => ipcRenderer.invoke('flowr:save-local', apiKey),
});

// Gives the game a small window.PAApp object to talk to the app (folder, saving files, export saves).
const {contextBridge, ipcRenderer} = require('electron');
const call = (cmd, a, b) => ipcRenderer.sendSync('pa', cmd, a, b);
contextBridge.exposeInMainWorld('PAApp', {
  platform: () => call('platform'),
  folder: () => call('folder'),
  getSaving: () => call('getSaving'),
  setSaving: v => call('setSaving', !!v),
  filesBytes: () => call('filesBytes'),
  clearFiles: () => call('clearFiles'),
  saveFile: (name, text) => call('saveFile', name, text),
  openFolder: () => call('openFolder'),
});

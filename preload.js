const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    runOptimization: (data) => ipcRenderer.invoke('run-optimization', data),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),
    readExcelData: (filePath) => ipcRenderer.invoke('read-excel-data', filePath),
    writeExcelData: (filePath, data) => ipcRenderer.invoke('write-excel-data', filePath, data),
    downloadTemplate: () => ipcRenderer.invoke('download-template'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getVersion: () => ipcRenderer.invoke('get-version'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, version) => callback(version)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, percent) => callback(percent)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),
    onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', () => callback())
});

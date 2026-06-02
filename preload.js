const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    runOptimization: (data) => ipcRenderer.invoke('run-optimization', data),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),
    readExcelData: (filePath) => ipcRenderer.invoke('read-excel-data', filePath),
    writeExcelData: (filePath, data) => ipcRenderer.invoke('write-excel-data', filePath, data),
    downloadTemplate: () => ipcRenderer.invoke('download-template'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates')
});

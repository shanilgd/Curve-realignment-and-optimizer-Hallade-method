const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const { spawn } = require('child_process');
const XLSX = require('xlsx');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createWindow();

    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: 'A new version is available. Downloading now...'
        });
    });

    autoUpdater.on('update-downloaded', () => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded. The application will restart to install.',
            buttons: ['Restart Now', 'Later']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handler to run the Python SciPy optimizer
ipcMain.handle('run-optimization', async (event, data) => {
    return new Promise((resolve) => {
        const scriptPath = app.isPackaged ? path.join(process.resourcesPath, 'python_optimizer.py') : path.join(__dirname, 'python_optimizer.py');
        const pythonProcess = spawn('python', [scriptPath]);
        
        let stdoutData = '';
        let stderrData = '';
        
        pythonProcess.stdout.on('data', (chunk) => {
            stdoutData += chunk.toString();
        });
        
        pythonProcess.stderr.on('data', (chunk) => {
            stderrData += chunk.toString();
        });
        
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                resolve({ success: false, error: `Optimizer process failed (code ${code}). Stderr: ${stderrData}` });
                return;
            }
            try {
                const result = JSON.parse(stdoutData.trim());
                resolve(result);
            } catch (e) {
                resolve({ success: false, error: `Invalid output from optimizer: ${e.message}. Raw output: ${stdoutData}` });
            }
        });
        
        pythonProcess.stdin.write(JSON.stringify(data));
        pythonProcess.stdin.end();
    });
});

// IPC Handler to open file dialog for Excel import
ipcMain.handle('open-file-dialog', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    });
    if (canceled) {
        return null;
    } else {
        return filePaths[0];
    }
});

// IPC Handler to save Excel output
ipcMain.handle('save-file-dialog', async (event, defaultName) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Realigned Curve',
        defaultPath: defaultName || 'Curve_Realignment_Output.xlsx',
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });
    if (canceled) {
        return null;
    } else {
        return filePath;
    }
});

// IPC Handler to parse imported Excel file
ipcMain.handle('read-excel-data', async (event, filePath) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const data = [];
        // Dynamically locate the header row (contains "stn" or "station" in Col A and "ver" or "exg" in Col B)
        let headerRow = 0;
        for (let i = 1; i <= 30; i++) {
            const cellA = worksheet[`A${i}`];
            const cellB = worksheet[`B${i}`];
            if (cellA && cellA.v !== undefined && cellA.v !== null) {
                const valA = String(cellA.v).trim().toLowerCase();
                if (valA.includes("stn") || valA.includes("station")) {
                    if (cellB && cellB.v !== undefined && cellB.v !== null) {
                        const valB = String(cellB.v).trim().toLowerCase();
                        if (valB.includes("ver") || valB.includes("exg") || valB.includes("exist") || valB.includes("val")) {
                            headerRow = i;
                            break;
                        }
                    }
                }
            }
        }
        let r = headerRow > 0 ? headerRow + 1 : 5; // Fallback to row 5 if not found
        
        while (true) {
            const stnCell = worksheet[`A${r}`];
            if (!stnCell || stnCell.v === undefined || stnCell.v === null || String(stnCell.v).trim() === "" || String(stnCell.v).trim().toLowerCase() === "total") {
                break;
            }
            const exgCell = worksheet[`B${r}`];
            const proCell = worksheet[`C${r}`];
            data.push({
                stn: String(stnCell.v),
                exg: exgCell && exgCell.v !== undefined ? Number(exgCell.v) || 0 : 0,
                pro: proCell && proCell.v !== undefined ? Number(proCell.v) || 0 : 0
            });
            r++;
        }
        return { success: true, data };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC Handler to write optimized Excel output
ipcMain.handle('write-excel-data', async (event, filePath, data) => {
    try {
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["TRACK CURVE REALIGNMENT SHEET (HALLADE METHOD)"],
            ["Curve Realignment Output Summary"],
            [],
            ["Stn No", "Existing Versine (B)", "Proposed Versine (C)", "Max Slew In", "Max Slew Out", "Versine Diff (D)", "First Sum (E)", "Second Sum (F)", "Raw Slew (G)", "Linear Correction (H)", "Corrected Slew (I)"]
        ];
        
        data.forEach(row => {
            wsData.push([
                row.stn, row.exg, row.pro, row.maxIn || "", row.maxOut || "", row.diff, row.firstSum, row.secondSum, row.rawSlew, row.linCorr, row.corrSlew
            ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Curve Realignment");
        XLSX.writeFile(wb, filePath);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC Handler to download template
ipcMain.handle('download-template', async (event) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Download Excel Template',
        defaultPath: 'Curve_Realignment_Template.xlsx',
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) {
        return { success: false, canceled: true };
    }
    
    try {
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["TRACK CURVE REALIGNMENT SHEET (HALLADE METHOD)"],
            ["Please fill in your station numbers and existing versines below."],
            ["You can include negative stations before the curve and positive stations after."],
            [],
              ["Stn No", "Existing Versine (B)", "Max Slew In", "Max Slew Out"],
              ["-5", "0", "", ""],
              ["-4", "0", "", ""],
              ["-3", "0", "", ""],
              ["-2", "0", "", ""],
              ["-1", "0", "", ""],
              ["0", "5", "", ""],
              ["1", "10", "2", ""],
              ["2", "15", "", ""]
          ];
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, filePath);
        return { success: true, filePath };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

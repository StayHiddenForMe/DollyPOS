import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let isAppQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 700,
    title: 'Dolly POS - Dolly Toys and Kids Wear',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Intercept Windows (X) close button and ask for on-close backup
  mainWindow.on('close', (e) => {
    if (!isAppQuitting) {
      e.preventDefault();
      mainWindow?.webContents.send('trigger-app-close-backup');
    }
  });

  // Intercept Ctrl+W and Ctrl+Q keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && (input.key.toLowerCase() === 'w' || input.key.toLowerCase() === 'q')) {
      event.preventDefault();
      mainWindow?.webContents.send('trigger-app-close-backup');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Hardware print handler
ipcMain.handle('print-thermal-receipt', async (event, options) => {
  if (!mainWindow) return false;
  return new Promise((resolve) => {
    mainWindow?.webContents.print({
      silent: options?.silent ?? true,
      printBackground: true,
      deviceName: options?.printerName || '',
      margins: { marginType: 'none' }
    }, (success, failureReason) => {
      resolve({ success, failureReason });
    });
  });
});

// Clean termination confirmed after backup completes
ipcMain.on('app-close-confirmed', () => {
  isAppQuitting = true;
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
  app.exit(0);
});

app.on('before-quit', () => {
  isAppQuitting = true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.exit(0);
  }
});

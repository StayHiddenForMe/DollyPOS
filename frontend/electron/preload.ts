import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  printThermalReceipt: (options: any) => ipcRenderer.invoke('print-thermal-receipt', options),
  platform: process.platform,
  onTriggerCloseBackup: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-app-close-backup', handler);
    return () => {
      ipcRenderer.removeListener('trigger-app-close-backup', handler);
    };
  },
  confirmAppClose: () => {
    ipcRenderer.send('app-close-confirmed');
  }
});

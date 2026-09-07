import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  printThermalReceipt: (options: any) => ipcRenderer.invoke('print-thermal-receipt', options),
  platform: process.platform
});

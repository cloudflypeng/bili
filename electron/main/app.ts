import { ipcMain, dialog } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';

ipcMain.handle('dir:getDesktopPath', (event) => {
  return path.join(os.homedir(), 'Desktop');
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result
})

// 在路径下创建文件夹, 传入路径和文件夹名
ipcMain.handle('dir:createFolder', async (event, path: string, folderName: string) => {
  return fs.mkdirSync(path, folderName)
})

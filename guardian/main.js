const { app, BrowserWindow, globalShortcut, Menu, MenuItem } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Dedalos Bar",
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      partition: 'persist:dedalos-reception' 
    }
  });

  win.removeMenu();
  win.maximize();
  win.loadURL('https://www.dedalos.app.br/');

  globalShortcut.register('F12', () => {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools();
    }
  });

  win.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    menu.append(new MenuItem({
      label: 'Voltar',
      enabled: win.webContents.canGoBack(),
      click: () => win.webContents.goBack()
    }));

    menu.append(new MenuItem({
      label: 'Avançar',
      enabled: win.webContents.canGoForward(),
      click: () => win.webContents.goForward()
    }));

    menu.append(new MenuItem({
      label: 'Recarregar',
      click: () => win.webContents.reload()
    }));
    
    menu.append(new MenuItem({ type: 'separator' }));

    if (params.isEditable) {
      menu.append(new MenuItem({ label: 'Desfazer', role: 'undo' }));
      menu.append(new MenuItem({ label: 'Refazer', role: 'redo' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: 'Recortar', role: 'cut' }));
      menu.append(new MenuItem({ label: 'Copiar', role: 'copy' }));
      menu.append(new MenuItem({ label: 'Colar', role: 'paste' }));
      menu.append(new MenuItem({ type: 'separator' }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ label: 'Copiar', role: 'copy' }));
      menu.append(new MenuItem({ type: 'separator' }));
    }

    menu.append(new MenuItem({
      label: 'Inspecionar Elemento',
      click: () => {
        win.webContents.inspectElement(params.x, params.y);
      }
    }));

    menu.popup(win, params.x, params.y);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
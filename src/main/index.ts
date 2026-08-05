import { app, BrowserWindow, dialog } from 'electron';

import { createMainWindowOptions } from './window-options';

function reportStartupError(error: unknown): void {
  console.error('Zatto Desktop failed to start:', error);
  dialog.showErrorBox(
    'Zatto Desktop could not start',
    'Close the application and try again.',
  );
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow(
    createMainWindowOptions(MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY),
  );

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  void mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).catch(reportStartupError);

  return mainWindow;
}

void app
  .whenReady()
  .then(() => {
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  })
  .catch(reportStartupError);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

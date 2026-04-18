import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import { ipcChannels } from "../ipc";

/**
 * Registers shell-only window controls. These handlers intentionally stay free
 * of Trackboi product logic so renderer code can treat them as a desktop facade.
 */
export function registerWindowIpcHandlers(): void {
	ipcMain.handle(ipcChannels.window.minimize, (event: IpcMainInvokeEvent) => {
		BrowserWindow.fromWebContents(event.sender)?.minimize();
	});
	ipcMain.handle(ipcChannels.window.toggleMaximize, (event: IpcMainInvokeEvent) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return;
		if (window.isMaximized()) window.unmaximize();
		else window.maximize();
	});
	ipcMain.handle(ipcChannels.window.close, (event: IpcMainInvokeEvent) => {
		BrowserWindow.fromWebContents(event.sender)?.close();
	});
	ipcMain.handle(ipcChannels.window.startDrag, () => {
		// Electron frameless dragging is handled by CSS app regions in the renderer.
	});
	ipcMain.handle(ipcChannels.window.startResize, () => {
		// Native edge resize remains available; no JS resize loop needed.
	});
}

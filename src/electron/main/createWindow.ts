import { BrowserWindow } from "electron";
import path from "node:path";

/**
 * Creates the frameless desktop shell window used by Trackboi in both dev and
 * packaged desktop builds.
 */
export function createAppWindow(): BrowserWindow {
	const mainWindow = new BrowserWindow({
		width: 1180,
		height: 760,
		minWidth: 760,
		minHeight: 480,
		frame: false,
		title: "Trackboi",
		backgroundColor: "#090909",
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	mainWindow.webContents.on("before-input-event", (_event, input) => {
		if (input.type === "keyDown" && input.key === "F12") {
			mainWindow.webContents.toggleDevTools();
		}
	});

	if (process.env.TRACKBOI_DEV_SERVER_URL) {
		void mainWindow.loadURL(process.env.TRACKBOI_DEV_SERVER_URL);
	} else {
		void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
	}

	return mainWindow;
}

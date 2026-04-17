const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("trackboi", {
	getActiveProject: () => ipcRenderer.invoke("trackboi:get-active-project"),
	listProjects: () => ipcRenderer.invoke("trackboi:list-projects"),
	listView: () => ipcRenderer.invoke("trackboi:list-view"),
	setStorageSearchPaths: (paths) => ipcRenderer.invoke("trackboi:set-storage-search-paths", paths),
	setActiveWorkspaceFile: (filePath) => ipcRenderer.invoke("trackboi:set-active-workspace-file", filePath),
	openWorkspaceFile: () => ipcRenderer.invoke("trackboi:open-workspace-file"),
	chooseProject: () => ipcRenderer.invoke("trackboi:choose-project"),
	locateProject: (projectId) => ipcRenderer.invoke("trackboi:locate-project", projectId),
	removeProject: (projectId) => ipcRenderer.invoke("trackboi:remove-project", projectId),
	switchProject: (projectId) => ipcRenderer.invoke("trackboi:switch-project", projectId),
	createCard: (input) => ipcRenderer.invoke("trackboi:create-card", input),
	updateCard: (cardId, patch) => ipcRenderer.invoke("trackboi:update-card", cardId, patch),
	updateBoard: (board) => ipcRenderer.invoke("trackboi:update-board", board),
	updateCustomFields: (customFields) => ipcRenderer.invoke("trackboi:update-custom-fields", customFields),
	moveCard: (cardId, toColumn, beforeCardId) => ipcRenderer.invoke("trackboi:move-card", {
		cardId,
		toColumn,
		beforeCardId,
	}),
	deleteCard: (cardId) => ipcRenderer.invoke("trackboi:delete-card", cardId),
	onProjectChanged: (listener) => {
		const wrapped = (_event, payload) => listener(payload);
		ipcRenderer.on("trackboi://project-changed", wrapped);
		return () => ipcRenderer.off("trackboi://project-changed", wrapped);
	},
	window: {
		minimize: () => ipcRenderer.invoke("trackboi:window-minimize"),
		toggleMaximize: () => ipcRenderer.invoke("trackboi:window-toggle-maximize"),
		close: () => ipcRenderer.invoke("trackboi:window-close"),
		startDrag: () => ipcRenderer.invoke("trackboi:window-start-drag"),
		startResize: (edge) => ipcRenderer.invoke("trackboi:window-start-resize", edge),
	},
});

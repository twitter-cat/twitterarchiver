const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
	send: (channel, data) => {
		ipcRenderer.send(channel, data);
	},
	on: (channel, fn) => ipcRenderer.on(channel, (_, ...args) => fn(...args)),
});
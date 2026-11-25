const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("corderDesktop", {
  isElectron: true,
  platform: process.platform,
  invokeApi: (method, pathname, body) =>
    ipcRenderer.invoke("corder:api", { method, pathname, body }),
  onPlayTts: (callback) => {
    if (typeof callback !== "function") return
    ipcRenderer.on("corder:play-tts", (_event, data) => callback(data))
  },
})

const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("corderDesktop", {
  isElectron: true,
  platform: process.platform,
  invokeApi: (method, pathname, body) =>
    ipcRenderer.invoke("corder:api", { method, pathname, body }),
})

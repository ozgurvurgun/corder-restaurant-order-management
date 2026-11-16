const { contextBridge } = require("electron")

contextBridge.exposeInMainWorld("corderDesktop", {
  isElectron: true,
  platform: process.platform,
})

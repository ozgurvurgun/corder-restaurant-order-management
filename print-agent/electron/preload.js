const { contextBridge } = require("electron")

contextBridge.exposeInMainWorld("corderDesktop", {
  isElectron: true,
  platform: process.platform,
  sessionToken: process.env.CORDER_UI_SESSION_TOKEN || "",
})

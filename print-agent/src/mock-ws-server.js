const http = require("http")
const { Server } = require("socket.io")

const server = http.createServer()
const io = new Server(server, {
  path: "/ws",
  cors: { origin: true },
})

server.listen(4000, () => {
  console.log("Mock Socket.IO server started on http://localhost:4000 (path=/ws)")
})

io.on("connection", (socket) => {
  console.log("Agent connected", { id: socket.id, token: socket.handshake.auth?.token || "none" })

  const payload = {
    id: `ord-${Date.now()}`,
    restaurantId: "demo-restaurant",
    tableId: "Bahce 1",
    createdAt: new Date().toISOString(),
    items: [
      { productName: "Lahmacun", quantity: 2, price: 90, note: "az acili", status: "sent" },
      { productName: "Ayran", quantity: 1, price: 30, status: "sent" },
    ],
  }

  setTimeout(() => {
    socket.emit("order:created", payload)
    console.log("order:created emitted")
  }, 1000)
})

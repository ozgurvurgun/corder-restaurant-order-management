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
    tableId: "Table 1",
    createdAt: new Date().toISOString(),
    items: [
      { productName: "Flatbread", quantity: 2, price: 90, note: "mild", status: "sent" },
      { productName: "Sparkling Water", quantity: 1, price: 30, status: "sent" },
    ],
  }

  setTimeout(() => {
    socket.emit("order:created", payload)
    console.log("order:created emitted")
  }, 1000)
})

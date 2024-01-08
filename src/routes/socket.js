const { Server } = require("socket.io");

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: ["*"],
    },

    maxHttpBufferSize: 4e6,
  });
  io.on("connection", (socket) => {
    console.log("a user connected");

    // Log any error during connection
    socket.on("connect_error", (err) => {
      console.log("Connection error:", err.message);
    });

    socket.on("joinTrip", (tripId) => {
      socket.join(tripId);
      console.log(`User joined trip: ${tripId}`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("user disconnected");
    });
  });
  return io;
}

module.exports = setupSocket;

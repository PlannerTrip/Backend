const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const auth = require("./src/middlewares/auth");

require("dotenv").config();

const app = express();

const http = require("http");

const PORT = process.env.PORT;
const server = http.createServer(app);
const { Server } = require("socket.io");
server.listen(PORT, () => console.log(`listening on port ${PORT}`));

const MONGODB_URI = process.env.MONGODB_URI;

const publicPaths = ["/login", "/register"];

// ==================== middleware ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (publicPaths.includes(req.path)) {
    next();
  } else {
    auth(req, res, next);
  }
});

// connect to database
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.log("Error connecting to MongoDB:", error);
  });

// ==================== routes ====================

const authRoutes = require("./src/routes/authRoutes");
const placeRoute = require("./src/routes/placeRoute");

app.use("/", authRoutes);
app.use("/place", placeRoute);

// ==================== socket ====================

// const io = new Server(server, {
//   cors: {
//     origin: ["*"],
//   },

//   maxHttpBufferSize: 4e6,
// });
// io.on("connection", (socket) => {
//   console.log("a user connected");

//   // Log any error during connection
//   socket.on("connect_error", (err) => {
//     console.log("Connection error:", err.message);
//   });
//   socket.on("message", (data) => {
//     console.log(data);
//   });
//   // Handle disconnection
//   socket.on("disconnect", () => {
//     console.log("user disconnected");
//   });
// });

const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const swaggerUi = require("swagger-ui-express");
const auth = require("./src/middlewares/auth");
const swaggerDocument = require("./src/swagger.json");

require("dotenv").config();

const app = express();

const http = require("http");

const PORT = process.env.PORT;
const server = http.createServer(app);
server.listen(PORT, () => console.log(`listening on port ${PORT}`));

const setupSocket = require("./src/routes/socket");

const io = setupSocket(server);

module.exports = io;

const MONGODB_URI = process.env.MONGODB_URI;

const publicPaths = [
  "/login",
  "/register",
  "/docs/",
  "/forgotPassword",
  "/verifyForgotCode",
  "/changePasswordByEmail",
];

// ==================== middleware ====================
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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
const reviewRoutes = require("./src/routes/reviewRotes");
const tripRoutes = require("./src/routes/tripRoutes");
const userProfileRoutes = require("./src/routes/userProfileRoutes");

app.use("/", authRoutes);
app.use("/place", placeRoute);
app.use("/review", reviewRoutes);
app.use("/trip", tripRoutes);
app.use("/user", userProfileRoutes);

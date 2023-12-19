const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const auth = require("./src/middlewares/auth");

require("dotenv").config();

const app = express();
const port = 3000;
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
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});

// ==================== routes ====================

const authRoutes = require("./src/routes/authRoutes");
const placeRoute = require("./src/routes/placeRoute");

app.use("/", authRoutes);
app.use("/place", placeRoute);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./src/routes/authRoutes");
const placeRoute = require("./src/routes/placeRoute");

const auth = require("./src/middlewares/auth");

require("dotenv").config();

const app = express();
const port = 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(port, () => {
      console.log(`listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.log("Error connecting to MongoDB:", error);
  });

app.use((req, res, next) => {
  if (req.path === "/login" || req.path === "/register") {
    next();
  } else {
    auth(req, res, next);
  }
});

app.use("/", authRoutes);
app.use("/place", placeRoute);

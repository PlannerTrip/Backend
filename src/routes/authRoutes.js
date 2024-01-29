require("dotenv").config();

const bcrypt = require("bcrypt");
const jwt = require("jwt-simple");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User.js");
const { hashPassword, comparePasswords } = require("../utils/function.js");

const SECRET = process.env.SECRET_KEY;

const router = express.Router();

// ====================== router ======================

router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (!user) {
      return res.status(401).json({ error: "no user in database" });
    }
    const isMatch = await comparePasswords(
      req.body.password.toString(),
      user.password
    );
    if (isMatch) {
      const payload = {
        id: user.id,
        sub: req.body.username,
        iat: new Date().getTime(),
      };

      const token = jwt.encode(payload, SECRET);

      return res.status(200).json({ message: "login success", token: token });
    }
    return res.status(404).json({ error: "wrong password" });
  } catch (err) {
    return res
      .status(500)
      .json({ error: `Something went wrong ${err.message}` });
  }
});

router.post("/register", async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (user) {
      return res.status(401).json({ error: "user already exist" });
    }
    const hashedPassword = await hashPassword(req.body.password.toString());
    const createNewUser = await User.create({
      username: req.body.username,
      password: hashedPassword,
      id: uuidv4(),
    });

    return res.json({ message: "Create new user success" });
  } catch (err) {
    return next(err);
  }
});

router.get("/authCheck", (req, res) => {
  return res.json({ userId: req.user.id });
});

module.exports = router;

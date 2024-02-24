require("dotenv").config();

const bcrypt = require("bcrypt");
const jwt = require("jwt-simple");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");

const User = require("../models/User.js");
const VerifyEmail = require("../models/VerifyEmail.js");

const { hashPassword, comparePasswords } = require("../utils/function.js");

const SECRET = process.env.SECRET_KEY;

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.APP_PASSWORD,
  },
});

// ====================== router ======================

router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res
        .status(404)
        .json({ error: "wrong password or email not found" });
    }
    const isMatch = await comparePasswords(
      req.body.password.toString(),
      user.password
    );

    if (!isMatch) {
      return res
        .status(404)
        .json({ error: "wrong password or email not found" });
    }
    if (isMatch) {
      const payload = {
        id: user.id,
        sub: req.body.email,
        iat: new Date().getTime(),
      };

      const token = jwt.encode(payload, SECRET);

      return res
        .status(200)
        .json({ message: "login success", token: token, userId: user.id });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ error: `Something went wrong ${err.message}` });
  }
});

router.post("/register", async (req, res, next) => {
  try {
    const { username, password, email } = req.body;
    const emailInDataBase = await User.findOne({ email: email });
    if (emailInDataBase) {
      return res.status(401).json({ error: "email already exist" });
    }
    const hashedPassword = await hashPassword(password.toString());
    await User.create({
      username: username,
      password: hashedPassword,
      email: email,
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

router.post("/forgotPassword", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ error: " email not found" });
    }

    const verifyCode = uuidv4();
    await VerifyEmail.create({
      id: user.id,
      verifyCode: verifyCode,
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "confirm code",
      text: "",
      html: `<h1>confirm code</h1><span>${process.env.URL_PREFIX}/forgot/${verifyCode}</span>`,
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error:", error);
        res.status(500).json("Fail");
      } else {
        console.log("Email sent:", info.response);
        res.json("email have sent");
      }
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: `Something went wrong ${err.message}` });
  }
});

router.get("/verifyForgotCode", async (req, res) => {
  try {
    const { verifyCode } = req.query;
    const VerifyEmailCode = await VerifyEmail.findOne({
      verifyCode: verifyCode,
    });
    if (!VerifyEmailCode) {
      return res.status(404).json({ error: "VerifyCode not found" });
    }

    return res.json("success");
  } catch (err) {
    return res
      .status(500)
      .json({ error: `Something went wrong ${err.message}` });
  }
});

router.put("/changePasswordByEmail", async (req, res) => {
  try {
    const { password, verifyCode } = req.body;
    const VerifyEmailCode = await VerifyEmail.findOne({
      verifyCode: verifyCode,
    });
    if (!VerifyEmailCode) {
      return res.status(404).json({ error: "VerifyCode not found" });
    }

    const user = await User.findOne({
      id: VerifyEmailCode.id,
    });
    const hashedPassword = await hashPassword(password.toString());

    user.password = hashedPassword;
    await user.save();
    await VerifyEmail.findOneAndDelete({
      verifyCode: verifyCode,
    });

    return res.json("success");
  } catch (err) {
    return res
      .status(500)
      .json({ error: `Something went wrong ${err.message}` });
  }
});

module.exports = router;

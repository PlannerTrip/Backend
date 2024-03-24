require("dotenv").config();

const express = require("express");

const User = require("../models/User.js");
const Report = require("../models/Report.js");

const { hashPassword, comparePasswords } = require("../utils/function.js");

const router = express.Router();

const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
});

const { getStorage, getDownloadURL } = require("firebase-admin/storage");

const bucket = getStorage().bucket();

const crypto = require("crypto");
const path = require("path");

const { v4: uuidv4 } = require("uuid");

router.put("/password", async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;
    const user = await User.findOne({ id: userId });
    const isMatch = await comparePasswords(
      oldPassword.toString(),
      user.password
    );

    if (!isMatch) {
      return res.status(404).json({ error: "wrong password" });
    }
    const hashedPassword = await hashPassword(newPassword.toString());

    user.password = hashedPassword;
    await user.save();
    return res.json("success");
  } catch (err) {
    console.log(err);
    return res.status(404).json({ error: err });
  }
});

router.put("/information", upload.single("profileImg"), async (req, res) => {
  try {
    const profileImg = req.file;
    const userId = req.user.id;
    const user = await User.findOne({ id: userId });
    const { username, email, gender } = req.body;
    if (profileImg) {
      const randomString = crypto.randomBytes(12).toString("hex");
      const fileName =
        Date.now() + "_" + randomString + path.extname(profileImg.originalname);
      const file = bucket.file(fileName);

      const stream = file.createWriteStream().end(profileImg.buffer);

      const result = await new Promise((resolve, reject) => {
        stream.on("finish", async () => {
          try {
            const downloadURL = await getDownloadURL(file);
            resolve({ url: downloadURL, fileName: fileName });
          } catch (error) {
            reject(error);
          }
        });
      });
      user.profileUrl = result.url;
    }
    if (username) {
      user.username = username;
    }
    if (email) {
      user.email = email;
    }
    if (gender) {
      user.gender = gender;
    }
    await user.save();

    return res.json("success change information");
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/report", async (req, res) => {
  try {
    const userId = req.user.id;
    const { detail } = req.body;

    if (!detail) {
      return res.status(404).json("detail not found");
    }

    await Report.create({
      reportId: uuidv4(),
      createBy: userId,
      detail: detail,
    });

    return res.json("report sent");
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

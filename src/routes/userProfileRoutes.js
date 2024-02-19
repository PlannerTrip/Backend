require("dotenv").config();

const express = require("express");

const User = require("../models/User.js");

const { hashPassword, comparePasswords } = require("../utils/function.js");

const router = express.Router();

// router.put("/information");

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

module.exports = router;

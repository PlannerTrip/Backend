const mongoose = require("mongoose");
const { Schema } = mongoose;

const VerifyEmailSchema = new Schema({
  id: String,
  verifyCode: String,
});

module.exports = mongoose.model("VerifyEmail", VerifyEmailSchema);

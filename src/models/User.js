const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSchema = new Schema({
  username: String,
  password: String,
  email: String,
  gender: String,
  id: String,
  profileUrl: { type: String, default: "" },
});

module.exports = mongoose.model("User", UserSchema);

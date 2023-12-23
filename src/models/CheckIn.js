const mongoose = require("mongoose");
const { Schema } = mongoose;

const CheckInSchema = new Schema({
  placeId: String,
  userId: String,
  province: String,
  timestamp: { type: Date, default: Date.now() },
});

module.exports = mongoose.model("CheckIn", CheckInSchema);

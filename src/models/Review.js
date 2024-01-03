const mongoose = require("mongoose");
const { Schema } = mongoose;

const ReviewSchema = new Schema({
  reviewId: String,
  userId: String,
  placeId: String,
  img: [{ url: String, fileName: String }],
  content: { type: String, default: "" },
  createDate: { type: Date, default: Date.now() },
  rating: Number,
  likes: [{ userId: String, timeStamp: { type: Date, default: Date.now() } }],
});

module.exports = mongoose.model("Review", ReviewSchema);

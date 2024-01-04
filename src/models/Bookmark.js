const mongoose = require("mongoose");
const { Schema } = mongoose;

const BookmarkSchema = new Schema({
  placeId: String,
  userId: String,
  timestamp: { type: Date, default: Date.now() },
});

module.exports = mongoose.model("Bookmark", BookmarkSchema);

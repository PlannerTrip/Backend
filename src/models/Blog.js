const mongoose = require("mongoose");
const { Schema } = mongoose;

const BlogSchema = new Schema({
  blogId: String,
  name: String,
  note: { type: String, default: "" },
  img: [{ url: String, fileName: String }],
  place: { type: [String], default: [] },
  createDate: { type: Date, default: Date.now() },
  tripIdReference: String,
  date: {
    start: { type: String, default: null },
    end: { type: String, default: null },
  },
  createBy: String,
});

module.exports = mongoose.model("Blog", BlogSchema);

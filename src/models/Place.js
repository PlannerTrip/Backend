const mongoose = require("mongoose");
const { Schema } = mongoose;

const PlaceSchema = new Schema({
  placeId: String,
  placeName: String,
  type: String,
  coverImg: { type: [String], default: null },
  introduction: String,
  tag: { type: [String], default: null },
  latitude: Number,
  longitude: Number,
  contact: {
    phone: { type: String, default: null },
    url: { type: String, default: null },
  },
  location: {
    address: String,
    district: String,
    province: String,
  },
  weekDay: {
    type: {
      day1: { type: { day: String, time: String }, default: null },
      day2: { type: { day: String, time: String }, default: null },
      day3: { type: { day: String, time: String }, default: null },
      day4: { type: { day: String, time: String }, default: null },
      day5: { type: { day: String, time: String }, default: null },
      day6: { type: { day: String, time: String }, default: null },
      day7: { type: { day: String, time: String }, default: null },
    },
    default: null,
  },
});

module.exports = mongoose.model("Place", PlaceSchema);

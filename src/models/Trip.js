const mongoose = require("mongoose");
const { Schema } = mongoose;

const TripSchema = new Schema({
  tripId: String,
  createBy: String,
  name: { type: String, default: "" },
  member: [
    {
      userId: String,
      date: [
        {
          start: { type: String, default: null },
          end: { type: String, default: null },
        },
      ],
    },
  ],
  place: [{ placeId: String, selectBy: [String] }],
  date: {
    start: { type: String, default: null },
    end: { type: String, default: null },
  },
  note: { type: String, default: "" },
  plan: [
    {
      date: Date,
      name: String,
      place: [
        {
          placeId: String,
          day: String,
          startTime: String,
          endTime: String,
          selectBy: [String],
        },
      ],
      activity: [{ name: String, startTime: String, endTime: String }],
    },
  ],
  inviteLink: String,
  currentStage: { type: String, default: "invitation" },
});

module.exports = mongoose.model("Trip", TripSchema);

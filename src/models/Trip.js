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
      date: String,
      day: Number,
      place: [
        {
          placePlanId: String,
          placeId: String,
          startTime: String,
          endTime: String,
          // normal skip checkIn
          status: { type: String, default: "normal" },
          selectBy: [String],
        },
      ],
      activity: [
        {
          name: String,
          startTime: String,
          endTime: String,
          activityId: String,
          selectBy: [String],
        },
      ],
    },
  ],
  inviteLink: String,
  // invitation placeSelect planSelect tripSummary stopSelect-{day} finish delete
  currentStage: { type: String, default: "invitation" },
  currentPlace: { type: String, default: "" },
  successCreate: { type: Boolean, default: false },
  coverImg: { url: { type: String, default: "" }, fileName: String },
  prevPlaceStatus: { type: String, default: "normal" },
});

module.exports = mongoose.model("Trip", TripSchema);

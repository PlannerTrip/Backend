require("dotenv").config();

const express = require("express");

const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const Trip = require("../models/Trip.js");
const User = require("../models/User.js");
const io = require("../../index.js");
const Place = require("../models/Place.js");

// create trip
router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const tripId = uuidv4();
    await Trip.create({
      tripId: tripId,
      createBy: userId,
      member: [{ userId: userId, date: [{ start: "", end: "" }] }],
      inviteLink: uuidv4(),
    });
    return res.json({ tripId: tripId });
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err });
  }
});

// delete trip
router.delete("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const tripId = req.body.tripId;

    const trip = await Trip.findOneAndDelete({
      createBy: userId,
      tripId: tripId,
    });
    if (!trip) {
      return res.status(404).json({ error: "can't delete trip" });
    }

    io.to(trip.tripId).emit("removeGroup", {
      status: "removeGroup",
    });
    return res.json({ message: "success" });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// get invitation code
router.get("/invitation", async (req, res) => {
  try {
    const { tripId } = req.query;
    const trip = await Trip.findOne({ tripId: tripId });
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    return res.json({ inviteLink: trip.inviteLink });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// verify invitation
router.get("/verifyInvitation", async (req, res) => {
  try {
    const { inviteLink } = req.query;
    const userId = req.user.id;
    const trip = await Trip.findOne({ inviteLink: inviteLink });
    if (!trip) {
      return res.status(404).json({ error: `invalidInviteLink` });
    }
    if (trip.member.some((user) => user.userId === userId)) {
      return res.json({ currentStage: trip.currentStage, tripId: trip.tripId });
    }

    if (trip.member.length >= 4) {
      return res.status(400).json({
        error: "maximumCapacity",
      });
    }

    // add new member to backend
    trip.member = [
      ...trip.member,
      { userId: userId, date: [{ start: "", end: "" }] },
    ];
    await trip.save();

    const user = await User.findOne({ id: userId });

    // send to socket

    io.to(trip.tripId).emit("updateMember", {
      type: "addMember",
      data: {
        userId: userId,
        username: user.username,
        profileUrl: user.profileUrl,
        date: [{ start: "", end: "" }],
      },
    });

    return res.json({ tripId: trip.tripId, currentStage: trip.currentStage });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// remove member from trip
router.delete("/member", async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId, tripId } = req.body;

    // find trip
    const trip = await Trip.findOne({ tripId: tripId });
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    if (trip.createBy !== userId && userId !== friendId) {
      return res.status(403).json({ error: "Permission denied" });
    }

    if (!trip.member.some((user) => user.userId === friendId)) {
      return res
        .status(404)
        .json({ error: `No friendId found for tripId: ${tripId}` });
    }

    // remove member and update trip member
    trip.member = trip.member.filter((user) => user.userId !== friendId);
    await trip.save();

    io.to(trip.tripId).emit("removeMember", {
      userId: friendId,
    });

    res.json({ message: "delete success" });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// update member date in trip
router.post("/dateMember", async (req, res) => {
  try {
    const { tripId, date } = req.body;
    const userId = req.user.id;
    const trip = await Trip.findOne({ tripId: tripId });
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    if (!trip.member.some((user) => user === userId)) {
      return res
        .status(404)
        .json({ error: `No userId found for tripId: ${tripId}` });
    }

    trip.member = trip.member.map((user) => {
      if (user.userId !== userId) {
        return user;
      } else {
        return { userId: userId, date: date };
      }
    });
    await trip.save();
    io.to(trip.tripId).emit("updateMember", {
      type: "updateDate",
      data: {
        userId: userId,
        date: date,
      },
    });
    res.json({ message: "success" });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// update date in trip
router.post("/date", async (req, res) => {
  try {
    const { tripId, start, end } = req.body;
    const userId = req.user.id;

    // find trip
    const trip = await Trip.findOne({ tripId: tripId });
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    // only creator can update date and go to next stage
    if (trip.createBy !== userId) {
      return res.status(403).json({ error: "Permission denied" });
    }

    trip.date = { start: start, end: end };
    trip.currentStage = "placeSelect";
    await trip.save();

    return res.json({ message: "success" });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// add place to trip
router.post("/place", async (req, res) => {
  const { tripId, placeId } = req.body;
  const userId = req.user.id;

  // find trip
  const trip = await Trip.findOne({ tripId: tripId });
  if (!trip) {
    return res
      .status(404)
      .json({ error: `No trip found for tripId: ${tripId}` });
  }

  const place = await Place.findOne({ placeId: placeId });
  if (!place) {
    return res
      .status(404)
      .json({ error: `No place found for tripId: ${placeId}` });
  }
  // add place and save
  try {
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// get information
router.get("/information", async (req, res) => {
  try {
    const { type, tripId } = req.query;
    const userId = req.user.id;
    const trip = await Trip.findOne({ tripId: tripId });
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    if (!trip.member.some((user) => userId === user.userId)) {
      return res.status(403).json({ error: "Permission denied" });
    }

    // check owner
    const owner = trip.createBy === userId;

    if (type === "member") {
      let responseMember = [];
      for (const item of trip.member) {
        const user = await User.findOne({ id: item.userId });
        responseMember.push({
          userId: item.userId,
          username: user.username,
          profileUrl: user.profileUrl,
          date: item.date,
        });
      }

      return res.json({
        owner: owner,
        data: responseMember,
      });
    } else if (type === "allPlace") {
      // get place information
      // name img introduction selectBy forecast tag provine distict

      return res.json(trip.place);
    } else if (type === "allPlaceForEachDate") {
      // get place information
      return res.json({ place: trip.place, plan: trip.plan });
    } else if (type === "all") {
      // get place information
      return res.json(trip);
    }
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err });
  }
});

module.exports = router;

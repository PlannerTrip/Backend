require("dotenv").config();

const express = require("express");

const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const Trip = require("../models/Trip.js");
const User = require("../models/User.js");
const io = require("../../index.js");

// create trip
router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const tripId = uuidv4();
    await Trip.create({
      tripId: tripId,
      createBy: userId,
      member: [{ userId: userId }],
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
      return res
        .status(404)
        .json({ error: `No trip found for inviteLink: ${inviteLink}` });
    }
    if (trip.member.length >= 4) {
      return res.status(400).json({
        error: "The trip is already at maximum capacity (4 members).",
      });
    }

    if (trip.member.some((user) => user.userId === userId)) {
      const responseMember = [];
      for (const item of trip.member) {
        const user = await User.findOne({ id: item.userId });
        responseMember.push({
          userId: item.userId,
          username: user.username,
          profileUrl: user.profileUrl,
          date: item.date,
        });
      }
      return res.json({ tripId: trip.tripId, member: responseMember });
    }

    trip.member = [...trip.member, { userId: userId }];
    await trip.save();

    let newMember = {};
    const responseMember = [];
    for (const item of trip.member) {
      const user = await User.findOne({ id: item.userId });
      responseMember.push({
        userId: item.userId,
        username: user.username,
        profileUrl: user.profileUrl,
        date: item.date,
      });
    }

    const user = await User.findOne({ id: userId });

    // send to socket

    io.to(trip.tripId).emit("updateMember", {
      type: "addMember",
      data: {
        userId: userId,
        username: user.username,
        profileUrl: user.profileUrl,
        date: [],
      },
    });

    return res.json({ tripId: trip.tripId, member: responseMember });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

router.delete("/member", async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId, tripId } = req.body;

    // find trip
    const trip = await Trip.findOne({ tripId, tripId });
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    if (trip.createBy !== userId && userId !== friendId) {
      return res.status(403).json({ error: "Permission denied" });
    }

    if (!trip.member.some((user) => user === friendId)) {
      return res
        .status(404)
        .json({ error: `No friendId found for tripId: ${tripId}` });
    }

    // remove member and update trip member
    trip.member = trip.member.filter((user) => user.userId !== friendId);
    await trip.save();

    io.to(trip.tripId).emit("updateMember", {
      type: "delete",
      data: { deleteId: friendId },
    });

    res.json({ message: "delete success" });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

router.post("/date", async (req, res) => {
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

      return res.json(responseMember);
    } else if (type === "allPlace") {
      // get place information
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

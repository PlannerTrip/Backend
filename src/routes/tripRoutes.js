require("dotenv").config();

const express = require("express");

const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const Trip = require("../models/Trip.js");

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
      return res.status(400).json({
        error: "You are already join this trip.",
      });
    }

    trip.member = [...trip.member, { userId: userId }];
    await trip.save();
    // send to socket

    return res.json(trip.member);
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
      return res.json(trip.member);
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
    return res.status(400).json({ error: err });
  }
});

module.exports = router;

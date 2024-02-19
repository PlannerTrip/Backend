require("dotenv").config();

const express = require("express");
const axios = require("axios");

const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const Trip = require("../models/Trip.js");
const User = require("../models/User.js");
const io = require("../../index.js");
const Place = require("../models/Place.js");
const { getForecast } = require("../utils/function.js");

const TMD_KEY = process.env.TMD_KEY;

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

    io.to(trip.tripId).emit("addMember", {
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
    // Is trip found
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    // Is member found
    if (!trip.member.some((user) => user.userId === userId)) {
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
    io.to(trip.tripId).emit("updateDate", {
      userId: userId,
      date: date,
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
    // if (trip.createBy !== userId) {
    //   return res.status(403).json({ error: "Permission denied" });
    // }

    trip.date = { start: start, end: end };
    // trip.currentStage = "placeSelect";

    io.to(tripId).emit("updateTripDate", { start: start, end: end });
    await trip.save();

    return res.json({ message: "success" });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// add place to trip or remove in selectBy
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

  // find place
  const place = await Place.findOne({ placeId: placeId });
  if (!place) {
    return res
      .status(404)
      .json({ error: `No place found for tripId: ${placeId}` });
  }
  let updatePlace = [];
  const tripPlaceLength = trip.place.length;
  // check did user already add this place?
  if (
    trip.place.some(
      (item) =>
        item.placeId === placeId &&
        item.selectBy.some((member) => member === userId)
    )
  ) {
    // remove that person from selectBy
    updatePlace = trip.place.map((item) => {
      if (
        item.placeId === placeId &&
        item.selectBy.some((member) => member === userId)
      ) {
        return {
          ...item,
          selectBy: item.selectBy.filter((member) => member != userId),
        };
      }

      return item;
    });

    // if place selectBy empty remove that place
    updatePlace = updatePlace.filter((item) => item.selectBy.length !== 0);
  } else {
    // already have place add selectBy
    if (trip.place.some((item) => item.placeId === placeId)) {
      updatePlace = trip.place.map((item) => {
        if (item.placeId === placeId) {
          return { ...item, selectBy: [...item.selectBy, userId] };
        }
        return item;
      });
    } else {
      // have not place add new place
      updatePlace = [...trip.place, { placeId: placeId, selectBy: [userId] }];
    }
  }
  trip.place = updatePlace;
  await trip.save();

  // sent socket

  if (tripPlaceLength < updatePlace.length) {
    // place add
    let date = new Date(trip.date.start);

    if (new Date(Date.now()) > date) {
      date = new Date(Date.now());
    }

    const formattedDate =
      date.getFullYear() +
      "-" +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + date.getDate()).slice(-2);

    const TMD_response = await getForecast(
      place.location.province,
      place.location.district,
      formattedDate,
      5
    );

    const user = await User.findOne({ id: userId });

    io.to(trip.tripId).emit("addPlace", {
      selectBy: [user.username],
      ...place.toObject(),
      forecasts: TMD_response
        ? TMD_response.data.WeatherForecasts[0].forecasts
        : [],
    });
  } else if (tripPlaceLength > updatePlace.length) {
    // place remove
    io.to(trip.tripId).emit("removePlace", {
      placeId: placeId,
    });
  } else if (tripPlaceLength === updatePlace.length) {
    // update selectBy
    io.to(trip.tripId).emit("updatePlace", {
      placeId: placeId,
      selectBy: updatePlace.reduce((result, current) => {
        if (current.placeId === placeId) {
          return current.selectBy;
        }
        return result;
      }, []),
    });
  }

  res.json("success");
  try {
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// remove place in trip
// sent id in socket
router.delete("/place", async (req, res) => {
  try {
    const { tripId, placeId } = req.body;
    const userId = req.user.id;
    // find trip
    const trip = await Trip.findOne({ tripId: tripId });
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    // find place
    const place = await Place.findOne({ placeId: placeId });
    if (!place) {
      return res
        .status(404)
        .json({ error: `No place found for tripId: ${placeId}` });
    }

    if (trip.createBy !== userId) {
      return res.status(404).json({ error: "Permission denied" });
    }
    // remove place
    trip.place = trip.place.filter(
      (placeInTrip) => placeInTrip.placeId !== placeId
    );

    // remove form plan
    trip.plan = trip.plan.map((item) =>
      item.place.filter((value) => value.placeId !== placeId)
    );

    // socket sent
    io.to(trip.tripId).emit("removePlace", {
      placeId: placeId,
    });

    await trip.save();

    return res.json({ message: "remove success" });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// update stage
router.post("/stage", async (req, res) => {
  try {
    const { tripId, stage } = req.body;
    const userId = req.user.id;

    const trip = await Trip.findOne({ tripId: tripId });
    // Is trip found
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    if (trip.createBy !== userId) {
      return res.status(403).json({ error: "Permission denied" });
    }

    // create trip plan from date start,end
    if (trip.currentStage === "invitation" && stage === "placeSelect") {
      const start = new Date(trip.date.start);
      const end = new Date(trip.date.end);
      const datesBetween = [];

      let currentDate = new Date(start);
      datesBetween.push(currentDate.toDateString());
      currentDate.setDate(currentDate.getDate() + 1);

      // Loop until the current date reaches the end date
      while (currentDate <= end) {
        datesBetween.push(currentDate.toDateString());
        currentDate.setDate(currentDate.getDate() + 1);
      }

      trip.plan = datesBetween.map((date, index) => {
        return { date: date, place: [], day: index, activity: [] };
      });
    }

    trip.currentStage = stage;
    await trip.save();

    io.to(tripId).emit("updateStage", {
      stage: stage,
    });
  } catch (err) {
    console.log(err);
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
        date: trip.date,
      });
    } else if (type === "allPlace") {
      const places = [];

      let date = new Date(trip.date.start);

      if (new Date(Date.now()) > date) {
        date = new Date(Date.now());
      }

      // Convert the date to the desired format (YYYY-MM-DD)
      const formattedDate =
        date.getFullYear() +
        "-" +
        ("0" + (date.getMonth() + 1)).slice(-2) +
        "-" +
        ("0" + date.getDate()).slice(-2);

      for (const item of trip.place) {
        const place = await Place.findOne({ placeId: item.placeId });
        // get forecast

        const TMD_response = await getForecast(
          place.location.province,
          place.location.district,
          formattedDate,
          5
        );

        const selectBy = [];

        for (const member of item.selectBy) {
          const user = await User.findOne({ id: member });
          selectBy.push(user.username);
        }

        places.push({
          selectBy: selectBy,
          ...place.toObject(),
          forecasts: TMD_response
            ? TMD_response.data.WeatherForecasts[0].forecasts
            : [],
        });
      }

      return res.json({ places: places, owner: owner });
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

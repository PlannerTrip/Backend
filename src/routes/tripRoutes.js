require("dotenv").config();

const express = require("express");
const multer = require("multer");

const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const Trip = require("../models/Trip.js");
const User = require("../models/User.js");
const Place = require("../models/Place.js");
const CheckIn = require("../models/CheckIn.js");

const polyline = require("@mapbox/polyline");

const io = require("../../index.js");
const {
  getForecast,
  distanceTwoPoint,
  getUserInformation,
  checkUserIdExists,
  getTrip,
  checkOwner,
  getTripInformation,
  getPlaceInformation,

  getStopPlace,
  compareTime,
} = require("../utils/function.js");

const upload = multer({
  storage: multer.memoryStorage(),
});

const crypto = require("crypto");

const { getStorage, getDownloadURL } = require("firebase-admin/storage");

const bucket = getStorage().bucket();

const path = require("path");
const axios = require("axios");

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

    // remove member remove place or plan and update trip
    trip.member = trip.member.filter((user) => user.userId !== friendId);

    // remove member from place
    trip.place = trip.place.reduce((result, current) => {
      current.selectBy = current.selectBy.filter((id) => id !== friendId);
      if (current.selectBy.length !== 0) {
        result.push(current);
      }
      return result;
    }, []);

    // remove member from plan

    trip.plan = trip.plan.reduce((result, current) => {
      // remove place

      current.place = current.place.reduce((resultPlace, currentPlace) => {
        currentPlace.selectBy = currentPlace.selectBy.filter(
          (id) => id !== friendId
        );
        if (currentPlace.selectBy.length !== 0) {
          resultPlace.push(currentPlace);
        }
        return resultPlace;
      }, []);

      current.activity = current.activity.reduce(
        (resultActivity, currentActivity) => {
          currentActivity.selectBy = currentActivity.selectBy.filter(
            (id) => id !== friendId
          );
          if (currentActivity.selectBy.length !== 0) {
            resultActivity.push(current);
          }
          return resultActivity;
        },
        []
      );

      result.push(current);

      return result;
    }, []);

    await trip.save();

    io.to(trip.tripId).emit("removeMember", {
      userId: friendId,
    });

    res.json({ message: "delete success" });
  } catch (err) {
    console.log(err);
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
          placeId: item.placeId,
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
          return {
            placeId: item.placeId,
            selectBy: [...item.selectBy, userId],
          };
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

    const TMD_response = await getForecast(
      place.location.province,
      place.location.district,
      trip.date.start,
      5,
      res
    );

    const user = await User.findOne({ id: userId });

    io.to(trip.tripId).emit("addPlace", {
      selectBy: [
        {
          username: user.username,
          userprofile: user.profileUrl,
          userId: user.id,
        },
      ],
      ...place.toObject(),
      forecasts:
        TMD_response.length !== 0
          ? TMD_response.data.WeatherForecasts[0].forecasts
          : [],
    });
  } else if (tripPlaceLength > updatePlace.length) {
    // place remove
    io.to(trip.tripId).emit("removePlace", {
      placeId: placeId,
    });
  } else if (tripPlaceLength === updatePlace.length) {
    // update selectBy  call api get userprofile

    const currentSelectBy = updatePlace.reduce((result, current) => {
      if (current.placeId === placeId) {
        return current.selectBy;
      }
      return result;
    }, []);

    const selectBy = [];

    for (const member of currentSelectBy) {
      const user = await User.findOne({ id: member });
      selectBy.push({
        userId: user.id,
        username: user.username,
        userprofile: user.profileUrl,
      });
    }

    io.to(trip.tripId).emit("updatePlace", {
      placeId: placeId,
      selectBy: selectBy,
    });
  }

  res.json("success");
  try {
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

// remove place in trip
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
    trip.plan = trip.plan.map((item) => ({
      ...item,
      place: item.place.filter((value) => value.placeId !== placeId),
    }));

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

// add place to plan
router.post("/plan", async (req, res) => {
  try {
    const { tripId, placeId, day } = req.body;

    const trip = await Trip.findOne({ tripId: tripId });
    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }

    if (!trip.place.some((place) => place.placeId === placeId)) {
      return res
        .status(404)
        .json({ error: `No ${placeId} found for tripId: ${tripId}` });
    }

    let selectBy = [];
    const placePlanId = uuidv4();

    // update information
    trip.plan = trip.plan.map((item) => {
      if (item.day === day) {
        const place = trip.place.reduce((result, current) => {
          if (current.placeId === placeId) {
            selectBy = current.selectBy;
            return current;
          }
          return result;
        }, {});
        return {
          ...item,
          place: [
            ...item.place,
            { ...place, placePlanId: placePlanId, startTime: "", endTime: "" },
          ],
        };
      }
      return item;
    });
    await trip.save();

    // sentSocket

    const selectByInformation = await getUserInformation(selectBy);

    const place = await Place.findOne({ placeId: placeId });

    io.to(trip.tripId).emit("addPlacePlan", {
      place: {
        placeName: place.placeName,
        coverImg: place.coverImg,
        location: place.location,
        placePlanId: placePlanId,
        distant: 0,
        selectBy: selectByInformation,
      },
      day: day,
      latitude: place.latitude,
      longitude: place.longitude,
    });

    return res.json("success");
  } catch (err) {
    console.log(err);
    return res.status(404).json({ error: err });
  }
});

router.post("/planActivity", async (req, res) => {
  try {
    const { day, name, tripId } = req.body;
    const trip = await getTrip(tripId);
    const activityId = uuidv4();

    for (const item of trip.plan) {
      if (item.day === day) {
        if (item.activity.some((activity) => activity.name === name)) {
          return res.status(404).json({ error: "duplicate name" });
        }
      }
    }

    trip.plan = trip.plan.map((item) => {
      if (item.day === day) {
        return {
          ...item,
          activity: [
            ...item.activity,
            {
              startTime: "",
              endTime: "",
              name: name,
              activityId: activityId,
              selectBy: [req.user.id],
            },
          ],
        };
      }
      return item;
    });

    await trip.save();
    const selectBy = await getUserInformation([req.user.id]);
    // sent socket
    io.to(tripId).emit("addActivity", {
      day: day,
      activity: {
        startTime: "",
        endTime: "",
        name: name,
        activityId: activityId,
        selectBy: selectBy,
      },
    });

    return res.json("success");
  } catch (err) {
    console.log(err);
    return res.status(404).json({ error: err });
  }
});

router.delete("/plan", async (req, res) => {
  try {
    const { tripId, id, day } = req.body;

    const trip = await getTrip(tripId);

    trip.plan = trip.plan.map((item) => {
      if (item.day === day) {
        return {
          ...item,
          place: item.place.filter((place) => place.placePlanId !== id),
          activity: item.activity.filter(
            (activity) => activity.activityId !== id
          ),
        };
      }
      io.to(trip.tripId).emit("removeItemPlan", {
        id: id,
        day: day,
      });
      return item;
    });

    // sentSocket

    await trip.save();
    return res.json("success");
  } catch (err) {
    console.log(err);
    res.status(404).json({ error: err });
  }
});

// update stage
router.post("/stage", async (req, res) => {
  try {
    const { tripId, stage } = req.body;
    const userId = req.user.id;

    const trip = await getTrip(tripId);

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
        return { date: date, place: [], day: index + 1, activity: [] };
      });
    }

    trip.currentStage = stage;
    await trip.save();

    io.to(tripId).emit("updateStage", {
      stage: stage,
    });

    return res.json("successChangeStage");
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err });
  }
});

router.put("/planTime", async (req, res) => {
  try {
    const { tripId, id, type, time } = req.body;
    const userId = req.user.id;
    const trip = await getTrip(tripId);
    checkUserIdExists(trip, userId, tripId);

    // update time

    trip.plan = trip.plan.map((dailyPlan) => {
      // const timeTable = [
      //   ...dailyPlan.place.map((place) => [place.startTime, place.endTime]),
      //   ...dailyPlan.activity.map((activity) => [
      //     activity.startTime,
      //     activity.endTime,
      //   ]),
      // ];

      // console.log("timeTable", timeTable);

      dailyPlan.place = dailyPlan.place.map((place) => {
        if (place.placePlanId === id) {
          if (type === "startTime") {
            place.startTime = time;
          } else {
            place.endTime = time;
          }
        }
        return place;
      });

      dailyPlan.activity = dailyPlan.activity.map((activity) => {
        if (activity.activityId === id) {
          if (type === "startTime") {
            activity.startTime = time;
          } else {
            activity.endTime = time;
          }
        }
        return activity;
      });

      return dailyPlan;
    });

    await trip.save();

    io.to(tripId).emit("updatePlanTime", {
      id,
      time,
      type,
    });

    return res.json("done");
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err.message });
  }
});

// change name of trip
router.put("/name", async (req, res) => {
  try {
    const { tripId, name } = req.body;
    const userId = req.user.id;
    const trip = await getTrip(tripId);
    checkUserIdExists(trip, userId, tripId);
    checkOwner(userId, trip.createBy);

    trip.name = name;
    await trip.save();

    io.to(tripId).emit("updateName", {
      name,
    });
    return res.json("successChangeName");
  } catch (err) {
    return res.status(500).json({ error: `error ${err}` });
  }
});

// change note of trip
router.put("/note", async (req, res) => {
  try {
    const { tripId, note } = req.body;
    const userId = req.user.id;
    const trip = await getTrip(tripId);
    checkUserIdExists(trip, userId, tripId);
    checkOwner(userId, trip.createBy);

    trip.note = note;
    await trip.save();

    io.to(tripId).emit("updateNote", {
      note,
    });
    return res.json("successChangeNote");
  } catch (err) {
    return res.status(500).json({ error: `error ${err}` });
  }
});

// change coverImg of trip
router.put("/coverImg", upload.single("coverImg"), async (req, res) => {
  try {
    const { tripId } = req.body;
    const userId = req.user.id;
    const coverImg = req.file;
    const trip = await getTrip(tripId);
    checkUserIdExists(trip, userId, tripId);
    checkOwner(userId, trip.createBy);

    const randomString = crypto.randomBytes(12).toString("hex");
    const fileName =
      Date.now() + "_" + randomString + path.extname(coverImg.originalname);
    const file = bucket.file(fileName);

    const stream = file.createWriteStream().end(coverImg.buffer);

    const result = await new Promise((resolve, reject) => {
      stream.on("finish", async () => {
        try {
          const downloadURL = await getDownloadURL(file);
          resolve({ url: downloadURL, fileName: fileName });
        } catch (error) {
          reject(error);
        }
      });
    });

    trip.coverImg = result;
    await trip.save();

    io.to(tripId).emit("updateCoverImg", {
      coverImg: result.url,
    });
    return res.json("successChangeCoverImg");
  } catch (err) {
    return res.status(500).json({ error: `error ${err}` });
  }
});

router.put("/createTrip", async (req, res) => {
  try {
    const { tripId } = req.body;
    const userId = req.user.id;
    const trip = await getTrip(tripId);
    checkUserIdExists(trip, userId, tripId);
    checkOwner(userId, trip.createBy);
    let first = true;
    for (const plan of trip.plan) {
      const sortPlan = plan.place.sort((a, b) =>
        compareTime(a.startTime, b.startTime)
      );
      if (first && sortPlan.length !== 0) {
        first = false;
        trip.currentPlace = sortPlan[0].placePlanId;
      }
    }

    trip.successCreate = true;
    trip.currentStage = "finish";
    await trip.save();

    io.to(tripId).emit("updateStage", {
      stage: "finish",
    });

    return res.json("success create trip");
  } catch (err) {
    return res.status(500).json({ error: `error ${err.message}` });
  }
});

// get information
router.get("/information", async (req, res) => {
  try {
    const { type, tripId, latitude, longitude } = req.query;
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
        // console.log(user);
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

      for (const item of trip.place) {
        const place = await Place.findOne({ placeId: item.placeId });
        // get forecast

        const TMD_response = await getForecast(
          place.location.province,
          place.location.district,
          trip.date.start,
          5,
          res
        );

        const selectBy = [];

        for (const member of item.selectBy) {
          const user = await User.findOne({ id: member });
          selectBy.push({
            userId: user.id,
            username: user.username,
            userprofile: user.profileUrl,
          });
        }

        places.push({
          selectBy: selectBy,
          ...place.toObject(),
          forecasts:
            TMD_response.length !== 0
              ? TMD_response.data.WeatherForecasts[0].forecasts
              : [],
        });
      }

      return res.json({ places: places, owner: owner });
    } else if (type === "allPlaceForEachDate") {
      // ============ getPlace toSelect ============
      // get place information
      const places = [];

      for (const item of trip.place) {
        const place = await Place.findOne({ placeId: item.placeId });
        // get forecast

        const TMD_response = await getForecast(
          place.location.province,
          place.location.district,
          trip.date.start,
          5,
          res
        );

        places.push({
          ...place.toObject(),
          selectBy: item.selectBy,
          forecasts:
            TMD_response.length !== 0
              ? TMD_response.data.WeatherForecasts[0].forecasts
              : [],
        });
      }

      //  ============= get plan =============

      const plan = [];

      for (const value of trip.plan) {
        // place
        const currentPlace = [];
        const currentActivity = [];

        // get place information
        for (const item of value.place) {
          const place = await Place.findOne({ placeId: item.placeId });

          const selectBy = [];

          for (const member of item.selectBy) {
            const user = await User.findOne({ id: member });
            selectBy.push({
              userId: user.id,
              username: user.username,
              userprofile: user.profileUrl,
            });
          }
          const distant = distanceTwoPoint(
            place.latitude,
            place.longitude,
            latitude,
            longitude
          );

          currentPlace.push({
            selectBy: selectBy,
            ...place.toObject(),
            distant: distant,
            placePlanId: item.placePlanId,
          });
        }

        for (const item of value.activity) {
          const selectBy = [];

          for (const member of item.selectBy) {
            const user = await User.findOne({ id: member });
            selectBy.push({
              userId: user.id,
              username: user.username,
              userprofile: user.profileUrl,
            });
          }

          currentActivity.push({
            ...item.toObject(),
            selectBy: selectBy,
          });
        }

        plan.push({
          ...value.toObject(),
          activity: currentActivity,
          place: currentPlace.map((item) => ({
            placeName: item.placeName,
            coverImg: item.coverImg,
            location: item.location,
            placePlanId: item.placePlanId,
            distant: item.distant,
            selectBy: item.selectBy,
          })),
        });
      }

      return res.json({
        places: places.map((place) => ({
          placeName: place.placeName,
          coverImg: place.coverImg,
          location: place.location,
          forecasts: place.forecasts,
          placeId: place.placeId,
          selectBy: place.selectBy,
        })),
        plan: plan,
        owner: owner,
      });
    } else if (type === "all") {
      // get member information
      const member = await getUserInformation(
        trip.member.map((member) => member.userId)
      );

      const plan = [];

      // get information about plan
      for (const dailyPlan of trip.plan) {
        const places = [];

        for (const place of dailyPlan.place) {
          const placeInformation = await Place.findOne({
            placeId: place.placeId,
          });

          places.push({
            placeId: place.placePlanId,
            startTime: place.startTime,
            endTime: place.endTime,
            status: place.status,
            placeName: placeInformation.placeName,
            covetImg: placeInformation.coverImg,
            location: placeInformation.location,
            selectBy: place.selectBy,
            latitude: placeInformation.latitude,
            longitude: placeInformation.longitude,
          });
        }
        // get activity

        plan.push({
          places: places,
          day: dailyPlan.day,
          date: dailyPlan.date,
          activity: dailyPlan.activity,
        });
      }

      return res.json({
        information: {
          date: trip.date,
          member: member,
          name: trip.name,
          note: trip.note,
          coverImg: trip.coverImg.url,
          currentPlace: trip.currentPlace,
        },
        plan: plan,
        owner: owner,
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err.message });
  }
});

router.get("/userTripName", async (req, res) => {
  try {
    const userId = req.user.id;

    const trips = await Trip.find({ createBy: userId, successCreate: true });

    const result = [];

    for (const trip of trips) {
      const places = [];
      for (const item of trip.place) {
        const place = await Place.findOne({ placeId: item.placeId });
        // get forecast

        places.push({
          placeName: place.placeName,
          placeId: place.placeId,
          coverImg: place.coverImg[0],
          location: {
            district: place.location.district,
            province: place.location.province,
          },
        });
      }
      result.push({
        places: places,
        name: trip.name,
        tripId: trip.tripId,
      });
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: `error ${err}` });
  }
});

router.get("/myTrip", async (req, res) => {
  try {
    const userId = req.user.id;
    const trips = await Trip.find({
      successCreate: true,
      "member.userId": userId,
    });

    const response = await getTripInformation(trips);

    res.json(response);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put("/checkIn", async (req, res) => {
  try {
    const { tripId, placeId, latitude, longitude } = req.body;
    const userId = req.user.id;
    const trip = await getTrip(tripId);
    const allSortPlan = [];

    const place = await Place.findOne({ placeId: placeId });
    const distance = distanceTwoPoint(
      place.latitude,
      place.longitude,
      latitude,
      longitude
    );


    for (const plan of trip.plan) {
      const sortPlan = plan.place.sort((a, b) =>
        compareTime(a.startTime, b.startTime)
      );
      allSortPlan.push(sortPlan);
    }
    let next = false;
    for (const dailyPlan of allSortPlan) {
      for (const plan of dailyPlan) {
        if (plan.placePlanId === trip.currentPlace) {
          next = true;
        }
        if (next) {
          trip.currentPlace = plan.placePlanId;
        }
      }

      // check in for all member
      for (const member of trip.member) {
        const checkIn = await CheckIn.findOne({
          userId: member.userId,
          placeId: placeId,
        });

        if (!checkIn) {
          await CheckIn.create({
            placeId: placeId,
            userId: member.userId,
            province: place.location.province,
          });
        }
      }

      // sent socket
      // await trip.save();
      if (!next) {
        return res.json("all done");
      }
      return res.json("success check In");
    }
  } catch (err) {
    return res.status(500).json(err.message);
  }
});

router.get("/stop", async (req, res) => {
  try {
    const userId = req.user.id;
    const { tripId, day } = req.query;

    const trip = await Trip.findOne({ tripId });
    // console.log(trip);

    const plan = trip.plan
      .reduce((result, current) => {
        if (current.day === Number(day)) {
          result = current.place;
        }
        return result;
      }, [])
      .sort((a, b) => compareTime(a.startTime, b.startTime));

    const allPoint = [];
    const allPointInfo = [];

    for (place of plan) {
      const placeInfo = await getPlaceInformation("", place.placeId);
      allPoint.push({
        latitude: placeInfo.latitude,
        longitude: placeInfo.longitude,
      });
      allPointInfo.push({
        latitude: placeInfo.latitude,
        longitude: placeInfo.longitude,
        placeName: placeInfo.placeName,
        placeId: placeInfo.placeId,
      });
    }

    const origin = {
      location: {
        latLng: allPoint[0],
      },
    };

    const destination = {
      location: {
        latLng: allPoint[allPoint.length - 1],
      },
    };

    const intermediates = allPoint
      .slice(1, allPoint.length - 1)
      .map((location) => ({
        location: {
          latLng: location,
        },
      }));
    const result = await axios.post(
      `https://routes.googleapis.com/directions/v2:computeRoutes`,
      {
        origin: origin,
        destination: destination,
        intermediates: intermediates,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_API,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
      }
    );

    const data = result.data;

    if (data && data.routes[0]) {
      const decode = polyline.decode(data.routes[0].polyline.encodedPolyline);

      let response = [];
      for (let i = 0; i <= 10; i++) {
        let index = Math.round(decode.length * i * 0.1);
        if (index >= decode.length) {
          index--;
        }

        // console.log(index);
        // console.log(decode[index][0], decode[index][1]);

        const TAT_response = await getStopPlace(
          `${decode[index][0]},${decode[index][1]}`
        );
        // add new place to database
        for (const place of TAT_response) {
          const placeInfo = await getPlaceInformation(
            place.category_code,
            place.place_id,
            res
          );
          // console.log(placeInfo);
          if (placeInfo.length !== 0) {
            response.push({
              placeId: placeInfo.placeId,
              placeName: placeInfo.placeName,
              coverImg:
                placeInfo.coverImg && placeInfo.coverImg[0]
                  ? placeInfo.coverImg[0]
                  : "",
              location: placeInfo.location,
              latitude: placeInfo.latitude,
              longitude: placeInfo.longitude,
            });
          }
        }
      }

      response = response.map((place) => {
        if (trip.place.some((item) => item.placeId === place.placeId)) {
          let alreadyAdd = false;
          for (item of trip.place) {
            if (
              item.placeId === place.placeId &&
              item.selectBy.includes(userId)
            ) {
              alreadyAdd = true;
            }
          }
          return { ...place, alreadyAdd: alreadyAdd };
        } else {
          return { ...place, alreadyAdd: false };
        }
      });

      return res.json({
        places: response.filter((item) => !item.alreadyAdd),
        planPlace: allPointInfo,
        polyLine: data.routes[0].polyline.encodedPolyline,
        owner: trip.createBy === userId,
      });
    }
    return res.json("no data");
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

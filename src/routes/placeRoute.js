require("dotenv").config();

const axios = require("axios");
const express = require("express");
const date = require("date-and-time");

const Place = require("../models/Place.js");
const CheckIn = require("../models/CheckIn.js");
const Review = require("../models/Review.js");
const Bookmark = require("../models/Bookmark.js");
const User = require("../models/User.js");
const Trip = require("../models/Trip.js");

const {
  distanceTwoPoint,
  getPlaceInformation,
  getForecast,
} = require("../utils/function.js");

const TMD_KEY = process.env.TMD_KEY;

const router = express.Router();

// get place information from id and type
router.get("/information", async (req, res) => {
  try {
    const placeId = req.query.placeId;
    // 4 type SHOP RESTAURANT ACCOMMODATION ATTRACTION
    const type = req.query.type;
    const forecastDate = req.query.forecastDate;
    const forecastDuration = req.query.forecastDuration;

    const userId = req.user.id;

    // check parameter
    if (!placeId || !type) {
      return res.status(400).json({ error: "Missing or invalid parameters" });
    }

    const responsePlace = await getPlaceInformation(type, placeId, res);

    const checkIns = await CheckIn.find({ placeId: placeId });
    // check did user already checkIn this place?

    const isUserCheckIn = checkIns.reduce((result, current) => {
      if (current.userId === userId) result = true;
      return result;
    }, false);

    // get forecast

    const now = new Date();

    // Formatting the date and time
    let TMD_response = null;
    // if (forecastDate && forecastDuration) {
    //   TMD_response = await getForecast(
    //     responsePlace.location.province,
    //     responsePlace.location.district,
    //     forecastDate,
    //     forecastDuration,
    //     res
    //   );
    // }

    // get all review of this place
    const review = await Review.find({ placeId: placeId });

    let responseReview = [];
    for (const item of review) {
      alreadyLike = item.likes.some((like) => like.userId === userId);
      const user = await User.findOne({ id: item.userId });

      responseReview.push({
        reviewId: item.reviewId,
        userId: item.userId,
        username: user.username,
        profileUrl: user.profileUrl,
        createDate: item.createDate,
        content: item.content,
        img: item.img.map((item) => item.url),
        rating: item.rating,
        totalLike: item.likes.length,
        alreadyLike: alreadyLike,
      });
    }

    const bookmark = await Bookmark.findOne({
      placeId: placeId,
      userId: userId,
    });

    // sent data to client
    let response = {
      ...responsePlace,
      totalCheckIn: checkIns.length,
      alreadyCheckIn: isUserCheckIn,
      forecasts: TMD_response
        ? TMD_response.data.WeatherForecasts[0].forecasts
        : [],
      review: responseReview,
      alreadyBookmark: bookmark ? true : false,
    };
    return res.json(response);
  } catch (error) {
    console.log(error);
    return res.status(400).json({ error: error });
  }
});

router.post("/checkIn", async (req, res) => {
  try {
    const latitude = req.body.latitude;
    const longitude = req.body.longitude;
    const placeId = req.body.placeId;
    const userId = req.user.id;

    // check is placeId available
    const place = await Place.findOne({ placeId: placeId });
    if (!place) {
      return res
        .status(404)
        .json({ error: `No place found for placeId: ${placeId}` });
    }

    const distance = distanceTwoPoint(
      place.latitude,
      place.longitude,
      latitude,
      longitude
    );

    if (distance > 3) {
      return res.status(404).json({
        error: `The distance (${distance.toFixed(
          2
        )} km) exceeds the allowed threshold. `,
      });
    }

    // check if user already checkIn res error
    const checkIn = await CheckIn.findOne({
      placeId: placeId,
      userId: userId,
    });

    if (checkIn) {
      return res
        .status(409)
        .json({ error: "Already checked in at this place" });
    }

    // create new checkIn
    await CheckIn.create({
      placeId: placeId,
      userId: userId,
      province: place.location.province,
    });
    return res.json({ message: "Success checkIn" });
  } catch (error) {
    return res.status(400).json({ error: error });
  }
});

// bookmark place or unBookmark
router.post("/bookmark", async (req, res) => {
  try {
    const placeId = req.body.placeId;
    const userId = req.user.id;

    // check is placeId available
    const place = await Place.findOne({ placeId: placeId });
    if (!place) {
      return res
        .status(404)
        .json({ error: `No place found for placeId: ${placeId}` });
    }

    const bookmark = await Bookmark.findOne({
      placeId: placeId,
      userId: userId,
    });

    // if already bookmark delete else create new one
    if (bookmark) {
      await Bookmark.findOneAndDelete({
        placeId: placeId,
        userId: userId,
      });
    } else {
      await Bookmark.create({
        placeId: placeId,
        userId: userId,
      });
    }
    return res.json({ message: "Success" });
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err });
  }
});

router.get("/bookmark", async (req, res) => {
  try {
    // 2 type have tripId and have not

    const { tripId } = req.query;
    const userId = req.user.id;
    const bookmarks = await Bookmark.find({ userId: userId });

    const places = [];
    if (tripId) {
      const trip = await Trip.findOne({ tripId: tripId });
      if (!trip) {
        return res
          .status(404)
          .json({ error: `No trip found for tripId: ${tripId}` });
      }

      for (const item of bookmarks) {
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
          forecasts:
            TMD_response.length !== 0
              ? TMD_response.data.WeatherForecasts[0].forecasts
              : [],
          alreadyAdd: trip.place.some(
            (placeInTrip) =>
              placeInTrip.placeId === place.placeId &&
              placeInTrip.selectBy.some((member) => member === userId)
          ),
        });
      }
    }

    return res.json(places);
  } catch (err) {
    // console.log(err);
    return res.status(400).json({ error: err });
  }
});

// get recommend place
router.get("/recommend", async (req, res) => {
  try {
    const { tripId } = req.query;
    const userId = req.user.id;

    const place = await CheckIn.aggregate([
      { $group: { _id: "$placeId" } },
      { $sort: { _id: 1 } },
      { $limit: 20 },
    ]);

    const placeIdList = place.map((id) => id._id);
    const trip = await Trip.findOne({ tripId: tripId });

    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }
    const places = [];

    for (const placeId of placeIdList) {
      const place = await Place.findOne({ placeId: placeId });
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
        forecasts:
          TMD_response.length !== 0
            ? TMD_response.data.WeatherForecasts[0].forecasts
            : [],
        alreadyAdd: trip.place.some(
          (placeInTrip) =>
            placeInTrip.placeId === place.placeId &&
            placeInTrip.selectBy.some((member) => member === userId)
        ),
      });
    }
    return res.json(places);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: err });
  }
});

router.get("/blogSearch", async (req, res) => {
  try {
    const { input } = req.query;

    const header = {
      "Accept-Language": "th",
      "Content-Type": "text/json",
      Authorization: process.env.TAT_KEY,
    };
    const TAT_response = await axios(
      `https://tatapi.tourismthailand.org/tatapi/v5/places/search`,
      {
        params: {
          location: "13.6904831,100.5226014",
          keyword: input,
          numberofresult: 10,
        },
        headers: header,
      }
    );
    // add new place to database
    for (const place of TAT_response.data.result) {
      await getPlaceInformation(place.category_code, place.place_id, res);
    }

    return res.json(
      TAT_response.data.result.map((information) => ({
        placeName: information.place_name,
        placeId: information.place_id,
        location: {
          province: information.location.province,
          district: information.location.district,
        },
        coverImg: information.thumbnail_url,
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: err });
  }
});

router.post("/checkInTest", async (req, res) => {
  try {
    const placeId = req.body.placeId;
    const userId = req.user.id;

    // check is placeId available
    const place = await Place.findOne({ placeId: placeId });
    if (!place) {
      return res
        .status(404)
        .json({ error: `No place found for placeId: ${placeId}` });
    }

    // check if user already checkIn res error
    const checkIn = await CheckIn.findOne({
      placeId: placeId,
      userId: userId,
    });

    if (checkIn) {
      return res
        .status(409)
        .json({ error: "Already checked in at this place" });
    }

    // create new checkIn
    await CheckIn.create({
      placeId: placeId,
      userId: userId,
      province: place.location.province,
    });
    return res.json({ message: "Success checkIn" });
  } catch (error) {
    return res.status(400).json({ error: error });
  }
});

router.get("/search", async (req, res) => {
  try {
    const userId = req.user.id;
    const { input, tripId } = req.query;

    const header = {
      "Accept-Language": "th",
      "Content-Type": "text/json",
      Authorization: process.env.TAT_KEY,
    };
    const TAT_response = await axios(
      `https://tatapi.tourismthailand.org/tatapi/v5/places/search`,
      {
        params: {
          location: "13.6904831,100.5226014",
          keyword: input,
          numberofresult: 10,
        },
        headers: header,
      }
    );
    // add new place to database
    for (const place of TAT_response.data.result) {
      await getPlaceInformation(place.category_code, place.place_id, res);
    }

    const placeIdList = TAT_response.data.result.map(
      (information) => information.place_id
    );
    const trip = await Trip.findOne({ tripId: tripId });

    if (!trip) {
      return res
        .status(404)
        .json({ error: `No trip found for tripId: ${tripId}` });
    }
    const places = [];

    for (const placeId of placeIdList) {
      const place = await Place.findOne({ placeId: placeId });
      // get forecast
      if (place) {
        const TMD_response = await getForecast(
          place.location.province,
          place.location.district,
          trip.date.start,
          5,
          res
        );

        places.push({
          ...place.toObject(),
          forecasts:
            TMD_response.length !== 0
              ? TMD_response.data.WeatherForecasts[0].forecasts
              : [],
          alreadyAdd: trip.place.some(
            (placeInTrip) =>
              placeInTrip.placeId === place.placeId &&
              placeInTrip.selectBy.some((member) => member === userId)
          ),
        });
      }
    }
    return res.json(places);
  } catch (err) {
    return res.json([]);
  }
});

module.exports = router;

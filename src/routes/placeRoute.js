require("dotenv").config();

const axios = require("axios");
const express = require("express");
const date = require("date-and-time");

const Place = require("../models/Place.js");
const CheckIn = require("../models/CheckIn.js");
const Review = require("../models/Review.js");
const Bookmark = require("../models/Bookmark.js");

const {
  distanceTwoPoint,
  getPlaceInformation,
} = require("../utils/function.js");

const TAT_KEY = process.env.TAT_KEY;
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

    const header = {
      "Accept-Language": "th",
      "Content-Type": "text/json",
      Authorization: TAT_KEY,
    };

    const responsePlace = await getPlaceInformation(type, placeId);

    const checkIns = await CheckIn.find({ placeId: placeId });
    // check did user already checkIn this place?

    const isUserCheckIn = checkIns.reduce((result, current) => {
      if (current.userId === userId) result = true;
      return result;
    }, false);

    // get forecast

    const now = new Date();

    // Formatting the date and time
    const dateValue = date.format(now, "YYYY-MM-DD");
    let TMD_response = null;
    if (forecastDate && forecastDuration) {
      TMD_response = await axios(
        "https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/place",
        {
          params: {
            province: responsePlace.location.province,
            amphoe: responsePlace.location.district,
            date: forecastDate,
            duration: forecastDuration,
          },
          headers: {
            accept: "application/json",
            authorization: TMD_KEY,
          },
        }
      );
    }

    // get all review of this place
    const review = await Review.find({ placeId: placeId });

    let responseReview = review.map((item) => {
      alreadyLike = item.likes.some((like) => like.userId === userId);

      return {
        reviewId: item.reviewId,
        userId: item.userId,
        content: item.content,
        img: item.img,
        rating: item.rating,
        totalLike: item.likes.length,
        alreadyLike: alreadyLike,
      };
    });

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

    if (distance > 5) {
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

module.exports = router;

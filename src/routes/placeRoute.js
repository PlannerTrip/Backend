require("dotenv").config();

const axios = require("axios");
const express = require("express");
const date = require("date-and-time");

const Place = require("../models/Place.js");
const CheckIn = require("../models/CheckIn.js");
const Review = require("../models/Review.js");

const { distanceTwoPoint } = require("../utils/function.js");

const TAT_KEY = process.env.TAT_KEY;
const TMD_KEY = process.env.TMD_KEY;

const router = express.Router();

// get place information from id and type
router.get("/information", async (req, res) => {
  try {
    const placeId = req.body.placeId;
    // 5 type SHOP RESTAURANT ACCOMMODATION ATTRACTION OTHER
    const type = req.body.type;
    const userId = req.user.id;
    const forecastDate = req.body.forecastDate;
    const forecastDuration = req.body.forecastDuration;

    // check parameter
    if (!placeId || !type) {
      res.status(400).json({ error: "Missing or invalid parameters" });
    }

    const header = {
      "Accept-Language": "th",
      "Content-Type": "text/json",
      Authorization: TAT_KEY,
    };

    let place = await Place.findOne({ placeId: placeId });
    let responsePlace = place ? place.toObject() : {};
    // if didn't have place in dataBase get from TAT
    if (!place) {
      const listOfType = ["ATTRACTION", "SHOP", "ACCOMMODATION", "RESTAURANT"];
      // check type
      if (!listOfType.includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
      }

      // call api to TAT
      const TAT_response = await axios(
        `https://tatapi.tourismthailand.org/tatapi/v5/${type.toLowerCase()}/${placeId}`,
        {
          headers: header,
        }
      );

      const tag = TAT_response.data.result.place_information[
        `${type.toLowerCase()}_types`
      ]
        ? TAT_response.data.result.place_information[
            `${type.toLowerCase()}_types`
          ].map((item) => item.description)
        : null;

      const responseData = TAT_response.data.result;
      responsePlace = {
        placeId: responseData.place_id,
        placeName: responseData.place_name,
        type: type,
        coverImg: responseData.web_picture_urls,
        introduction: responseData.place_information.introduction,
        tag: tag,
        latitude: responseData.latitude,
        longitude: responseData.longitude,
        contact: {
          phone: responseData.contact.phones
            ? responseData.contact.phones[0]
            : null,
          url: responseData.contact.urls ? responseData.contact.urls[0] : null,
        },
        location: {
          address: responseData.location.address,
          district: responseData.location.district,
          province: responseData.location.province,
        },
        weekDay:
          type === "ACCOMMODATION"
            ? null
            : responseData.opening_hours.weekday_text,
      };
      const createNewPlace = await Place.create(responsePlace);
    }

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

    // sent data to client
    let response = {
      ...responsePlace,
      totalCheckIn: checkIns.length,
      alreadyCheckIn: isUserCheckIn,
      forecasts: TMD_response.data.WeatherForecasts[0].forecasts,
      review: responseReview,
    };
    return res.json(response);
  } catch (error) {
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

module.exports = router;

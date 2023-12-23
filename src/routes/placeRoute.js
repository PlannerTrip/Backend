require("dotenv").config();

const axios = require("axios");
const express = require("express");

const Place = require("../models/Place.js");
const CheckIn = require("../models/CheckIn.js");

const TAT_KEY = process.env.TAT_KEY;

const router = express.Router();

// get place information from id and type
router.get("/information", async (req, res) => {
  try {
    const id = req.body.id;

    // 5 type SHOP RESTAURANT ACCOMMODATION ATTRACTION OTHER
    const type = req.body.type;

    // check parameter
    if (!id || !type) {
      res.status(400).json({ error: "Missing or invalid parameters" });
    }

    const header = {
      "Accept-Language": "th",
      "Content-Type": "text/json",
      Authorization: TAT_KEY,
    };

    let place = await Place.findOne({ placeId: req.body.id });

    // if didn't have place in dataBase get from TAT
    if (!place) {
      const noWeekDay = ["ACCOMMODATION", "OTHER"];
      const listOfType = [
        "ATTRACTION",
        "SHOP",
        "ACCOMMODATION",
        "RESTAURANT",
        "OTHER",
      ];
      // check type
      if (!listOfType.includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
      }

      // call api to TAT
      const response = await axios(
        `https://tatapi.tourismthailand.org/tatapi/v5/${type.toLowerCase()}/${id}`,
        {
          headers: header,
        }
      );

      const tag = response.data.result.place_information[
        `${type.toLowerCase()}_types`
      ]
        ? response.data.result.place_information[
            `${type.toLowerCase()}_types`
          ].map((item) => item.description)
        : null;

      const responseData = response.data.result;
      place = {
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
        weekDay: noWeekDay.includes(type)
          ? null
          : responseData.opening_hours.weekday_text,
      };
      const createNewPlace = await Place.create(place);
    }
    // STEP
    // get total checkIn and check did user already checkIn or not
    // get forecast
    // set back to client

    return res.json(place);
  } catch (error) {
    return res.status(400).json({ error: error });
  }
});

router.post("/checkIn", async (req, res) => {
  try {
    const checkIn = await CheckIn.findOne({
      placeId: req.body.placeId,
      userId: req.user.id,
    });
    if (checkIn) {
      return res
        .status(409)
        .json({ error: "Already checked in at this place" });
    }

    const place = await Place.findOne({ placeId: req.body.placeId });
    if (!place) {
      return res
        .status(404)
        .json({ error: `No place found for placeId: ${req.body.placeId}` });
    }

    await CheckIn.create({
      placeId: req.body.placeId,
      userId: req.user.id,
      province: place.location.province,
    });
    return res.json({ message: "Success checkIn" });
  } catch (error) {
    return res.status(400).json({ error: error });
  }
});

module.exports = router;

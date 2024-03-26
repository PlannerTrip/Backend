require("dotenv").config();

const express = require("express");

const User = require("../models/User.js");
const Report = require("../models/Report.js");
const Trip = require("../models/Trip.js");
const Blog = require("../models/Blog.js");
const Bookmark = require("../models/Bookmark.js");
const Place = require("../models/Place.js");
const CheckIn = require("../models/CheckIn.js");

const { v4: uuidv4 } = require("uuid");
const {
  allProvince,
  centralRegion,
  northernRegion,
  northeasternRegion,
  southernRegion,
  easternRegion,
  westernRegion,
} = require("../utils/const.js");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const checkInPlace = await CheckIn.find({ userId });
    const uniqueProvince = [
      ...new Set(checkInPlace.map((item) => item.province)),
    ];

    const checkInCheck = (region, allProvinceInRegion) => {
      for (province of allProvinceInRegion) {
        if (uniqueProvince.includes(province)) {
          region.total = region.total + 1;
          region.province.push({ name: province, alreadyCheckIn: true });
        } else {
          region.province.push({ name: province, alreadyCheckIn: false });
        }
      }
    };

    const central = { total: 0, province: [], max: centralRegion.length };
    checkInCheck(central, centralRegion);
    const northern = { total: 0, province: [], max: northernRegion.length };
    checkInCheck(northern, northernRegion);
    const northeastern = {
      total: 0,
      province: [],
      max: northeasternRegion.length,
    };
    checkInCheck(northeastern, northeasternRegion);
    const southern = { total: 0, province: [], max: southernRegion.length };
    checkInCheck(southern, southernRegion);
    const eastern = { total: 0, province: [], max: easternRegion.length };
    checkInCheck(eastern, easternRegion);
    const western = { total: 0, province: [], max: westernRegion.length };
    checkInCheck(western, westernRegion);
    return res.json({
      eastern,
      central,
      southern,
      northeastern,
      northern,
      western,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/map", async (req, res) => {
  try {
    const userId = req.user.id;
    const checkInPlace = await CheckIn.find({ userId });
    const uniqueProvince = [
      ...new Set(checkInPlace.map((item) => item.province)),
    ];

    return res.json({
      allProvince: allProvince,
      alreadyCheckIn: uniqueProvince,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/place", async (req, res) => {
  try {
    const userId = req.user.id;

    const { province } = req.query;

    if (!allProvince.includes(province)) {
      return res.status(404).json({ error: "wrong province " });
    }

    const checkInPlace = await CheckIn.find({ userId, province });

    const response = [];
    for (const place of checkInPlace) {
      const placeInfo = await Place.findOne({ placeId: place.placeId });
      response.push({
        placeId: placeInfo.placeId,
        placeName: placeInfo.placeName,
        coverImg: placeInfo.coverImg[0] ? placeInfo.coverImg[0] : "",
        district: placeInfo.location.district,
        checkInTime: place.timestamp,
      });
    }

    return res.json(response);
  } catch (err) {
    return res.status(500).json(err.message);
  }
});

// router.get("/update", async (req, res) => {
//   try {
//     await Place.updateMany({ coverImg: null }, { $set: { coverImg: [] } });
//     res.json("done");
//   } catch (err) {
//     res.status(500).json(err.messages);
//   }
// });

module.exports = router;

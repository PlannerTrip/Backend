require("dotenv").config();

const bcrypt = require("bcrypt");
const axios = require("axios");

const Place = require("../models/Place.js");
const User = require("../models/User.js");
const Trip = require("../models/Trip.js");

const TMD_KEY = process.env.TMD_KEY;

const polyline = require("@mapbox/polyline");

const hashPassword = async (password) => {
  try {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Error hashing password: ${error.message}`);
  }
};

const comparePasswords = async (password, hashedPassword) => {
  try {
    const match = await bcrypt.compare(password, hashedPassword);
    return match;
  } catch (error) {
    throw new Error(`Error comparing passwords: ${error.message}`);
  }
};

const distanceTwoPoint = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers

  const toRadians = (degrees) => degrees * (Math.PI / 180);

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// get place information if place did not in database get in from TAT
const getPlaceInformation = async (type, placeId, res) => {
  try {
    const header = {
      "Accept-Language": "th",
      "Content-Type": "text/json",
      Authorization: process.env.TAT_KEY,
    };

    let place = await Place.findOne({ placeId: placeId });
    // if didn't have place in dataBase get from TAT
    if (!place) {
      const listOfType = ["ATTRACTION", "SHOP", "ACCOMMODATION", "RESTAURANT"];
      // check type
      if (type === "OTHER") {
        return [];
      }
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
      const responsePlace = {
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
      return responsePlace;
    } else {
      return place.toObject();
    }
  } catch (err) {
    return res.status(400).json({ error: error });
  }
};

const getForecast = async (province, district, startDate, duration, res) => {
  try {
    // for debug
    return [];

    let date = new Date(startDate);

    let endDate = new Date(Date.now());
    endDate.setDate(endDate.getDate() + 7);

    if (new Date(Date.now()) > date) {
      date = new Date(Date.now());
    } else if (date > endDate) {
      return [];
    }

    const formattedDate =
      date.getFullYear() +
      "-" +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + date.getDate()).slice(-2);

    console.log(formattedDate);
    const TMD_response = await axios(
      "https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/place",
      {
        params: {
          province: province,
          amphoe: district,
          date: formattedDate,
          duration: duration,
        },
        headers: {
          accept: "application/json",
          authorization: TMD_KEY,
        },
      }
    );
    return TMD_response;
  } catch (err) {
    console.log("forecast Error");
    throw new Error(err.message);
    // console.log(err);
    // return res.status(400).json({ error: err });
  }
};

const getUserInformation = async (arrayUser) => {
  try {
    const result = [];
    for (const userId of arrayUser) {
      const userInformation = await User.findOne({ id: userId });

      result.push({
        userId: userInformation.id,
        username: userInformation.username,
        userprofile: userInformation.profileUrl,
      });
    }
    return result;
  } catch (err) {
    console.log(err);
    return [];
  }
};

const checkUserIdExists = (trip, userId, tripId) => {
  if (!trip.member.some((user) => user.userId === userId)) {
    throw new Error(`No userId found for tripId: ${tripId}`);
  }
};

const getTrip = async (tripId) => {
  const trip = await Trip.findOne({ tripId: tripId });

  if (!trip) {
    throw new Error(`No trip found for tripId: ${tripId}`);
  }

  return trip;
};

const checkOwner = (id, createBy) => {
  if (id !== createBy) {
    throw new Error(`"Permission denied`);
  }
};

const compareTime = (a, b) => {
  const [hourA, minuteA] = a.split(":").map(Number);
  const [hourB, minuteB] = b.split(":").map(Number);

  if (hourA !== hourB) {
    return hourA - hourB; // Sort by hour first
  } else {
    return minuteA - minuteB; // If hours are equal, sort by minute
  }
};

const getTripInformation = async (trips) => {
  try {
    const response = [];

    for (trip of trips) {
      const users = await getUserInformation(
        trip.member.map((member) => member.userId)
      );

      const province = {};

      for (placeId of trip.place.map((place) => place.placeId)) {
        const place = await Place.findOne({ placeId });
        if (province[place.location.province]) {
          province[place.location.province] =
            province[place.location.province] + 1;
        } else {
          province[place.location.province] = 1;
        }
      }

      const provinceArray = Object.entries(province)
        .sort((a, b) => b[1] - a[1])
        .map((item) => item[0]);

      response.push({
        name: trip.name,
        coverImg: trip.coverImg.url,
        date: trip.date,
        tripId: trip.tripId,
        member: users,
        province: provinceArray.slice(0, 3),
      });
    }
    return response;
  } catch (err) {
    throw new Error(err.message);
  }
};

const getStopPlace = async (geolocation) => {
  try {
    const header = {
      "Accept-Language": "th",
      "Content-Type": "text/json",
      Authorization: process.env.TAT_KEY,
    };

    const TAT_response = await axios(
      `https://tatapi.tourismthailand.org/tatapi/v5/places/search`,
      {
        params: {
          geolocation: geolocation,
          keyword: "",
          searchradius: 3000,
          numberofresult: 2,
        },
        headers: header,
      }
    );
    return TAT_response.data.result;
  } catch (err) {
    // console.log(err);
    return [];
  }
};

module.exports = {
  hashPassword,
  comparePasswords,
  distanceTwoPoint,
  getPlaceInformation,
  getForecast,
  getUserInformation,
  checkUserIdExists,
  getTrip,
  checkOwner,
  compareTime,
  getTripInformation,
  getStopPlace,
};

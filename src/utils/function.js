require("dotenv").config();

const bcrypt = require("bcrypt");
const Place = require("../models/Place.js");
const axios = require("axios");

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

module.exports = {
  hashPassword,
  comparePasswords,
  distanceTwoPoint,
  getPlaceInformation,
};

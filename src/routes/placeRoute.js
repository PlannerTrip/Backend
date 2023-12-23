require("dotenv").config();

const path = require("path");
const sharp = require("sharp");
const axios = require("axios");
const multer = require("multer");
const express = require("express");
const uploadMiddleware = require("../middlewares/uploadMiddleware");

const Place = require("../models/Place.js");

const TAT_KEY = process.env.TAT_KEY;

const router = express.Router();

// get place information from id and type
router.get("/information", async (req, res) => {
  try {
    console.log(req.body);
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

    return res.json(place);
  } catch (err) {
    console.log(err);
    return res.json(err);
  }
});

const upload = multer({
  limits: {
    fileSize: 2000000,
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error("Please upload a valid image file"));
    }
    cb(undefined, true);
  },
});

// single img
router.post("/image", upload.single("upload"), async (req, res) => {
  try {
    const newPath = __dirname.split("/");
    newPath.pop();

    await sharp(req.file.buffer)
      .resize({ width: 250, height: 250 })
      .png()
      .toFile(newPath.join("/") + `/images/${req.file.originalname}`);
    return res.status(201).send("Image uploaded succesfully");
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
});

// multiple img
router.post("/upload", uploadMiddleware, (req, res) => {
  const files = req.files;

  return res.json("done");
});

//  ================== fireBase ==================
const uploadFirebase = multer({ storage: multer.memoryStorage() });

const { initializeApp, cert } = require("firebase-admin/app");
const { getStorage, getDownloadURL } = require("firebase-admin/storage");

const serviceAccount = require("../../firebaseServiceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.BUCKET_URL,
});

const bucket = getStorage().bucket();

router.post(
  "/uploadFirebase",
  uploadFirebase.single("file"),
  async (req, res) => {
    try {
      const fileName = Date.now() + path.extname(req.file.originalname);
      const file = bucket.file(fileName);
      await file.createWriteStream().end(req.file.buffer);

      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${
        bucket.name
      }/o/${fileName}?alt=media&token=${Date.now()}`;

      // const downloadURL = await getDownloadURL(file)
      return res.json({ url: downloadURL });
      // return res.json("done");
    } catch (err) {
      return res.status(404).json({ error: err });
    }
  }
);

router.delete("/delete", async (req, res) => {
  const filesName = req.body.filename;
  const file = bucket.file(filesName);
  await file.delete();
  return res.json("done");
});

module.exports = router;

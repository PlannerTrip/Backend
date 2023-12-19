require("dotenv").config();

const path = require("path");
const sharp = require("sharp");
const axios = require("axios");
const multer = require("multer");
const express = require("express");
const uploadMiddleware = require("../middlewares/uploadMiddleware");

const TAT_KEY = process.env.TAT_KEY;

const router = express.Router();

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

// router.get("/information", (req, res) => {
//   const files = req.body;
//   console.log(files);
//   return res.json("done");
// });

router.get("/information", async (req, res) => {
  try {
    console.log(req.body);
    const id = req.body.id;

    // 5 type SHOP RESTAURANT ACCOMMODATION ATTRACTION OTHER
    const type = req.body.type;

    if (!id || !type) {
      res.status(400).json({ error: "Missing or invalid parameters" });
    }

    const header = {
      "Accept-Language": "th",
      "Content-Type": "text/json",
      Authorization: TAT_KEY,
    };

    // check type
    // check id in database
    // if didn't have call api and save to database then return response
    // if have return response

    if (type === "RESTAURANT") {
      const response = await axios(
        `https://tatapi.tourismthailand.org/tatapi/v5/attraction/${id}`,
        {
          headers: header,
        }
      );
    } else if (type === "SHOP") {
    } else if (type === "ACCOMMODATION") {
    } else if (type === "ATTRACTION") {
    } else if (type === "OTHER") {
    } else {
      return res.status(400).json({ error: "Invalid type" });
    }

    return res.json("done");
  } catch (err) {
    console.log(err.response.statusText);
    return res.json("fail");
  }
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

//  fireBase
const uploadFirebase = multer({ storage: multer.memoryStorage() });

const { initializeApp, cert } = require("firebase-admin/app");
const { getStorage, getDownloadURL } = require("firebase-admin/storage");

const serviceAccount = require("../../serviceAccountKey.json");

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
      console.log(bucket.name);
      await file.createWriteStream().end(req.file.buffer);

      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${
        bucket.name
      }/o/${fileName}?alt=media&token=${Date.now()}`;
      return res.json({ url: downloadURL });
      // return res.json("done");
    } catch (err) {
      return res.status(404).json({ error: err });
    }
  }
);

module.exports = router;

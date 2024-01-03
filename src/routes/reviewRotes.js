require("dotenv").config();

const express = require("express");

const router = express.Router();
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

//  ================== fireBase ==================
const uploadFirebase = multer({ storage: multer.memoryStorage() });

const { initializeApp, cert } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");

const serviceAccount = require("../../firebaseServiceAccountKey.json");

const Review = require("../models/Review.js");
const Place = require("../models/Place.js");

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.BUCKET_URL,
});

const bucket = getStorage().bucket();

const uploadFirebase2 = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
  },
});

router.post("/", uploadFirebase2.array("files", 5), async (req, res) => {
  try {
    const { rating, content, placeId } = req.body;

    if (!rating || !content || !placeId) {
      return res.status(400).json({
        error:
          "rating and content and placeId are required in the request body.",
      });
    }

    const userId = req.user.id;
    const files = req.files;
    const downloadURLs = [];

    const place = await Place.findOne({ placeId: placeId });
    if (!place) {
      return res
        .status(404)
        .json({ error: `No place found for placeId: ${placeId}` });
    }

    //  upload file
    await files.forEach(async (item) => {
      const randomString = crypto.randomBytes(12).toString("hex");

      const fileName =
        Date.now() + "_" + randomString + path.extname(item.originalname);
      const file = bucket.file(fileName);
      await file.createWriteStream().end(item.buffer);

      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${
        bucket.name
      }/o/${fileName}?alt=media&token=${Date.now()}`;

      downloadURLs.push({ url: downloadURL, fileName: fileName });
    });

    await Review.create({
      reviewId: uuidv4(),
      userId: userId,
      placeId: placeId,
      content: content,
      rating: rating,
      img: downloadURLs,
      likes: [],
    });

    res.json({ message: "success review" });
  } catch (err) {
    return res.status(404).json({ error: err });
  }
});

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

// const upload = multer({
//   limits: {
//     fileSize: 2000000,
//   },
//   fileFilter(req, file, cb) {
//     if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
//       return cb(new Error("Please upload a valid image file"));
//     }
//     cb(undefined, true);
//   },
// });

// // single img
// router.post("/image", upload.single("upload"), async (req, res) => {
//   try {
//     const newPath = __dirname.split("/");
//     newPath.pop();

//     await sharp(req.file.buffer)
//       .resize({ width: 250, height: 250 })
//       .png()
//       .toFile(newPath.join("/") + `/images/${req.file.originalname}`);
//     return res.status(201).send("Image uploaded succesfully");
//   } catch (error) {
//     console.log(error);
//     return res.status(400).send(error);
//   }
// });

// // multiple img
// router.post("/upload", uploadMiddleware, (req, res) => {
//   const files = req.files;

//   return res.json("done");
// });

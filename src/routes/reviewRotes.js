require("dotenv").config();

const express = require("express");

const router = express.Router();
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

//  ================== fireBase ==================

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

const uploadFirebase = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
  },
});

// create review
router.post("/", uploadFirebase.array("files", 5), async (req, res) => {
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

// delete review
router.delete("/delete", async (req, res) => {
  try {
    const reviewId = req.body.reviewId;
    const userId = req.user.id;

    const review = await Review.findOne({ reviewId: reviewId });

    if (!review) {
      return res
        .status(404)
        .json({ error: `No review found for reviewId: ${reviewId}` });
    }

    if (review.userId !== userId) {
      return res.status(403).json({ error: "Permission denied" });
    }

    // delete img from firebase

    await review.img.forEach(async (item) => {
      const file = bucket.file(item.fileName);
      await file.delete();
    });

    return res.json("delete review success");
  } catch (err) {
    console.log(err);
    return res.status(404).json({ error: err });
  }
});

// like review
router.post("/like", async (req, res) => {
  try {
    const reviewId = req.body.reviewId;
    const userId = req.user.id;

    const review = await Review.findOne({ reviewId: reviewId });

    if (!review) {
      return res
        .status(404)
        .json({ error: `No review found for reviewId: ${reviewId}` });
    }

    if (review.likes.some((item) => item.userId == userId)) {
      review.likes = review.likes.filter((item) => item.userId !== userId);
      await review.save();

      return res.json({ message: `Unlike success` });
    }

    review.likes = [...review.likes, { userId: userId }];
    await review.save();

    res.json({ message: "Like success" });
  } catch (err) {
    console.log(err);
    return res.status(404).json({ error: err });
  }
});

module.exports = router;

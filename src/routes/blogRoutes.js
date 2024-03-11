require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const multer = require("multer");
const crypto = require("crypto");

const path = require("path");

//  ================== fireBase ==================

const { getStorage, getDownloadURL } = require("firebase-admin/storage");

const Blog = require("../models/Blog.js");

const bucket = getStorage().bucket();

const uploadFirebase = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
  },
});

router.post("/", uploadFirebase.array("files", 10), async (req, res) => {
  try {
    const { name, note, place, tripIdReference, startDate, endDate } = req.body;
    const userId = req.user.id;
    const files = req.files;

    const downloadURLs = await Promise.all(
      files.map(async (item) => {
        const randomString = crypto.randomBytes(12).toString("hex");
        const fileName =
          Date.now() + "_" + randomString + path.extname(item.originalname);
        const file = bucket.file(fileName);

        const stream = file.createWriteStream().end(item.buffer);

        return new Promise((resolve, reject) => {
          stream.on("finish", async () => {
            try {
              const downloadURL = await getDownloadURL(file);
              resolve({ url: downloadURL, fileName: fileName });
            } catch (error) {
              reject(error);
            }
          });
        });
      })
    );
    await Blog.create({
      blogId: uuidv4(),
      name,
      note,
      tripIdReference,
      date: { start: startDate, end: endDate },
      img: [],
      place,
      createBy: userId,
      img: downloadURLs,
    });

    res.json("success create blog");
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "something went wrong" });
  }
});

module.exports = router;

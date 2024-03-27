require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const multer = require("multer");
const crypto = require("crypto");

const path = require("path");

const User = require("../models/User.js");
const Place = require("../models/Place.js");
const Trip = require("../models/Trip.js");

//  ================== fireBase ==================

const { getStorage, getDownloadURL } = require("firebase-admin/storage");

const Blog = require("../models/Blog.js");
const { blogGetInformation } = require("../utils/blogFunction.js");

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
      likes: [],
    });

    res.json("success create blog");
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "something went wrong" });
  }
});

// get recommend sort by like
router.get("/recommend", async (req, res) => {
  try {
    const userId = req.user.id;

    const blogs = await Blog.find().sort({ likes: -1 }).limit(20);
    const response = await blogGetInformation(blogs, userId);

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get recent blog new -> old
router.get("/recent", async (req, res) => {
  try {
    const userId = req.user.id;

    const blogs = await Blog.find().sort({ createDate: -1 }).limit(20);
    const response = await blogGetInformation(blogs, userId);

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get search blog
router.get("/search", async (req, res) => {
  try {
    const userId = req.user.id;
    const { input } = req.query;
    const blogs = await Blog.find({
      name: { $regex: input, $options: "i" },
    });
    const response = await blogGetInformation(blogs, userId);

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/information", async (req, res) => {
  try {
    const userId = req.user.id;
    const { blogId } = req.query;

    if (!blogId) {
      return res.status(404).json("blogId not found");
    }

    const blog = await Blog.findOne({ blogId });

    if (!blog) {
      return res.status(404).json("blog not found");
    }

    const userInformation = await User.findOne({ id: blog.createBy });

    const province = {};

    const places = [];

    // get place information in trip
    for (placeId of blog.place) {
      const place = await Place.findOne({ placeId });
      if (province[place.location.province]) {
        province[place.location.province] =
          province[place.location.province] + 1;
      } else {
        province[place.location.province] = 1;
      }

      places.push({
        placeId: place.placeId,
        type: place.type,
        placeName: place.placeName,
        coverImg: place.coverImg[0] ? place.coverImg[0] : "",
        location: {
          province: place.location.province,
          district: place.location.district,
        },
      });
    }

    const provinceArray = Object.entries(province)
      .sort((a, b) => b[1] - a[1])
      .map((item) => item[0]);

    const response = {
      name: blog.name,
      img: blog.img.map((img) => img.url),
      totalLike: blog.likes.length,
      createDate: blog.createDate,
      alreadyLike: blog.likes.some((like) => like.userId === userId),
      userId: userInformation.id,
      username: userInformation.username,
      userprofile: userInformation.profileUrl,
      province: provinceArray,
      places: places,
      tripIdReference: blog.tripIdReference,
      date: blog.date,
      note: blog.note,
    };
    return res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/copyTrip", async (req, res) => {
  try {
    const { blogId } = req.body;
    const userId = req.user.id;

    if (!blogId) {
      return res.status(404).json("tripId not found");
    }

    const blog = await Blog.findOne({ blogId });

    if (!blog) {
      return res.status(404).json("trip not found");
    }

    const place = blog.place.map((place) => ({
      placeId: place.placeId,
      selectBy: [userId],
    }));

    const newTripId = uuidv4();
    await Trip.create({
      tripId: newTripId,
      createBy: userId,
      member: [{ userId: userId, date: [{ start: "", end: "" }] }],
      place: place,
      inviteLink: uuidv4(),
    });

    return res.json({ tripId: newTripId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// like or unLike
router.post("/like", async (req, res) => {
  try {
    const { blogId } = req.body;
    const userId = req.user.id;

    const blog = await Blog.findOne({ blogId });

    if (blog.likes.some((like) => like.userId === userId)) {
      blog.likes = blog.likes.filter((like) => like.userId != userId);
      await blog.save();
      res.json("unlike success");
    } else {
      blog.likes = [...blog.likes, { userId: userId }];
      await blog.save();
      res.json("like success");
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

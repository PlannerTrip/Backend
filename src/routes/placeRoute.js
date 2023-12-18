require("dotenv").config();

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

router.get("/information", async (req, res) => {
  try {
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
      res.status(400).json({ error: "Invalid type" });
    }

    res.json("done");
  } catch (err) {
    console.log(err.response.statusText);
    res.json("fail");
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
    res.status(201).send("Image uploaded succesfully");
  } catch (error) {
    console.log(error);
    res.status(400).send(error);
  }
});

// multiple img
router.post("/upload", uploadMiddleware, (req, res) => {
  const files = req.files;

  res.json("done");
});

module.exports = router;

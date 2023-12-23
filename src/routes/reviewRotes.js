require("dotenv").config();

const express = require("express");

const router = express.Router();
const path = require("path");
const sharp = require("sharp");
const multer = require("multer");
const uploadMiddleware = require("../middlewares/uploadMiddleware");

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

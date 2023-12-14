const express = require("express");
const axios = require("axios");

require("dotenv").config();

const TAT_KEY = process.env.TAT_KEY;

const router = express.Router();

router.use(express.json());

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

module.exports = router;

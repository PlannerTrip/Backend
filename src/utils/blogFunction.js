const User = require("../models/User.js");
const Place = require("../models/Place.js");

const blogGetInformation = async (blogs, userId) => {
  try {
    const response = [];
    for (blog of blogs) {
      const userInformation = await User.findOne({ id: blog.createBy });

      const province = {};

      for (placeId of blog.place) {
        const place = await Place.findOne({ placeId });
        if (province[place.location.province]) {
          province[place.location.province] =
            province[place.location.province] + 1;
        } else {
          province[place.location.province] = 1;
        }
      }

      const provinceArray = Object.entries(province)
        .sort((a, b) => b[1] - a[1])
        .map((item) => item[0]);

      response.push({
        name: blog.name,
        img: blog.img[0] ? blog.img[0].url : "",
        totalLike: blog.likes.length,
        createDate: blog.createDate,
        alreadyLike: blog.likes.some((like) => like.userId === userId),
        userId: userInformation.id,
        username: userInformation.username,
        userprofile: userInformation.profileUrl,
        province: provinceArray.slice(0, 3),
      });
    }
    return response;
  } catch (err) {
    throw new Error(`blogGetInformation fail}`);
  }
};

module.exports = {
  blogGetInformation,
};

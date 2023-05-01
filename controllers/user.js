const User = require("../models/user");
const Blog = require("../models/blog");
const { errorHandler } = require("../helpers/dbError");
const _ = require("lodash");
const formidable = require("formidable");
const fs = require("fs");

exports.read = (req, res) => {
  req.profile.hashed_password = undefined;

  return res.json(req.profile);
};

exports.publicProfile = async (req, res) => {
  let username = req.params.username;

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({
        error: "User not found",
      });
    }

    let userId = user._id;

    const blogs = await Blog.find({ postedBy: userId })
      .populate("categories", "_id name slug")
      .populate("tags", "_id name slug")
      .populate("postedBy", "_id name")
      .limit(10)
      .select(
        "_id title slug excerpt categories tags postedBy createdAt updatedAt"
      );
    user.photo = undefined;
    user.hashed_password = undefined;
    user.salt = undefined;
    res.json({
      user,
      blogs,
    });
  } catch (err) {
    res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.update = async (req, res) => {
  try {
    const form = new formidable.IncomingForm();
    form.keepExtension = true;
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve({ fields, files });
        }
      });
    });

    let user = req.profile;
    user = _.extend(user, fields);

    if (fields.password && fields.password.length < 6) {
      return res.status(400).json({
        error: "Password should be min 6 characters long",
      });
    }

    if (files.photo) {
      if (files.photo.size > 10000000) {
        return res.status(400).json({
          error: "Image should be less than 1mb",
        });
      }
      user.photo.data = fs.readFileSync(files.photo.filepath);
      user.photo.contentType = files.photo.type;
    }

    const updatedUser = await user.save();
    updatedUser.hashed_password = undefined;
    updatedUser.salt = undefined;
    updatedUser.photo = undefined;
    res.json(updatedUser);
  } catch (err) {
    return res.status(400).json({ error: errorHandler(err) });
  }
};

exports.photo = async (req, res) => {
  const username = req.params.username;

  try {
    const user = await User.findOne({ username });

    if (user.photo.data) {
      res.set("Content-Type", user.photo.contentType);
      return res.send(user.photo.data);
    }
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

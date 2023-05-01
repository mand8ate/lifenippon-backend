const Tag = require("../models/tag");
const Blog = require("../models/blog");
const slugify = require("slugify");
const { errorHandler } = require("../helpers/dbError");

exports.create = async (req, res) => {
  const { name } = req.body;
  let slug = slugify(name).toLowerCase();

  let tag = new Tag({ name, slug });

  try {
    const data = await tag.save();
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: errorHandler(err) });
  }
};

exports.list = async (req, res) => {
  try {
    const data = await Tag.find({});

    res.json(data);
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.read = async (req, res) => {
  const slug = req.params.slug.toLowerCase();

  try {
    const tag = await Tag.findOne({ slug });

    // res.json(tag);
    const blogs = await Blog.find({ tags: tag })
      .populate("categories", "_id name slug")
      .populate("tags", "_id name slug")
      .populate("postedBy", "_id name")
      .select(
        "_id title slug excerpt categories postedBy tags createdAt updateAt"
      );

    res.json({ tag, blogs });
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.remove = async (req, res) => {
  const slug = req.params.slug.toLowerCase();

  try {
    const tag = await Tag.findOneAndRemove({ slug });

    if (!tag) {
      return res.status(400).json({
        message: "No tag",
      });
    }
    res.json({
      message: "Tag deleted successfully",
    });
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

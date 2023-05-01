const Category = require("../models/category");
const Blog = require("../models/blog");
const slugify = require("slugify");
const { errorHandler } = require("../helpers/dbError");

exports.create = async (req, res) => {
  const { name } = req.body;
  let slug = slugify(name).toLowerCase();

  let category = new Category({ name, slug });

  try {
    const data = await category.save();
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: errorHandler(err) });
  }
};

exports.list = async (req, res) => {
  try {
    const data = await Category.find({});

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
    const category = await Category.findOne({ slug });

    // res.json(category);
    const blogs = await Blog.find({ categories: category })
      .populate("categories", "_id name slug")
      .populate("tags", "_id name slug")
      .populate("postedBy", "_id name")
      .select(
        "_id title slug excerpt categories postedBy tags createdAt updateAt"
      );

    res.json({ category, blogs });
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.remove = async (req, res) => {
  const slug = req.params.slug.toLowerCase();

  try {
    const category = await Category.findOneAndRemove({ slug });

    if (!category) {
      return res.status(400).json({
        message: "No category",
      });
    }
    res.json({
      message: "Category deleted successfully",
    });
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

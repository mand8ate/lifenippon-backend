const Blog = require("../models/blog");
const Category = require("../models/category");
const User = require("../models/user");
const Tag = require("../models/tag");
const formidable = require("formidable");
const slugify = require("slugify");
const stripHtml = require("string-strip-html");
const _ = require("lodash");
const { errorHandler } = require("../helpers/dbError");
const fs = require("fs");
const { smartTrim } = require("../helpers/blog");

exports.create = async (req, res) => {
  try {
    const form = new formidable.IncomingForm();
    form.keepExtensions = true;
    // console.log(form);
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const { title, body, categories, tags } = fields;

    if (!title || !title.length) {
      return res.status(400).json({
        error: "Title is required",
      });
    }

    if (!body || body.length < 100) {
      return res.status(400).json({
        error: "Content is too short. Write at least 100 characters",
      });
    }

    if (!categories || categories.length === 0) {
      return res.status(400).json({
        error: "At least one category is required",
      });
    }

    if (!tags || tags.length === 0) {
      return res.status(400).json({
        error: "At least one tag is required",
      });
    }

    let blog = new Blog();
    blog.title = title;
    blog.body = body;
    blog.excerpt = smartTrim(body, 320, "", "...");
    blog.slug = slugify(title).toLowerCase();
    blog.mtitle = `${title} | ${process.env.APP_NAME}`;
    blog.mdesc = stripHtml(body.substring(0, 160));
    blog.postedBy = req.auth._id;
    // categories & tags
    let arrayOfCategories = categories && categories.split(",");
    let arrayOfTags = tags && tags.split(",");

    if (files.photo) {
      if (files.photo.size > 10000000) {
        return res.status(400).json({
          error: "Images should be less than 1mb in size",
        });
      }
      blog.photo.data = fs.readFileSync(files.photo.filepath);
      blog.photo.contentType = files.photo.mimetype;
    }

    const result = await blog.save();

    const updatedBlog = await Blog.findByIdAndUpdate(
      result._id,
      {
        $push: { categories: arrayOfCategories, tags: arrayOfTags },
      },
      { new: true }
    );

    res.json(updatedBlog);
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.list = async (req, res) => {
  try {
    const blogs = await Blog.find({})
      .populate("categories", "_id name slug")
      .populate("tags", "_id name slug")
      .populate("postedBy", "_id name username")
      .select(
        "_id title slug excerpt categories tags postedBy createdAt updatedAt"
      );

    res.json(blogs);
  } catch (err) {
    res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.listAllBlogsCategoriesTags = async (req, res) => {
  const limit = req.body.limit ? parseInt(req.body.limit) : 10;
  let skip = req.body.skip ? parseInt(req.body.skip) : 0;

  try {
    const blogs = await Blog.find({})
      .populate("categories", "_id name slug")
      .populate("tags", "_id name slug")
      .populate("postedBy", "_id name username profile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "_id title slug excerpt categories tags postedBy createdAt updatedAt"
      );

    const categories = await Category.find({});
    const tags = await Tag.find({});

    res.json({ blogs, categories, tags, size: blogs.length });
  } catch (err) {
    res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.read = async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  try {
    const blog = await Blog.findOne({ slug })
      .populate("categories", "_id name slug")
      .populate("tags", "_id name slug")
      .populate("postedBy", "_id name username")
      .select(
        "_id title body slug mtitle mdesc categories tags postedBy createdAt updatedAt"
      );

    res.json(blog);
  } catch (err) {
    res.status(400).json({
      error: errorHandler(err),
    });
  }
};
exports.remove = async (req, res) => {
  const slug = req.params.slug.toLowerCase();

  try {
    const blog = await Blog.findOneAndRemove({
      slug,
    });

    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.update = async (req, res) => {
  const slug = req.params.slug.toLowerCase();

  try {
    const oldBlog = await Blog.findOne({ slug });

    const form = new formidable.IncomingForm();
    form.keepExtensions = true;
    // console.log(form);
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    // const { title, body, categories, tags } = fields;
    let slugBefoforeMerge = oldBlog.slug;
    // oldBlog = _.merge(oldBlog.toObject(), fields);
    oldBlog.set(fields);
    oldBlog.slug = slugBefoforeMerge;

    const { body, desc, categories, tags } = fields;

    if (body) {
      oldBlog.excerpt = smartTrim(body, 320, " ", "...");
      oldBlog.desc = stripHtml(body.substring(0, 160));
    }

    if (categories) {
      oldBlog.categories = categories.split(",");
    }

    if (tags) {
      oldBlog.tags = tags.split(",");
    }

    if (files.photo) {
      if (files.photo.size > 10000000) {
        return res.status(400).json({
          error: "Images should be less than 1mb in size",
        });
      }
      oldBlog.photo.data = fs.readFileSync(files.photo.filepath);
      oldBlog.photo.contentType = files.photo.mimetype;
    }
    const result = await oldBlog.save();
    console.log("work");
    // result.photo = undefined;

    res.json(result);
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.photo = async (req, res) => {
  const slug = req.params.slug.toLowerCase();

  try {
    const blog = await Blog.findOne({ slug }).select("photo");

    res.set("Content-Type", blog.photo.contentType);
    console.log(blog.photo.contentType);
    return res.send(blog.photo.data);
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.listRelated = async (req, res) => {
  let limit = req.body.limit ? parseInt(req.body.limit) : 3;
  const { _id, categories } = req.body;

  console.log("ID", _id, "categories", categories);

  try {
    const blogs = await Blog.find({
      _id: { $ne: _id },
      categories: { $in: categories },
    })
      .limit(limit)
      .populate("postedBy", "_id name username profile")
      .select("title slug excerpt postedBy createdAt updatedAt");

    console.log("works");
    console.log(blogs);
    res.json(blogs);
  } catch (err) {
    res.status(400).json({
      error: "Blogs not found",
    });
  }
};

exports.listSearch = async (req, res) => {
  const { search } = req.query;
  try {
    if (search) {
      const blogs = await Blog.find({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { body: { $regex: search, $options: "i" } },
        ],
      }).select("-photo -body");

      res.json(blogs);
    }
  } catch (err) {
    res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.listByUser = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });

    let userId = user._id;

    let blogs = await Blog.find({ postedBy: userId })
      .populate("categories", "_id name slug")
      .populate("tags", "_id name slug")
      .populate("postedBy", "_id name username")
      .select("_id title slug postedBy createdAt updatedAt");

    res.json(blogs);
  } catch (err) {
    return res.status(400).json({ error: errorHandler(err) });
  }
};

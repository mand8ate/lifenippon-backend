const User = require("../models/user");
const Blog = require("../models/blog");
const shortId = require("shortid");
const jwt = require("jsonwebtoken");
const { expressjwt } = require("express-jwt");
const { errorHandler } = require("../helpers/dbError");
const { sendEmailWithNodemailer } = require("../helpers/email");
const _ = require("lodash");
const { OAuth2Client } = require("google-auth-library");

exports.preSignup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      return res.status(400).json({
        error: "Email is taken",
      });
    }

    const token = jwt.sign(
      { name, email, password },
      process.env.JWT_ACCOUNT_ACTIVATION,
      {
        expiresIn: "10m",
      }
    );

    // email
    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Account activation link",
      html: `
      <p>Please use the following link to activate your account</p>
      <p>${process.env.CLIENT_URL}/auth/account/activate/${token}</p>
      <hr />
      <p>This email may contain sensitive information</p>
      <p>https://lifenippon.com</p>
  `,
    };

    return sendEmailWithNodemailer(req, res, emailData);
  } catch (err) {
    return res.status(400).json({
      error: "Something went wrong",
    });
  }
};

// exports.signup = async (req, res) => {
//   try {
//     const user = await User.findOne({ email: req.body.email }).exec();

//     if (user) {
//       return res.status(400).json({
//         error: "Email is taken",
//       });
//     }

//     const { name, email, password } = req.body;
//     let username = shortId.generate();
//     let profile = `${process.env.CLIENT_URL}/profile/${username}`;

//     let newUser = new User({ name, email, password, profile, username });

//     try {
//       const success = await newUser.save();
//       res.json({
//         user: success,
//       });
//     } catch (err) {
//       return res.status(400).json({
//         error: err,
//       });
//     }
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       error: "An error occurred while looking up the user",
//     });
//   }
// };

exports.signup = async (req, res) => {
  console.log("reached");
  const token = req.body.token;
  try {
    if (token) {
      jwt.verify(
        token,
        process.env.JWT_ACCOUNT_ACTIVATION,
        async (err, decoded) => {
          if (err) {
            if (err.name === "TokenExpiredError") {
              return res.status(401).json({
                error: "Expired link. Try again.",
              });
            } else {
              return res.status(400).json({
                error: err,
              });
            }
          }

          const { name, email, password } = jwt.decode(token);

          let username = shortId.generate();
          let profile = `${process.env.CLIENT_URL}/profile/${username}`;

          const user = await new User({
            name,
            email,
            password,
            profile,
            username,
          }).save();

          return res.json({
            message: "Signup succes! Please signin",
          });
        }
      );
    }
  } catch (err) {
    return res.status(400).json({
      error: "Something went wrong. Try again",
    });
  }
};

exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        error: "User with that email does not exist. Please Signup",
      });
    }

    if (!user.authenticate(password)) {
      return res.status(400).json({
        error: "Email and password do not match.",
      });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("token", token, { expiresIn: "1d", httpOnly: true });

    const { _id, username, name, role } = user;

    return res.json({
      token,
      user: { _id, username, name, email, role },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error.");
  }
};

exports.signout = (req, res) => {
  res.clearCookie("token");
  res.json({
    message: "Signout success",
  });
};

exports.requireSignin = expressjwt({
  secret: process.env.JWT_SECRET,
  algorithms: ["HS256"],
  userProperty: "auth",
});

exports.authMiddleware = async (req, res, next) => {
  const authUserId = req.auth._id;

  const user = await User.findById({ _id: authUserId });

  if (!user) {
    return res.status(400).json({
      error: "User not found",
    });
  }
  req.profile = user;
  next();
};

exports.adminMiddleware = async (req, res, next) => {
  const adminUserId = req.auth._id;

  const user = await User.findById({ _id: adminUserId });
  if (!user) {
    return res.status(400).json({
      error: "User not found",
    });
  }

  if (user.role !== 1) {
    return res.status(400).json({
      error: "Admin resource. Access denied",
    });
  }

  req.profile = user;
  next();
};

exports.canUpdateAndDelete = async (req, res, next) => {
  const slug = req.params.slug.toLowerCase();

  try {
    const blog = await Blog.findOne({ slug });

    let authorizedUser =
      blog.postedBy._id.toString() === req.profile._id.toString();

    if (!authorizedUser) {
      return res.status(400).json({
        error: "You are not authorized",
      });
    }

    next();
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        error: "User with that email does not exist",
      });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_RESET_PASSWORD, {
      expiresIn: "10m",
    });

    // email
    const emailData = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Password reset link",
      html: `
          <p>Please use the following link to reset your password</p>
          <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
          <hr />
          <p>This email may contain sensitive information</p>
          <p>https://lifenippon.com</p>
      `,
    };

    // Update the user object and save it
    user.resetPasswordLink = token;
    await user.save();

    // Send the email
    return sendEmailWithNodemailer(req, res, emailData);
  } catch (err) {
    return res.status(400).json({
      error: errorHandler(err),
    });
  }
};

exports.resetPassword = async (req, res) => {
  const { resetPasswordLink, newPassword } = req.body;

  if (resetPasswordLink) {
    try {
      jwt.verify(
        resetPasswordLink,
        process.env.JWT_RESET_PASSWORD,
        async (err, decoded) => {
          if (err) {
            if (err.name === "TokenExpiredError") {
              return res.status(401).json({
                error: "Expired link. Try again.",
              });
            } else {
              return res.status(400).json({
                error: err,
              });
            }
          }

          const user = await User.findOne({ resetPasswordLink });

          if (!user) {
            return res.status(401).json({
              error: "Something went wrong. Try later",
            });
          }

          const updatedFields = {
            password: newPassword,
            resetPasswordLink: "",
          };

          user.set(updatedFields);
          await user.save();

          res.json({
            message: `Great! Now you can login with your new password`,
          });
        }
      );
    } catch (err) {
      return res.status(400).json({
        error: errorHandler(err),
      });
    }
  }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
exports.googleLogin = async (req, res) => {
  const idToken = req.body.credential;

  try {
    client
      .verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID })
      .then(async (response) => {
        const { email_verified, email } = response.payload;

        if (email_verified) {
          const user = await User.findOne({ email });

          if (user) {
            const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
              expiresIn: "1d",
            });

            res.cookie("token", token, { expiresIn: "1d" });

            const { _id, email, name, role, username } = user;

            return res.json({
              token,
              user: { _id, email, name, role, username },
            });
          } else {
            const {
              name: newUserName,
              email: newUserEmail,
              jti,
            } = response.payload;

            let newUsername = shortId.generate();
            let profile = `${process.env.CLIENT_URL}/profile/${newUsername}`;
            let password = jti + process.env.JWT_SECRET;

            const newUser = await new User({
              name: newUserName,
              email: newUserEmail,
              profile,
              username: newUsername,
              password,
            }).save();

            const token = jwt.sign(
              { _id: newUser._id },
              process.env.JWT_SECRET,
              {
                expiresIn: "1d",
              }
            );

            res.cookie("token", token, { expiresIn: "1d" });

            const { _id, email, name, role, username } = newUser;

            return res.json({
              token,
              user: { _id, email, name, role, username },
            });
          }
        }
      });
  } catch (err) {
    return res.status(400).json({
      error: err,
    });
  }
};

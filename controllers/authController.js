const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { config } = require("../config/config");

const makeToken = (user) => {
  return jwt.sign({ userId: user._id, name: user.name, role: user.role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
};

// Is the person calling register a logged-in manager?
const callerIsManager = (req) => {
  try {
    const token = (req.headers.authorization || "").split(" ")[1];
    return jwt.verify(token, config.JWT_SECRET).role === "manager";
  } catch (error) {
    return false;
  }
};

// Rules for roles:
//  - the very first user becomes manager (someone has to create bins)
//  - after that, only a manager can create another manager
//  - everyone else is staff
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.valid.body;
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const userCount = await User.countDocuments();
    let finalRole = "staff";
    if (userCount === 0) {
      finalRole = "manager";
    } else if (role === "manager") {
      if (!callerIsManager(req)) {
        return res.status(403).json({ message: "Only a manager can create a manager" });
      }
      finalRole = "manager";
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashedPassword, role: finalRole });
    res.status(201).json({
      message: "User registered successfully",
      token: makeToken(user),
      user,
    });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.valid.body;
    const user = await User.findOne({ email }).select("+password");
    // Same message for "wrong email" and "wrong password",
    // so nobody can find out which emails are registered.
    const isMatch = user && user.password && (await bcrypt.compare(password, user.password));
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({
      message: "Login successful",
      token: makeToken(user),
      user,
    });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

// The mobile app signs in with Firebase and sends us the Firebase ID token.
// We check it, find or create the user, and give back OUR token.
const firebaseLogin = async (req, res, next) => {
  try {
    let decoded;
    try {
      decoded = await req.app.locals.verifyFirebaseToken(req.valid.body.idToken);
    } catch (error) {
      return res.status(401).json({ message: "Invalid Firebase token" });
    }
    if (!decoded.email) {
      return res.status(401).json({ message: "Firebase account has no email" });
    }

    let user = await User.findOne({ $or: [{ firebaseUid: decoded.uid }, { email: decoded.email }] });
    if (!user) {
      user = await User.create({
        name: decoded.name || decoded.email.split("@")[0],
        email: decoded.email,
        firebaseUid: decoded.uid,
        role: "staff",
      });
    } else if (!user.firebaseUid) {
      user.firebaseUid = decoded.uid;
      await user.save();
    }
    res.json({ message: "Login successful", token: makeToken(user), user });
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json(user);
  } catch (error) {
    next(error); // the error middleware in app.js sends the response
  }
};

module.exports = { register, login, firebaseLogin, getMe };

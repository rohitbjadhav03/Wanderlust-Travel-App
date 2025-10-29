// ---------------- ENVIRONMENT SETUP ----------------
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// ---------------- IMPORTS ----------------
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const ExpressError = require("./utils/ExpressError");
const User = require("./models/user");

// Routers
const listingRouter = require("./routes/listing");
const reviewRouter = require("./routes/review");
const userRouter = require("./routes/user");

// ---------------- DATABASE CONNECTION ----------------
const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function main() {
  try {
    await mongoose.connect(dbUrl);
    console.log("✅ Connected to MongoDB successfully!");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}
main();

// ---------------- APP CONFIGURATION ----------------
const app = express();
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// ---------------- SESSION CONFIGURATION ----------------
const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET || "mysecret",
  },
  touchAfter: 24 * 3600, // 24 hours
});

store.on("error", (err) => {
  console.log("⚠️ Mongo Session Store Error:", err);
});

const sessionOptions = {
  store,
  secret: process.env.SECRET || "mysecret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// ---------------- PASSPORT CONFIGURATION ----------------
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ---------------- FLASH & CURRENT USER ----------------
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// ---------------- ROUTES ----------------
app.get("/", (req, res) => {
  res.redirect("/listings");
});

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// ---------------- ERROR HANDLING ----------------
// ✅ FIXED: use "*" instead of "/*splat" for Node 22 compatibility
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong!" } = err;
  console.error("⚠️ Error:", err.stack || message);
  res.status(statusCode).render("error.ejs", { message });
});

// ---------------- SERVER ----------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (${process.env.NODE_ENV || "development"})`);
});

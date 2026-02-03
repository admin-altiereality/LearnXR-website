const express = require("express");
const router = express.Router();
const auth = require("../autorisation/auth");

router.get("/", (req, res) => {
  res.render("home");
});
router.get("/privacy", (req, res) => {
  res.render("privacy.hbs");
});
router.get("/aerospace", (req, res) => {
  res.render("aerospace.hbs");
});
router.get("/XRtouch", (req, res) => {
  res.render("XRtouch.hbs");
});
router.get("/architecture", (req, res) => {
  res.render("architecture.hbs");
});
router.get("/automotive", (req, res) => {
  res.render("automotive.hbs");
});
router.get("/career", (req, res) => {
  res.render("career.hbs");
});
router.get("/blog", (req, res) => {
  res.render("blog.hbs");
});
router.get("/blog-single", (req, res) => {
  res.render("blog-single.hbs");
});
router.get("/education", (req, res) => {
  res.render("education.hbs");
});
router.get("/medical", (req, res) => {
  res.render("medical.hbs");
});
router.get("/defence", (req, res) => {
  res.render("defence.hbs");
});
router.get("/industrial-machinery", (req, res) => {
  res.render("industrial-machinery.hbs");
});
router.get("/gaming", (req, res) => {
  res.render("gaming.hbs");
});
router.get("/portfolio-details", (req, res) => {
  res.render("portfolio-details.hbs");
});
router.get("/termsandconditions", (req, res) => {
  res.render("termsandconditions.hbs");
});
router.get("/XRtouch", (req, res) => {
  res.render("XRtouch.hbs");
});
router.get("/reliconnecttermsandconditions", (req, res) => {
  res.render("reliconnecttermsandconditions.hbs");
});
router.get("/forms/contact.php", (req, res) => {
  res.render("contact.php");
});
router.get("/creditsandlicenses", (req, res) => {
  res.render("creditsandlicenses.hbs");
});
router.get("/forms/contact.php", (req, res) => {
  res.render("contact.php");
});
router.get("/reliconnectprivacy", (req, res) => {
  res.render("reliconnectprivacy.hbs");
});

router.get("/contactus", auth, (req, res) => {
  if (req.user) {
    res.render("contactus", {
      isnotloggedin: false,
      user: req.user,
    });
  } else {
    res.render("contactus", {
      isnotloggedin: true,
    });
  }
});

router.get("/logout", (req, res) => {
  res.clearCookie("jwt");
  res.clearCookie("google-token"); //to logout we will remove the cookie so no authentication can be done now hence can't access private pages;

  res.redirect("/");
});
module.exports = router;

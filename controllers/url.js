const { nanoid } = require("nanoid");
const URL = require("../models/url");

async function handleGenerateNewShortURL(req, res) {
  const body = req.body;
  if (!body.url) return res.status(400).json({ error: "url is required" });

  const allurls = await URL.find({ createdBy: req.user._id });

  let shortID = body.customAlias ? body.customAlias.trim() : "";

  if (shortID) {
    const existing = await URL.findOne({ shortId: shortID });
    if (existing) {
      return res.render("home", {
        error: `Custom alias "${shortID}" is already taken. Please try another one.`,
        urls: allurls,
      });
    }
  } else {
    shortID = nanoid(8);
  }

  await URL.create({
    shortId: shortID,
    redirectURL: body.url,
    visitHistory: [],
    createdBy: req.user._id,
  });

  const updatedUrls = await URL.find({ createdBy: req.user._id });

  return res.render("home", {
    id: shortID,
    urls: updatedUrls,
  });
}

async function handleGetAnalytics(req, res) {
  const shortId = req.params.shortId;
  const result = await URL.findOne({ shortId });
  return res.json({
    totalClicks: result.visitHistory.length,
    analytics: result.visitHistory,
  });
}

module.exports = {
  handleGenerateNewShortURL,
  handleGetAnalytics,
};

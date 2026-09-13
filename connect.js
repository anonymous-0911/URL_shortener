const mongoose = require("mongoose");

let cached = null;

async function connectToMongoDB(url) {
  if (cached) return cached;
  cached = await mongoose.connect(url);
  return cached;
}

module.exports = {
  connectToMongoDB,
};

const mongoose = require("mongoose");

let cached = null;

async function connectToMongoDB(url) {
  if (cached && mongoose.connection.readyState === 1) return cached;
  cached = await mongoose.connect(url, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });
  return cached;
}

module.exports = {
  connectToMongoDB,
};

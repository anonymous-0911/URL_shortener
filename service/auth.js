const Session = require("../models/session");
const User = require("../models/user");

async function setUser(sessionId, user) {
  await Session.create({ sessionId, userId: user._id });
}

async function getUser(sessionId) {
  if (!sessionId) return null;
  const session = await Session.findOne({ sessionId });
  if (!session) return null;
  const user = await User.findById(session.userId);
  return user;
}

module.exports = {
  setUser,
  getUser,
};

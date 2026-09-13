const Session = require("../models/session");

async function setUser(sessionId, user) {
  await Session.create({ sessionId, userId: user._id });
}

async function getUser(sessionId) {
  if (!sessionId) return null;
  const session = await Session.findOne({ sessionId }).populate("userId").lean();
  if (!session) return null;
  return session.userId || null;
}

async function deleteSession(sessionId) {
  if (!sessionId) return;
  await Session.deleteOne({ sessionId });
}

module.exports = {
  setUser,
  getUser,
  deleteSession,
};

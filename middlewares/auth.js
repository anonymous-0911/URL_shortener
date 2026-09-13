const { getUser } = require("../service/auth");
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	ipv6Subnet: 56, 
  handler: (req, res) => {
    const resetMs = req.rateLimit.resetTime ? req.rateLimit.resetTime.getTime() : Date.now() + 15 * 60 * 1000;
    const retryAfterSeconds = Math.max(0, Math.ceil((resetMs - Date.now()) / 1000));
    res.status(429).json({
      error: "Too many requests",
      retryAfterSeconds: retryAfterSeconds
    });
  }
 
})

async function restrictToLoggedinUserOnly(req, res, next) {
  const userUid = req.cookies?.uid;

  if (!userUid) return res.redirect("/login");
  const user = await getUser(userUid);

  if (!user) return res.redirect("/login");

  req.user = user;
  next();
}

async function checkAuth(req, res, next) {
  const userUid = req.cookies?.uid;

  const user = await getUser(userUid);

  req.user = user;
  next();
}

module.exports = {
  restrictToLoggedinUserOnly,
  checkAuth,
  limiter
};

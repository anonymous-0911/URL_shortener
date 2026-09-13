const { v4: uuidv4 } = require("uuid");
const User = require("../models/user");
const { setUser, deleteSession } = require("../service/auth");

async function handleUserSignup(req, res) {
  const { name, email, password } = req.body;
  try {
    const user = await User.create({
      name,
      email,
      password,
    });
    const sessionId = uuidv4();
    await setUser(sessionId, user);
    res.cookie("uid", sessionId);
    return res.redirect("/");
  } catch (err) {
    return res.render("signup", {
      error: "Email already exists or invalid signup data",
    });
  }
}

async function handleUserLogin(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });

  if (!user)
    return res.render("login", {
      error: "Invalid Username or Password",
    });

  const sessionId = uuidv4();
  await setUser(sessionId, user);
  res.cookie("uid", sessionId);
  return res.redirect("/");
}

async function handleUserLogout(req, res) {
  const sessionId = req.cookies?.uid;
  if (sessionId) {
    await deleteSession(sessionId);
    res.clearCookie("uid");
  }
  return res.redirect("/login");
}

module.exports = {
  handleUserSignup,
  handleUserLogin,
  handleUserLogout,
};

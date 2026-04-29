const bcrypt = require("bcryptjs");

const DEV_EMAIL = "dev@quizizz.local";
const DEV_PASSWORD = "devpassword123";

async function seedDevUser() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const User = require("../modules/participants/User");
  const existing = await User.findOne({ email: DEV_EMAIL });

  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  await User.create({
    name: "Dev Admin",
    email: DEV_EMAIL,
    role: "admin",
    passwordHash,
    authProvider: "local",
    isVerified: true,
    avatar: "",
  });

  console.log(
    `[Dev Seed] Dev admin ready — email: ${DEV_EMAIL}  password: ${DEV_PASSWORD}`
  );
}

module.exports = { seedDevUser };

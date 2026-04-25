const User = require("./User");

async function createAdmin(req, res, next) {
  try {
    const { name, email, avatar } = req.body;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const user = await User.create({
      name,
      email,
      avatar,
      role: "admin",
    });

    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const query = {};

    if (req.query.role) {
      query.role = req.query.role;
    }

    const users = await User.find(query).sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (error) {
    return next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createAdmin,
  listUsers,
  getUserById,
};

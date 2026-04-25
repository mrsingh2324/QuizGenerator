const express = require("express");

const { createAdmin, getUserById, listUsers } = require("./userController");

const router = express.Router();

router.get("/", listUsers);
router.post("/admins", createAdmin);
router.get("/:userId", getUserById);

module.exports = router;

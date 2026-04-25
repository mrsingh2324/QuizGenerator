const express = require("express");

const uploadDocument = require("./documentUploadMiddleware");
const {
  createDocument,
  getDocumentById,
  listDocuments,
  uploadDocumentAndAnalyze,
} = require("./documentController");

const router = express.Router();

router.get("/", listDocuments);
router.post("/", createDocument);
router.post("/upload", uploadDocument.single("file"), uploadDocumentAndAnalyze);
router.get("/:documentId", getDocumentById);

module.exports = router;

const { analyzeDocumentText } = require("../../services/aiService");
const { extractTextFromFile } = require("./textExtractionService");
const { validateFileBytes } = require("./fileValidator");
const UploadedDocument = require("./UploadedDocument");

async function createDocument(req, res, next) {
  try {
    const { admin, title, fileName, mimeType, sourceType, rawText, status, containsQuestions } =
      req.body;

    if (!admin || !title || !rawText) {
      return res.status(400).json({
        message: "admin, title, and rawText are required",
      });
    }

    const document = await UploadedDocument.create({
      admin,
      title,
      fileName,
      mimeType,
      sourceType,
      rawText,
      status,
      containsQuestions,
    });

    return res.status(201).json(document);
  } catch (error) {
    return next(error);
  }
}

async function uploadDocumentAndAnalyze(req, res, next) {
  try {
    const { admin, title, difficulty, count } = req.body;

    if (!admin || !title) {
      return res.status(400).json({
        message: "admin and title are required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "file is required",
      });
    }

    const fileCheck = validateFileBytes(req.file.buffer, req.file.mimetype);
    if (!fileCheck.valid) {
      return res.status(400).json({ message: fileCheck.reason });
    }

    if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
      return res.status(400).json({
        message: "difficulty must be one of: easy, medium, hard",
      });
    }

    if (count !== undefined) {
      const parsedCount = Number(count);

      if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 50) {
        return res.status(400).json({
          message: "count must be an integer between 1 and 50",
        });
      }
    }

    console.log("[Document Upload] Extracting text from file:", {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    const extractedText = await extractTextFromFile(req.file);

    if (!extractedText) {
      console.log("[Document Upload] No text could be extracted");
      return res.status(400).json({
        message: "No readable text could be extracted from the file",
      });
    }

    console.log("[Document Upload] Text extracted successfully:", {
      textLength: extractedText.length,
      fileName: req.file.originalname,
    });

    const document = await UploadedDocument.create({
      admin,
      title,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sourceType: "upload",
      rawText: extractedText,
      status: "processed",
    });

    console.log("[Document Upload] Document created, sending to AI analysis...", {
      documentId: document._id,
      title,
    });

    try {
      const aiResult = await analyzeDocumentText({
        text: extractedText,
        difficulty,
        count: count !== undefined ? Number(count) : undefined,
      });

      document.containsQuestions = aiResult.containsQuestions;
      document.status = "processed";
      await document.save();

      console.log("[Document Upload] AI analysis complete:", {
        documentId: document._id,
        containsQuestions: aiResult.containsQuestions,
        action: aiResult.action,
      });

      return res.status(201).json({
        document,
        aiResult,
      });
    } catch (error) {
      console.error("[Document Upload] AI analysis failed:", {
        documentId: document._id,
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });

      document.status = "failed";
      await document.save();

      return res.status(error.statusCode || 502).json({
        document,
        aiResult: {
          action: "error",
          message: error.message,
          details: error.details || null,
          provider: error.provider || null,
          code: error.code || null,
        },
      });
    }
  } catch (error) {
    console.error("[Document Upload] Unexpected error:", {
      error: error.message,
      stack: error.stack,
    });
    return next(error);
  }
}

async function listDocuments(_req, res, next) {
  try {
    const documents = await UploadedDocument.find()
      .populate("admin", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json(documents);
  } catch (error) {
    return next(error);
  }
}

async function getDocumentById(req, res, next) {
  try {
    const document = await UploadedDocument.findById(req.params.documentId).populate(
      "admin",
      "name email"
    );

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.status(200).json(document);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createDocument,
  uploadDocumentAndAnalyze,
  listDocuments,
  getDocumentById,
};

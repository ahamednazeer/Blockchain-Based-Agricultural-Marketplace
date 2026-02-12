import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { auth, requireRole } from "../middleware/auth.js";

const router = express.Router();

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext && ext.length <= 10 ? ext : "";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype?.startsWith("image/") || file.mimetype === "application/pdf") {
    return cb(null, true);
  }
  return cb(new Error("Unsupported file type"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post(
  "/",
  auth,
  requireRole("FARMER"),
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const publicPath = `/uploads/${req.file.filename}`;
    res.status(201).json({
      url: publicPath,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mime: req.file.mimetype,
    });
  }
);

router.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || "Upload failed" });
  }
  next();
});

export default router;

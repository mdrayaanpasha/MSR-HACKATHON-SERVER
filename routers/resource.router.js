// routes/resource.routes.js
import { Router } from "express";
import multer from "multer";
import resourceController from "../controller/resource.controller.js";
import { authMiddleware } from "../middleware/auth.js";

const resourceRouter = Router();

// Configure Multer to hold file in memory (RAM) for ImageKit upload
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/resources/upload
resourceRouter.post(
  "/upload", 
  authMiddleware,      // 1. Check Token
  upload.single("file"), // 2. Parse File
  resourceController.uploadResource // 3. Execute Logic
);


resourceRouter.get(
  "/:id", 
  authMiddleware, // Required to get req.user for personalization
  resourceController.getResourceById
);


resourceRouter.post(
  "/", 
  authMiddleware, // Required to get req.user for personalization
  resourceController.getAllResources
);

resourceRouter.put(
  "/:id", 
  authMiddleware, 
  resourceController.updateResource
);









export default resourceRouter;
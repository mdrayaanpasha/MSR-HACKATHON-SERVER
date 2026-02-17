import AIController from "../controller/AI.controller.js";
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
const aiRouter = Router();


aiRouter.post("/chat",authMiddleware,AIController.askNexus);

export default aiRouter;
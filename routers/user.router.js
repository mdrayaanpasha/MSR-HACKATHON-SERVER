import { Router } from "express";
import userController from "../controller/user.controller.js";
import { authMiddleware } from "../middleware/auth.js";// Required for protection

const userRouter = Router();

// ==========================================
// 🔓 PUBLIC ROUTES (No Token Required)
// ==========================================

// Register a new user
// POST /api/users/register
userRouter.post("/register", userController.register);

// Login user
// POST /api/users/login
userRouter.post("/login", userController.login);


// ==========================================
// 🔒 PROTECTED ROUTES (Token Required)
// ==========================================

// Get current user profile
// GET /api/users/profile
userRouter.get("/profile", authMiddleware, userController.getProfile);

// Update profile details
// PUT /api/users/profile
userRouter.put("/profile", authMiddleware, userController.updateProfile);

// Delete account
// DELETE /api/users/profile
userRouter.delete("/profile", authMiddleware, userController.deleteAccount);

export default userRouter;
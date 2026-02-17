import { Router } from "express";
import reviewController from "../controller/ratings.controller.js"
import { authMiddleware } from "../middleware/auth.js";

const reviewRouter = Router();

// ==========================================
// 1. Add a Review (Protected)
// POST /api/reviews/:resourceId
// ==========================================
reviewRouter.post(
  "/:resourceId", 
  authMiddleware, 
  reviewController.addReview
);

// ==========================================
// 2. Get Reviews (Public or Protected)
// GET /api/reviews/:resourceId
// ==========================================
reviewRouter.get(
  "/:resourceId", 
  reviewController.getReviews
);

// ==========================================
// 3. Delete Review (Protected)
// DELETE /api/reviews/entry/:reviewId
// ==========================================
reviewRouter.delete(
  "/entry/:reviewId", 
  authMiddleware, 
  reviewController.deleteReview
);

export default reviewRouter;
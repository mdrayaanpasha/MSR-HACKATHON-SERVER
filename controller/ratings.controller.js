import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class reviewController {

  // 1. ADD REVIEW
  // POST /api/resources/:resourceId/reviews
  async addReview(req, res) {
    try {
      const { resourceId } = req.params;
      const { rating, comment } = req.body;
      const userId = req.user?.id; // From Auth Middleware

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Basic Validation
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      // Create Review
      const newReview = await prisma.review.create({
        data: {
          rating: parseInt(rating),
          comment: comment || "",
          userId,
          resourceId
        },
        include: {
          user: { select: { name: true, avatarUrl: true } } // Return user info immediately for UI
        }
      });

      return res.status(201).json({
        message: "Review added successfully",
        review: newReview
      });

    } catch (error) {
      // Prisma Error Code P2002 = Unique Constraint Violation
      if (error.code === 'P2002') {
        return res.status(409).json({ 
          message: "You have already reviewed this resource. You can edit your existing review." 
        });
      }
      
      console.error("Add Review Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }


  // 4. UPDATE REVIEW
  // PUT /api/reviews/:reviewId
  async updateReview(req, res) {
    try {
      const { reviewId } = req.params;
      const { rating, comment } = req.body;
      const userId = req.user.id; // From Auth Middleware

      // 1. Verify existence and ownership
      const existingReview = await prisma.review.findUnique({
        where: { id: reviewId }
      });

      if (!existingReview) {
        return res.status(404).json({ message: "Review not found." });
      }

      if (existingReview.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You can only edit your own reviews." });
      }

      // 2. Validate new rating if provided
      if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({ message: "Rating must be between 1 and 5." });
      }

      // 3. Execute update
      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: {
          rating: rating ? parseInt(rating) : undefined,
          comment: comment !== undefined ? comment : undefined,
        },
        include: {
          user: { select: { name: true, avatarUrl: true } }
        }
      });

      return res.status(200).json({
        message: "Review updated successfully.",
        review: updatedReview
      });

    } catch (error) {
      console.error("Update Review Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // 2. GET REVIEWS FOR A RESOURCE
  // GET /api/resources/:resourceId/reviews
  async getReviews(req, res) {
    try {
      const { resourceId } = req.params;

      // A. Fetch all reviews
      const reviews = await prisma.review.findMany({
        where: { resourceId },
        include: {
          user: { select: { name: true, avatarUrl: true, college: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // B. Calculate Average Rating
      const aggregation = await prisma.review.aggregate({
        _avg: { rating: true },
        _count: { rating: true },
        where: { resourceId }
      });

      return res.status(200).json({
        averageRating: aggregation._avg.rating?.toFixed(1) || 0, // e.g., "4.5"
        totalReviews: aggregation._count.rating,
        reviews: reviews
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error fetching reviews" });
    }
  }

  // GET /api/reviews/mine
  // Fetches all reviews written by the authenticated user (via token)
  async getMyReviews(req, res) {
    try {
      // The ID is extracted from the decoded JWT by your authMiddleware
      const userId = req.user.id; 

      const reviews = await prisma.review.findMany({
        where: { userId: userId },
        include: {
          resource: {
            select: {
              id: true,
              title: true,
              subject: true,
              type: true,
              fileUrl: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return res.status(200).json({
        message: "Personal review history synchronized.",
        count: reviews.length,
        data: reviews
      });

    } catch (error) {
      console.error("Fetch My Reviews Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }

  // 3. DELETE REVIEW (Owner Only)
  // DELETE /api/reviews/:reviewId
  async deleteReview(req, res) {
    try {
      const { reviewId } = req.params;
      const userId = req.user.id;

      // Check ownership
      const review = await prisma.review.findUnique({ where: { id: reviewId } });
      
      if (!review) return res.status(404).json({ message: "Review not found" });
      if (review.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own reviews" });
      }

      await prisma.review.delete({ where: { id: reviewId } });

      return res.status(200).json({ message: "Review deleted" });

    } catch (error) {
      return res.status(500).json({ message: "Delete failed" });
    }
  }
}

export default new reviewController();
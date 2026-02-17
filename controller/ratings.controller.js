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
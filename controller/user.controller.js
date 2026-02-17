


import { PrismaClient } from '@prisma/client';
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hackathon_key';

class UserController {

  // 1. REGISTER USER
  // POST /api/auth/register
  async register(req, res) {
    try {
      const { name, email, password, college, branch, semester, bio, type, goal } = req.body;

      // Basic Validation
      if (!name || !email || !password || !college || !branch || !semester) {
        return res.status(400).json({ error: "All mandatory fields are required" });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash Password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create User
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          college,
          branch,
          semester: parseInt(semester), // Ensure integer type for DB
          bio: bio || "",
          type,
          goal
        }
      });

      // Generate JWT Token
      const token = jwt.sign(
        { id: newUser.id, college: newUser.college }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );

      // Return success (exclude password)
      const { password: _, ...userData } = newUser;
      
      res.status(201).json({
        message: "Registration successful",
        token,
        user: userData
      });

    } catch (error) {
      console.error("Register Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // 2. LOGIN USER
  // POST /api/auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      // Check Password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      // Generate Token (Payload includes college for quick access checks later)
      const token = jwt.sign(
        { id: user.id, college: user.college }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );

      // Return success
      const { password: _, ...userData } = user;
      
      res.status(200).json({
        message: "Login successful",
        token,
        user: userData
      });

    } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // 3. GET PROFILE (Current User)
  // GET /api/users/profile
  // Requires Middleware to attach req.user
  async getProfile(req, res) {
    try {
      // req.user.id comes from your auth middleware
      const userId = req.user.id; 

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          uploads: true, // Optional: return their uploads too
          reviews: true  // Optional: return their reviews
        }
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      const { password: _, ...userData } = user;
      res.status(200).json(userData);

    } catch (error) {
      res.status(500).json({ error: "Error fetching profile" });
    }
  }

  // 4. UPDATE PROFILE
  // PUT /api/users/profile
  // 4. UPDATE PROFILE
  // PUT /api/users/profile
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      // Added 'type' and 'goal' to the destructured body
      const { name, branch, semester, bio, avatarUrl, type, goal } = req.body;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          branch,
          semester: semester ? parseInt(semester) : undefined,
          bio,
          avatarUrl,
          type, // Update Archetype
          goal  // Update Target Metric
        }
      });

      const { password: _, ...userData } = updatedUser;
      res.status(200).json({ message: "Profile updated", user: userData });

    } catch (error) {
      console.error("Update Error:", error);
      res.status(500).json({ error: "Error updating profile" });
    }
  }
  // 5. DELETE ACCOUNT (Optional but good for CRUD completeness)
  // DELETE /api/users/profile
  async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      
      await prisma.user.delete({ where: { id: userId } });
      
      res.status(200).json({ message: "Account deleted successfully" });

    } catch (error) {
      res.status(500).json({ error: "Error deleting account" });
    }
  }

  // GET /api/users/dashboard
  // Returns full profile, contribution stats, and activity history
  async getUserDashboard(req, res) {
    try {
      const userId = req.user.id; // From Auth Middleware

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          // Fetch all resources they've uploaded
          uploads: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              subject: true,
              type: true,
              createdAt: true,
              privacy: true
            }
          },
          // Fetch their recent reviews
          reviews: {
            orderBy: { createdAt: 'desc' },
            include: {
              resource: {
                select: { title: true }
              }
            }
          },
          // Aggregates for the "Life" part of the UI
          _count: {
            select: {
              uploads: true,
              reviews: true
            }
          }
        }
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      // Exclude sensitive data
      const { password: _, ...userData } = user;

      res.status(200).json({
        ...userData,
        stats: {
          totalUploads: user._count.uploads,
          totalReviews: user._count.reviews,
          rank: user._count.uploads > 10 ? "ELITE" : "CONTRIBUTOR" // Visual label logic
        }
      });

    } catch (error) {
      console.error("Dashboard Error:", error);
      res.status(500).json({ error: "Error fetching dashboard data" });
    }
  }
}
export default new UserController();
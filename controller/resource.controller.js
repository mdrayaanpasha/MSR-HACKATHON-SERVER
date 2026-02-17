import { PrismaClient } from "@prisma/client";
import imagekit from "../config/imagekit.js"; 

const prisma = new PrismaClient();

class ResourceController {

  // POST /api/resources/upload
  async uploadResource(req, res) {
    try {
      // 1. AUTH CHECK: Matches your middleware
      // Middleware attaches 'decoded' to req.user
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Unauthorized." });
      }
      
      const userId = req.user.id; 
      // Optimization: You also have req.user.college from the token!

      // 2. Validate File
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
      }

      // 3. Destructure Body
      const { 
        title, 
        description, 
        subject, 
        semester, 
        branch, 
        yearBatch, 
        type, 
        tags, 
        privacy 
      } = req.body;

      console.log(req.body)

      // Validate Mandatory Fields
      if (!title || !subject || !semester || !branch || !type) {
        return res.status(400).json({ message: "Missing fields: title, subject, semester, branch, type" });
      }

      // 4. Upload to ImageKit
      const uploadResult = await imagekit.upload({
        file: req.file.buffer, 
        fileName: `res-${userId}-${Date.now()}-${req.file.originalname}`,
        folder: "/neural-breach-resources",
        useUniqueFileName: true,
      });

      // 5. Create Resource in DB
      const newResource = await prisma.resource.create({
        data: {
          title,
          description: description || "",
          fileUrl: uploadResult.url,
          subject,
          semester: parseInt(semester),
          branch,
          yearBatch: yearBatch || "2024",
          type, 
          tags: tags || "", 
          privacy: privacy || "PUBLIC", 
          
          // CRITICAL: Use the college from the token or user ID
          college: req.user.college, 
          
          uploaderId: userId
        }
      });

      return res.status(201).json({
        message: "Resource uploaded successfully",
        resource: newResource
      });

    } catch (error) {
      console.error("Upload Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // GET /api/resources (Feed)
  async getAllResources(req, res) {
    try {
      // If user is logged in, we get their college to show PRIVATE notes
      const userCollege = req.user ? req.user.college : null;

      const { subject, semester, type, search } = req.query;

      const whereClause = {
        AND: [
          // Search Logic
          search ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { tags: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } }
            ]
          } : {},
          
          // Filters
          subject ? { subject: { contains: subject, mode: 'insensitive' } } : {},
          semester ? { semester: parseInt(semester) } : {},
          type ? { type: type } : {},

          // PRIVACY LOGIC (Mandatory Feature)
          {
            OR: [
              { privacy: 'PUBLIC' }, 
              { 
                AND: [
                  { privacy: 'PRIVATE' },
                  { college: userCollege } // Only matches if colleges are same
                ]
              }
            ]
          }
        ]
      };

      const resources = await prisma.resource.findMany({
        where: whereClause,
        include: {
          uploader: { select: { name: true, college: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json(resources);

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching resources" });
    }
  }
}

export default new ResourceController();
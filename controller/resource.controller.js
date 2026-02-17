import { PrismaClient } from "@prisma/client";
import imagekit from "../config/imagekit.js"; 

const prisma = new PrismaClient();

class ResourceController {


    // GET /api/resources/:id
  async getResourceById(req, res) {
    try {
      const { id } = req.params;

      const resource = await prisma.resource.findUnique({
        where: { id: id },
        include: {
          // Get uploader details
          uploader: {
            select: {
              name: true,
              college: true,
              avatarUrl: true
            }
          },
          // Get reviews and the people who wrote them
          reviews: {
            include: {
              user: {
                select: {
                  name: true,
                  avatarUrl: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          // Count total downloads/views if you have those fields
          _count: {
            select: { reviews: true }
          }
        }
      });

      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      // Optional: Check privacy access here
      if (resource.privacy === 'PRIVATE') {
        if (!req.user || req.user.college !== resource.college) {
          return res.status(403).json({ error: "Access denied to this private resource." });
        }
      }

      return res.status(200).json(resource);

    } catch (error) {
      console.error("Fetch Resource Detail Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // POST /api/resources/upload
  // (Kept exactly as requested)
  async uploadResource(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Unauthorized." });
      }
      
      const userId = req.user.id; 

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
      }

      const { 
        title, description, subject, semester, 
        branch, yearBatch, type, tags, privacy 
      } = req.body;

      if (!title || !subject || !semester || !branch || !type) {
        return res.status(400).json({ message: "Missing fields" });
      }

      const uploadResult = await imagekit.upload({
        file: req.file.buffer, 
        fileName: `res-${userId}-${Date.now()}-${req.file.originalname}`,
        folder: "/neural-breach-resources",
        useUniqueFileName: true,
      });

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

 // GET /api/resources (Smart Ranked Feed)
  async getAllResources(req, res) {
    try {
      // 1. Read Query Params
      const { subject, semester, type, search } = req.body;
      
      // 2. Fetch User Context (if logged in)
      let user = null;
      if (req.user && req.user.id) {
        user = await prisma.user.findUnique({ where: { id: req.user.id } });
      }
      const userCollege = user ? user.college : null;

      // 3. Build the BROADEST Possible Database Query
      // We do NOT filter by user.branch/semester here to avoid hiding results
      const whereClause = {
        AND: [
          // Text Search (Title, Tags, or Subject)
          search ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { tags: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } }
            ]
          } : {},
          
          // Strict Filters (Only if user explicitly clicks a filter button)
          subject ? { subject: { contains: subject, mode: 'insensitive' } } : {},
          semester ? { semester: parseInt(semester) } : {}, 
          type ? { type: type } : {},

          // Privacy Logic (Mandatory)
          {
            OR: [
              { privacy: 'PUBLIC' }, 
              { 
                AND: [
                  { privacy: 'PRIVATE' },
                  { college: userCollege } // Safe even if user is null
                ]
              }
            ]
          }
        ]
      };

      // 4. Fetch All Matches
      let resources = await prisma.resource.findMany({
        where: whereClause,
        include: { uploader: { select: { name: true, college: true } } },
        orderBy: { createdAt: 'desc' } // Default: Newest first
      });

      // 5. SMART RANKING (The "Perfect Match" Logic)
      // If user is logged in, we REORDER the list in memory.
      // Top priority: Same Branch + Same Semester
      // Second priority: Same Branch
      // Last priority: Everything else
      if (user) {
        resources.sort((a, b) => {
          let scoreA = 0;
          let scoreB = 0;

          // Give points for matching the user's profile
          if (a.branch === user.branch) scoreA += 10;
          if (a.semester === user.semester) scoreA += 5;

          if (b.branch === user.branch) scoreB += 10;
          if (b.semester === user.semester) scoreB += 5;

          // Sort Descending (Highest score first)
          return scoreB - scoreA; 
        });
      }

      return res.status(200).json({
        message: "Resources fetched successfully",
        count: resources.length,
        data: resources
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching resources" });
    }
  }


  // PUT /api/resources/:id
  // Ability to update resource metadata
  async updateResource(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 1. Check if resource exists and belongs to the user
      const resource = await prisma.resource.findUnique({ where: { id } });

      if (!resource) {
        return res.status(404).json({ message: "Resource not found." });
      }

      if (resource.uploaderId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You can only edit your own files." });
      }

      // 2. Destructure allowed fields for update
      const { 
        title, description, subject, semester, 
        branch, yearBatch, type, tags, privacy 
      } = req.body;

      // 3. Update in Database
      const updatedResource = await prisma.resource.update({
        where: { id },
        data: {
          title,
          description,
          subject,
          semester: semester ? parseInt(semester) : undefined,
          branch,
          yearBatch,
          type,
          tags,
          privacy
        }
      });

      return res.status(200).json({
        message: "Resource metadata synchronized successfully.",
        resource: updatedResource
      });

    } catch (error) {
      console.error("Update Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }

  // DELETE /api/resources/:id
  async deleteResource(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const resource = await prisma.resource.findUnique({ where: { id } });

      if (!resource) {
        return res.status(404).json({ message: "Resource not found." });
      }

      if (resource.uploaderId !== userId) {
        return res.status(403).json({ message: "Unauthorized to delete this asset." });
      }

      // Delete from Prisma (ImageKit deletion can be added here using uploadResult.fileId)
      await prisma.resource.delete({ where: { id } });

      return res.status(200).json({ message: "Resource purged from database successfully." });

    } catch (error) {
      console.error("Delete Error:", error);
      return res.status(500).json({ message: "Failed to delete resource." });
    }
  }

}

export default new ResourceController();
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv"
dotenv.config()
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const prompt_TEMP = process.env.prompt;

class AIController {
  async askNexus(req, res) {
    try {
      const { query } = req.body;
      
      // 1. EXTRACT ID FROM req.user (Set by authMiddleware)

      const userId = req.user.id
      console.log("USER ID: ",req.user)

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized access detected." });
      }

      // 2. FETCH FULL USER PROFILE
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) return res.status(404).json({ error: "User identity not found in database." });

      // 3. FETCH COLLEGE CONTEXT
      const contextData = await prisma.resource.findMany({
        where: { college: user.college },
        select: { title: true, subject: true, type: true, description: true },
        take: 15
      });

      const contextString = contextData.length > 0 
        ? contextData.map(r => `[File: ${r.title} | Subject: ${r.subject} | Type: ${r.type}]`).join("\n")
        : "No local files indexed. Use general academic knowledge.";

      // 4. INITIALIZE MODEL (Using 1.5 Flash for high-speed hallucination)
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-lite", 
        generationConfig: {
          temperature: 0.9, 
          topP: 0.95,
        }
      });

      // 5. THE OMNI-BRAIN PROMPT
      const prompt = `
        SYSTEM_ROLE: You are the Nexus Omni-Brain for ${user.college}.
        USER_CONTEXT:
        - Name: ${user.name}
        - Academic Archetype: ${user.type} 
        - Goal Level: ${user.goal}
        - Department: ${user.branch}
        - Semester: ${user.semester}

        AVAILABLE_DATA:
        ${contextString}
        
        USER_QUERY: "${query}"

        INSTRUCTIONS:
        ${prompt_TEMP}
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      return res.status(200).json({ 
        answer: text,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Nexus Neural Error:", error);
      res.status(500).json({ error: "Cognitive override failed. Check Neural Link." });
    }
  }
}

export default new AIController();
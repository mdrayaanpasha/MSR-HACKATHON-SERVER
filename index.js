import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import userRouter from "./routers/user.router.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 2. Essential Middleware
app.use(cors()); // Allow all origins (for hackathon speed)
app.use(express.json()); // Parse incoming JSON bodies

// 3. Routes
// Mount the User Routes at /api/users
app.use("/api/users", userRouter);


app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "Active", 
    message: "Neural Breach Backend is Running 🚀" 
  });
});

// 5. Global Error Handler (Catch-all)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: "Something broke!", 
    details: err.message 
  });
});

// 6. Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
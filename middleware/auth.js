
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_hackathon_key';


export const authMiddleware = (req, res, next) => {
  // 1. Get token from header
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Access Denied. No token provided." });
  }

  try {
    // 2. Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 3. Attach user info to request object
    // @ts-ignore (Quick hack for hackathon speed to avoid extending Express types)
    req.user = decoded; 
    
    next();
  } catch (error) {
    res.status(400).json({ error: "Invalid Token" });
  }
};
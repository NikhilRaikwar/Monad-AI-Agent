import express from "express";
import cors from "cors";
import { processMessage } from "./monad-agent.js";

const app = express();
const PORT = 3001;

// CORS configuration: Allow both local and public frontend origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://upgraded-acorn-7w4pg7qxjq4fx79-3000.app.github.dev"
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  console.log("Health check requested from:", req.headers.origin);
  res.json({ status: "OK", message: "Backend is running" });
});

// Root route
app.get("/", (req, res) => {
  console.log("Root route requested from:", req.headers.origin);
  res.send("Monad AI Agent Backend - Use POST /api/chat to interact");
});

app.post("/api/chat", async (req, res) => {
  console.log("POST /api/chat received from:", req.headers.origin, "Body:", req.body);
  try {
    const { message } = req.body;
    if (!message) {
      console.log("No message provided");
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await processMessage(message);
    console.log("Sending response:", response);
    res.json({ response });
  } catch (error) {
    console.error("Error processing message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
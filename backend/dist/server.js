import express from "express";
import cors from "cors";
import { processMessage } from "./monad-agent.js";
const app = express();
const PORT = 3001;
// Allow requests from the frontend origin
app.use(cors({
    origin: "https://humble-space-winner-p9qpx7v666wfvrx-3000.app.github.dev",
    methods: ["POST"], // Explicitly allow POST requests
    allowedHeaders: ["Content-Type"],
}));
app.use(express.json());
// Optional: Add a root route for clarity
app.get("/", (req, res) => {
    res.send("Monad AI Agent Backend - Use POST /api/chat to interact");
});
app.post("/api/chat", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }
        const response = await processMessage(message);
        res.json({ response });
    }
    catch (error) {
        console.error("Error processing message:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map
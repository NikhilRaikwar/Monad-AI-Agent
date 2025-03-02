import express from "express";
import cors from "cors";
import { processMessage } from "./monad-agent.js"; // Added .js extension
const app = express();
const PORT = 3001;
app.use(cors());
app.use(express.json());
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
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

interface Message {
  text: string;
  sender: "user" | "agent";
}

const BACKEND_URL = "https://upgraded-acorn-7w4pg7qxjq4fx79-3001.app.github.dev/api/chat";
const HEALTH_CHECK_URL = "https://upgraded-acorn-7w4pg7qxjq4fx79-3001.app.github.dev/health";

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const response = await axios.get(HEALTH_CHECK_URL);
        setMessages(prev => [...prev, { text: `Backend status: ${response.data.status}`, sender: "agent" }]);
      } catch (error) {
        console.error("Health check failed:", error);
        setMessages(prev => [...prev, { text: "Error: Backend not reachable", sender: "agent" }]);
      }
    };
    checkBackendHealth();
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { text: input, sender: "user" };
    setMessages(prev => [...prev, userMessage]);
    setInput("");

    try {
      const response = await axios.post(BACKEND_URL, { message: input });
      const agentMessage: Message = { text: response.data.response, sender: "agent" };
      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorText = axios.isAxiosError(error) && error.response
        ? `Server error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        : error instanceof Error ? error.message : "Unknown error";
      const errorMessage: Message = {
        text: `Error: Could not get a response - ${errorText}`,
        sender: "agent",
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <span>{msg.text}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendMessage} className="chat-input">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default Chat;
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

interface Message {
  text: string;
  sender: "user" | "agent";
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { text: input, sender: "user" };
    setMessages(prev => [...prev, userMessage]);
    setInput("");

    try {
      const response = await axios.post("http://localhost:3001/api/chat", {
        message: input,
      });
      console.log("Backend response:", response.data); // Log the response
      const agentMessage: Message = { text: response.data.response, sender: "agent" };
      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error("Error details:", error); // Log detailed error
      const errorMessage: Message = {
        text: `Error: Could not get a response - ${error instanceof Error ? error.message : "Unknown error"}`,
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
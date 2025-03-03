import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const chatEndRef = useRef(null);
    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim())
            return;
        const userMessage = { text: input, sender: "user" };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        try {
            const response = await axios.post("http://localhost:3001/api/chat", {
                message: input,
            });
            console.log("Backend response:", response.data); // Log the response
            const agentMessage = { text: response.data.response, sender: "agent" };
            setMessages(prev => [...prev, agentMessage]);
        }
        catch (error) {
            console.error("Error details:", error); // Log detailed error
            const errorMessage = {
                text: `Error: Could not get a response - ${error instanceof Error ? error.message : "Unknown error"}`,
                sender: "agent",
            };
            setMessages(prev => [...prev, errorMessage]);
        }
    };
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    return (<div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg, index) => (<div key={index} className={`message ${msg.sender}`}>
            <span>{msg.text}</span>
          </div>))}
        <div ref={chatEndRef}/>
      </div>
      <form onSubmit={sendMessage} className="chat-input">
        <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Type your message..."/>
        <button type="submit">Send</button>
      </form>
    </div>);
};
export default Chat;
//# sourceMappingURL=Chat.js.map
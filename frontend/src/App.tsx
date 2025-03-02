import React from "react";
import Chat from "./components/Chat";
import "./styles.css";

const App: React.FC = () => {
  return (
    <div className="app">
      <header>
        <h1>Monad AI Agent</h1>
        <p>Chat with your onchain assistant</p>
      </header>
      <Chat />
    </div>
  );
};

export default App;
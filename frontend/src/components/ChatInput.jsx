import React, { useState } from 'react';

const ChatInput = ({ onSend, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} className="chat-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message here..."
          className="chat-input"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="run-button"
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? 'Running...' : 'Run'}
        </button>
      </form>
    </div>
  );
};

export default ChatInput; 
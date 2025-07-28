import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import './ChatPanel.css';

const CHAT_API_URL = 'http://localhost:8000/chat/query';
const WORKFLOW_API_URL = 'http://localhost:8000/workflow/run';

const ChatPanel = forwardRef(({ workflowConfig, getNodeConfig, currentWorkflowId }, ref) => {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hi! Build a workflow and run it to see results here, or ask me anything about your documents.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);

  // Save chat history function
  const saveChatHistory = async (workflowId) => {
    if (!workflowId) return;
    
    try {
      const chatMessages = messages.map(msg => ({
        sender: msg.sender,
        message: msg.text,
        model_used: msg.modelUsed,
        is_workflow: msg.isWorkflow,
        timestamp: new Date().toISOString()
      }));
      
      if (chatMessages.length === 0) return;
      
      const res = await fetch(`http://localhost:8000/workflow/chat-history/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflowId,
          messages: chatMessages
        })
      });
      
      const data = await res.json();
      if (data.success) {
        console.log('Chat history saved successfully');
      } else {
        console.error('Failed to save chat history:', data.error);
      }
    } catch (err) {
      console.error('Error saving chat history:', err);
    }
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    addWorkflowResult: (query, response, modelUsed) => {
      const newMessages = [
        { sender: 'user', text: query, isWorkflow: true },
        { sender: 'bot', text: response, modelUsed: modelUsed, isWorkflow: true }
      ];
      setMessages(prev => [...prev, ...newMessages]);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    getMessages: () => {
      return messages.map(msg => ({
        sender: msg.sender,
        message: msg.text,
        model_used: msg.modelUsed,
        is_workflow: msg.isWorkflow,
        timestamp: new Date().toISOString()
      }));
    },
    loadMessages: (newMessages) => {
      const formattedMessages = newMessages.map(msg => ({
        sender: msg.sender,
        text: msg.message,
        modelUsed: msg.model_used,
        isWorkflow: msg.is_workflow
      }));
      setMessages(formattedMessages);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }));

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMessages((msgs) => [...msgs, { sender: 'user', text: input }]);
    setLoading(true);
    setError('');
    
    try {
      let res, data;
      
      // If we have a valid workflow configuration, use workflow endpoint
      if (workflowConfig && workflowConfig.nodes && workflowConfig.nodes.length > 0) {
        // Find LLM Engine node for configuration
        const llmNode = workflowConfig.nodes.find(n => n.type === 'llmEngine');
        const llmConfig = llmNode ? getNodeConfig(llmNode.id, workflowConfig.nodeConfigs) : {
          model: 'gemini',
          temperature: 0.7,
          useKnowledgeBase: true,
          maxContextChunks: 3,
          useWebSearch: false
        };
        
        console.log('DEBUG ChatPanel: LLM Config:', llmConfig);
        console.log('DEBUG ChatPanel: Workflow Config:', workflowConfig);
        
        res = await fetch(WORKFLOW_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow: {
              nodes: workflowConfig.nodes,
              edges: workflowConfig.edges,
              configs: workflowConfig.nodeConfigs
            },
            query: input,
            preferred_model: llmConfig.model,
            temperature: llmConfig.temperature,
            use_knowledge_base: llmConfig.useKnowledgeBase,
            max_context_chunks: llmConfig.maxContextChunks
          })
        });
        data = await res.json();
        
        if (data.success) {
          setMessages((msgs) => [...msgs, { 
            sender: 'bot', 
            text: data.response, 
            modelUsed: data.model_used,
            isWorkflow: true 
          }]);
        } else {
          setMessages((msgs) => [...msgs, { 
            sender: 'bot', 
            text: data.error || 'Workflow execution failed.' 
          }]);
        }
      } else {
        // Fallback to regular chat endpoint
        res = await fetch(CHAT_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: input,
            preferred_model: 'gemini',
            use_knowledge_base: true,
            max_context_chunks: 3
          })
        });
        data = await res.json();
        
        if (data.success) {
          setMessages((msgs) => [...msgs, { sender: 'bot', text: data.response }]);
        } else {
          setMessages((msgs) => [...msgs, { sender: 'bot', text: data.error || 'Sorry, something went wrong.' }]);
        }
      }
    } catch (err) {
      setMessages((msgs) => [...msgs, { sender: 'bot', text: 'Network error. Please try again.' }]);
      setError('Network error');
    }
    
    setInput('');
    setLoading(false);
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        💬 Chat with Workflow
        {currentWorkflowId && (
          <button 
            className="save-chat-btn"
            onClick={() => saveChatHistory(currentWorkflowId)}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '12px',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            💾 Save Chat
          </button>
        )}
      </div>
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.sender} ${msg.isWorkflow ? 'workflow-message' : ''}`}>
            {msg.text}
            {msg.isWorkflow && msg.modelUsed && (
              <div className="workflow-meta">
                <small>🤖 {msg.modelUsed}</small>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question..."
          rows={1}
          disabled={loading}
        />
        <button className="chat-send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? '...' : 'Send'}
        </button>
      </div>
      {error && <div className="chat-error">{error}</div>}
    </div>
  );
});

ChatPanel.displayName = 'ChatPanel';

export default ChatPanel; 
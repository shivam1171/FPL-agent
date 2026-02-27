/**
 * Enhanced Chat interface — handles both conversational questions and suggestion generation
 */
import React, { useState, useEffect, useRef } from 'react';
import SuggestionList from './SuggestionList';
import { chatAPI } from '../../services/api';

const QUICK_PROMPTS = [
  { label: "🛡️ Defensive upgrades", text: "Focus on defensive upgrades with good fixtures", type: "suggestion" },
  { label: "💰 Budget picks", text: "Find cheap enablers to free up budget", type: "suggestion" },
  { label: "🔥 In-form players", text: "Prioritize players in hot form with upcoming easy fixtures", type: "suggestion" },
  { label: "📈 Differential picks", text: "Suggest low-ownership differentials that could be punts", type: "suggestion" },
  { label: "⭐ Premium targets", text: "What premium players should I target?", type: "suggestion" },
];

const QUESTION_PROMPTS = [
  { label: "💡 Captain advice", text: "Who should I captain this week and why?" },
  { label: "📅 Fixture difficulty", text: "Which of my players have the hardest upcoming fixtures?" },
  { label: "🎯 Chip strategy", text: "When should I use my bench boost, wildcard, and free hit chips?" },
  { label: "📉 Underperformers", text: "Which of my players are underperforming relative to their price?" },
  { label: "🏆 My rank", text: "What changes would help me improve my overall rank the most?" },
];

const ChatInterface = ({ managerId, onGetSuggestions, initialSuggestions, loading, onBack, watchlist = [] }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [promptCategory, setPromptCategory] = useState('questions'); // 'questions' or 'suggestions'
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (initialSuggestions && initialSuggestions.length > 0 && messages.length === 0) {
      setMessages([
        {
          type: 'agent',
          content: watchlist.length > 0 
            ? `Here are my top 5 transfer recommendations. I've factored in the ${watchlist.length} player(s) on your watchlist (${watchlist.map(p => p.web_name).join(', ')}) when analyzing your squad.`
            : "Here are my top 5 transfer recommendations based on your squad's form, fixtures, value, and underlying stats.",
          suggestions: initialSuggestions,
        },
      ]);
    }
  }, [initialSuggestions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, processing]);

  /**
   * Send a conversational message (question/answer, not suggestion generation)
   */
  const sendChatMessage = async (userMessage) => {
    if (!userMessage.trim() || processing) return;
    setInput('');
    setProcessing(true);

    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    try {
      // Get current suggestions for context
      const lastAgentMessage = [...messages].reverse().find(m => m.type === 'agent' && m.suggestions);
      const context = {
        suggestions: lastAgentMessage?.suggestions || [],
        watchlist: watchlist.map(p => ({ name: p.web_name, position: p.position, form: p.form, cost: (p.now_cost / 10).toFixed(1) })),
      };

      const response = await chatAPI.sendMessage(managerId, userMessage, context);
      
      if (response.success) {
        if (response.is_suggestion_request) {
          // The AI detected user wants new suggestions — trigger suggestion engine
          setMessages(prev => [...prev, { type: 'agent', content: response.reply || "Let me generate updated suggestions for you..." }]);
          
          const currentSuggestions = lastAgentMessage?.suggestions || [];
          const sugResult = await onGetSuggestions(userMessage, currentSuggestions);
          
          if (sugResult && sugResult.suggestions) {
            setMessages(prev => [...prev, {
              type: 'agent',
              content: "Here are your updated transfer recommendations:",
              suggestions: sugResult.suggestions,
            }]);
          }
        } else {
          // Regular conversational reply
          setMessages(prev => [...prev, { type: 'agent', content: response.reply }]);
        }
      } else {
        setMessages(prev => [...prev, { type: 'agent', content: "Sorry, something went wrong. Please try again." }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { type: 'agent', content: 'An error occurred while processing your message.' }]);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Send a suggestion-specific message (triggers full suggestion regeneration)
   */
  const sendSuggestionMessage = async (userMessage) => {
    if (!userMessage.trim() || processing) return;
    setInput('');
    setProcessing(true);

    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    try {
      const lastAgentMessage = [...messages].reverse().find(m => m.type === 'agent' && m.suggestions);
      const currentSuggestions = lastAgentMessage ? lastAgentMessage.suggestions : [];
      const response = await onGetSuggestions(userMessage, currentSuggestions);
      
      if (response && response.suggestions) {
        setMessages(prev => [...prev, {
          type: 'agent',
          content: "I've updated my suggestions based on your feedback:",
          suggestions: response.suggestions,
        }]);
      } else {
        setMessages(prev => [...prev, { type: 'agent', content: "Sorry, I couldn't generate new suggestions. Please try again." }]);
      }
    } catch (error) {
      console.error('Suggestion error:', error);
      setMessages(prev => [...prev, { type: 'agent', content: 'An error occurred while generating suggestions.' }]);
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = (e) => { 
    e.preventDefault(); 
    // Route to chat (conversational) by default
    sendChatMessage(input); 
  };

  const handleReplace = async (suggestion) => {
    if (processing || loading) return;
    const userMessage = `Please replace this SPECIFIC suggestion: Transfer OUT ${suggestion.player_out.web_name} for IN ${suggestion.player_in.web_name}. Give me a completely different alternative for this exact spot. VERY IMPORTANT: Keep the other 4 suggestions EXACTLY the same.`;
    setProcessing(true);
    setMessages(prev => [...prev, { type: 'user', content: `Replace: ${suggestion.player_out.web_name} → ${suggestion.player_in.web_name}` }]);

    try {
      const lastAgentMessage = [...messages].reverse().find(m => m.type === 'agent' && m.suggestions);
      const currentSuggestions = lastAgentMessage ? lastAgentMessage.suggestions : [];
      const response = await onGetSuggestions(userMessage, currentSuggestions);
      
      if (response && response.suggestions) {
        setMessages(prev => [...prev, {
          type: 'agent',
          content: "I've replaced that suggestion with a new alternative, keeping the others the same.",
          suggestions: response.suggestions,
        }]);
      } else {
        setMessages(prev => [...prev, { type: 'agent', content: "Sorry, I couldn't generate a replacement." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { type: 'agent', content: 'An error occurred.' }]);
    } finally {
      setProcessing(false);
    }
  };

  // Build watchlist-aware prompt lists
  const allQuestionPrompts = watchlist.length > 0 ? [
    { label: `👁️ Watchlist analysis`, text: `Analyze the players on my watchlist: ${watchlist.map(p => p.web_name).join(', ')}. Should I keep, sell, or buy any of them?` },
    ...QUESTION_PROMPTS,
  ] : QUESTION_PROMPTS;

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <h2>🤖 FPL Assistant</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {watchlist.length > 0 && (
            <span className="chat-watchlist-badge" title={`Watching: ${watchlist.map(p => p.web_name).join(', ')}`}>
              👁️ {watchlist.length} watched
            </span>
          )}
          <span className="chat-status">Online</span>
        </div>
      </div>

      {/* Mode hint */}
      <div className="chat-mode-hint">
        💡 Ask any FPL question, get captain advice, or request new transfer suggestions — I can do it all!
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <div className="chat-empty-state">
            <span style={{ fontSize: '3rem' }}>🤖</span>
            <h3>Your FPL Assistant</h3>
            <p>I can answer questions about your team, give captain advice, analyze fixtures, and generate transfer suggestions.</p>
            {watchlist.length > 0 && (
              <p className="chat-watchlist-hint">
                👁️ Watching: {watchlist.map(p => p.web_name).join(', ')}
              </p>
            )}
            <div className="chat-example-questions">
              <span className="chat-example-label">Try asking:</span>
              <div className="chat-examples">
                <button onClick={() => sendChatMessage("Who should I captain this week?")}>Who should I captain?</button>
                <button onClick={() => sendChatMessage("Are any of my players at risk of price drops?")}>Price drop risks?</button>
                <button onClick={() => sendChatMessage("What's my team's biggest weakness?")}>Team weaknesses?</button>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            <div className="message-content">
              {msg.content && <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>}
              {msg.suggestions && (
                <div className="embedded-suggestions">
                  <SuggestionList 
                    suggestions={msg.suggestions} 
                    loading={false}
                    embedded={true}
                    onReplace={handleReplace}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        
        {(loading || processing) && (
          <div className="message agent">
            <div className="message-content loading-bubble">
              <div className="typing-indicator"><span></span><span></span><span></span></div>
              <p>{loading ? "Analyzing your squad..." : "Thinking..."}</p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts with category toggle */}
      {messages.length > 0 && !loading && !processing && (
        <div className="quick-prompts-section">
          <div className="prompt-category-toggle">
            <button 
              className={`category-tab ${promptCategory === 'questions' ? 'active' : ''}`}
              onClick={() => setPromptCategory('questions')}
            >
              💬 Questions
            </button>
            <button 
              className={`category-tab ${promptCategory === 'suggestions' ? 'active' : ''}`}
              onClick={() => setPromptCategory('suggestions')}
            >
              🔄 New Suggestions
            </button>
          </div>
          <div className="quick-prompts-bar">
            {promptCategory === 'questions' 
              ? allQuestionPrompts.map((prompt, i) => (
                  <button key={i} onClick={() => sendChatMessage(prompt.text)} className="quick-prompt-pill">
                    {prompt.label}
                  </button>
                ))
              : QUICK_PROMPTS.map((prompt, i) => (
                  <button key={i} onClick={() => sendSuggestionMessage(prompt.text)} className="quick-prompt-pill suggestion-pill">
                    {prompt.label}
                  </button>
                ))
            }
          </div>
        </div>
      )}

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question or request new suggestions..."
          disabled={processing || loading}
        />
        <button type="submit" disabled={!input.trim() || processing || loading}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;

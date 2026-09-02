/**
 * Enhanced Chat interface — handles conversational questions, suggestion generation, and chip strategy
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, Bot, Eye, Target, SendHorizontal, MessageCircleQuestion, RefreshCw,
  Shield, Wallet, Flame, TrendingUp, Star, Lightbulb, CalendarDays, Crosshair,
  TrendingDown, Trophy, ChartColumn, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SuggestionList from './SuggestionList';
import ApprovalModal from './ApprovalModal';
import ChipAdvisor from './ChipAdvisor';
import { chatAPI, transferAPI } from '@/services/api';
import { BallLoader } from '@/components/ui/football';

const QUICK_PROMPTS = [
  { icon: Shield, label: 'Defensive upgrades', text: 'Focus on defensive upgrades with good fixtures' },
  { icon: Wallet, label: 'Budget picks', text: 'Find cheap enablers to free up budget' },
  { icon: Flame, label: 'In-form players', text: 'Prioritize players in hot form with upcoming easy fixtures' },
  { icon: TrendingUp, label: 'Differentials', text: 'Suggest low-ownership differentials that could be punts' },
  { icon: Star, label: 'Premium targets', text: 'What premium players should I target?' },
];

const QUESTION_PROMPTS = [
  { icon: Lightbulb, label: 'Captain advice', text: 'Who should I captain this week and why?' },
  { icon: CalendarDays, label: 'Fixture difficulty', text: 'Which of my players have the hardest upcoming fixtures?' },
  { icon: Crosshair, label: 'Chip strategy', text: 'When should I use my bench boost, wildcard, and free hit chips? Consider any upcoming DGWs or BGWs.' },
  { icon: TrendingDown, label: 'Underperformers', text: 'Which of my players are underperforming relative to their price?' },
  { icon: Trophy, label: 'My rank', text: 'What changes would help me improve my overall rank the most?' },
  { icon: ChartColumn, label: 'DGW/BGW intel', text: 'Are there any upcoming Double or Blank Gameweeks I should be planning for?' },
];

const ChatInterface = ({ managerId, gameweek, onGetSuggestions, initialSuggestions, loading, onBack, watchlist = [], chipStatus = null, gwIntelligence = null, transfersInfo = null, onTransferExecuted = null }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [promptCategory, setPromptCategory] = useState('questions');
  const [approvalTarget, setApprovalTarget] = useState(null);
  const [showChipAdvisor, setShowChipAdvisor] = useState(false);
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

  const handleExecute = (suggestion) => {
    setApprovalTarget(suggestion);
  };

  const handleConfirmExecute = async () => {
    if (!approvalTarget) return;
    const suggestion = approvalTarget;
    setApprovalTarget(null);

    setMessages(prev => [...prev, {
      type: 'user',
      content: `✅ Execute: ${suggestion.player_out.web_name} → ${suggestion.player_in.web_name}`,
    }]);

    try {
      const result = await transferAPI.executeTransfer(
        managerId,
        gameweek,
        [{ player_in_id: suggestion.player_in.id, player_out_id: suggestion.player_out.id }],
        null,
      );

      if (result.success) {
        // Drop the executed suggestion everywhere it is rendered, so its
        // Execute button cannot fire a second live transfer.
        setMessages((prev) =>
          prev.map((m) =>
            m.suggestions
              ? {
                  ...m,
                  suggestions: m.suggestions.filter(
                    (s) =>
                      !(
                        s.player_in?.id === suggestion.player_in?.id &&
                        s.player_out?.id === suggestion.player_out?.id
                      )
                  ),
                }
              : m
          )
        );
        // Refetches the squad, bank, chips and free-transfer count.
        onTransferExecuted?.(suggestion);
      }

      setMessages(prev => [...prev, {
        type: 'agent',
        content: result.success
          ? `🎉 **Transfer confirmed!** ${suggestion.player_out.web_name} is out, ${suggestion.player_in.web_name} is in. Good luck this gameweek!`
          : `❌ Transfer failed: ${result.message || 'Unknown error. Please try again on the FPL website.'}`,
      }]);
    } catch (err) {
      const detail = err?.response?.data?.detail || err.message || 'Unexpected error.';
      setMessages(prev => [...prev, {
        type: 'agent',
        content: `❌ Transfer failed: ${detail}`,
      }]);
    }
  };

  // Build watchlist-aware prompt lists
  const allQuestionPrompts = watchlist.length > 0 ? [
    { icon: Eye, label: 'Watchlist analysis', text: `Analyze the players on my watchlist: ${watchlist.map(p => p.web_name).join(', ')}. Should I keep, sell, or buy any of them?` },
    ...QUESTION_PROMPTS,
  ] : QUESTION_PROMPTS;

  const busy = loading || processing;

  return (
    <div className="ui-root flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft strokeWidth={2} />
            Back
          </Button>
          <div className="flex items-center gap-1.5">
            <Bot className="size-4 text-primary" strokeWidth={2} />
            <h2 className="font-display text-sm font-bold tracking-tight">FPL Assistant</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showChipAdvisor ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowChipAdvisor(prev => !prev)}
          >
            <Target strokeWidth={2} />
            Chips
          </Button>
          {watchlist.length > 0 && (
            <Badge variant="info" title={`Watching: ${watchlist.map(p => p.web_name).join(', ')}`}>
              <Eye strokeWidth={2} /> {watchlist.length}
            </Badge>
          )}
          <Badge variant="primary">Online</Badge>
        </div>
      </div>

      {/* Chip Advisor Panel */}
      {showChipAdvisor && (
        <div className="border-b border-border py-3">
          <ChipAdvisor
            managerId={managerId}
            gameweek={gameweek}
            chipStatus={chipStatus}
            gwIntelligence={gwIntelligence}
          />
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Bot className="size-10 text-primary" strokeWidth={1.5} />
            <h3 className="font-display text-base font-bold">Your FPL Assistant</h3>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              I can answer questions about your team, give captain advice, analyze fixtures, and
              generate transfer suggestions.
            </p>
            {watchlist.length > 0 && (
              <Badge variant="info">
                <Eye strokeWidth={2} />
                Watching {watchlist.map(p => p.web_name).join(', ')}
              </Badge>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {['Who should I captain this week?', 'Are any of my players at risk of price drops?', "What's my team's biggest weakness?"].map((q) => (
                <Button key={q} variant="outline" size="sm" onClick={() => sendChatMessage(q)}>
                  {q}
                </Button>
              ))}
            </div>
            <Button className="mt-2" onClick={() => onGetSuggestions()}>
              <Sparkles strokeWidth={2} />
              Generate transfer suggestions
            </Button>
          </div>
        )}

        {messages.map((msg, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            className={cn('flex', msg.type === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed',
                msg.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card shadow-raised ring-1 ring-border/60',
                // Suggestion lists fill the column, so expanding a row never resizes the bubble.
                msg.suggestions && 'w-full max-w-full'
              )}
            >
              {msg.content && (
                <div
                  className={cn(
                    'space-y-2 text-[0.8rem] [&_strong]:font-bold',
                    msg.type === 'agent' && '[&_a]:text-primary [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc'
                  )}
                >
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
              {msg.suggestions && (
                <div className="mt-3">
                  <SuggestionList
                    suggestions={msg.suggestions}
                    loading={false}
                    embedded={true}
                    onReplace={handleReplace}
                    onExecute={handleExecute}
                  />
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-card px-3.5 py-2.5 shadow-raised ring-1 ring-border/60">
              <BallLoader size={16} label={loading ? 'Analyzing your squad…' : 'Thinking…'} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length > 0 && !busy && (
        <div className="space-y-2 border-t border-border py-3">
          <Tabs value={promptCategory} onValueChange={setPromptCategory}>
            <TabsList>
              <TabsTrigger value="questions">
                <MessageCircleQuestion strokeWidth={2} /> Questions
              </TabsTrigger>
              <TabsTrigger value="suggestions">
                <RefreshCw strokeWidth={2} /> New suggestions
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap gap-1.5">
            {(promptCategory === 'questions' ? allQuestionPrompts : QUICK_PROMPTS).map(
              ({ icon: Icon, label, text }) => (
                <Button
                  key={label}
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    promptCategory === 'questions'
                      ? sendChatMessage(text)
                      : sendSuggestionMessage(text)
                  }
                >
                  <Icon strokeWidth={2} />
                  {label}
                </Button>
              )
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question or request new suggestions…"
          disabled={busy}
          className={cn(
            'h-10 flex-1 rounded-md bg-secondary/50 px-3 text-sm ring-1 ring-border',
            'placeholder:text-muted-foreground',
            'transition-[box-shadow,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:opacity-50'
          )}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Send">
          <SendHorizontal strokeWidth={2} />
        </Button>
      </form>

      {approvalTarget && (
        <ApprovalModal
          suggestion={approvalTarget}
          gameweek={gameweek}
          transfersInfo={transfersInfo}
          onConfirm={handleConfirmExecute}
          onCancel={() => setApprovalTarget(null)}
        />
      )}
    </div>
  );
};

export default ChatInterface;

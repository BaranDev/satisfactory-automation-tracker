import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  Settings,
  Zap,
} from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { cn } from "@/lib/utils";
import {
  buildLegacyFactoryContext,
  buildFactoryContext,
  buildFullSystemPrompt,
  parseAISuggestions,
  stripSuggestionTags,
  type AISuggestion,
} from "@/lib/ai-context";
import AISettings, {
  loadAIConfig,
  saveAIConfig,
  getEndpointForConfig,
  type AIConfig,
} from "./AISettings";
import type { FactorySimulationResult, MachineInstance } from "@/types/factory";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  suggestions?: AISuggestion[];
}

interface AiChatProps {
  factoryMachines?: MachineInstance[];
  factorySimulation?: FactorySimulationResult | null;
}

export default function AiChat({ factoryMachines, factorySimulation }: AiChatProps) {
  const { project, simulationResult } = useProjectStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AIConfig>(loadAIConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasKey = config.apiKey.length > 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleConfigChange = useCallback((newConfig: AIConfig) => {
    setConfig(newConfig);
    saveAIConfig(newConfig);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = messageText ?? input.trim();
    if (!text || !config.apiKey || isLoading || !project) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    if (!messageText) setInput("");
    setError(null);

    // Build factory context — use new machine system if available, otherwise legacy
    let factoryContext: string;
    if (factoryMachines && factoryMachines.length > 0) {
      factoryContext = buildFactoryContext(
        project.name,
        factoryMachines,
        factorySimulation ?? null,
      );
    } else {
      factoryContext = buildLegacyFactoryContext(project, simulationResult);
    }

    const systemPrompt = buildFullSystemPrompt(factoryContext);

    const newMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const endpoint = getEndpointForConfig(config);
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "FICSIT Automation Tracker",
        },
        body: JSON.stringify({
          model: config.model,
          messages: apiMessages,
          max_tokens: 2048,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Invalid API key. Check your key in settings.");
        }
        throw new Error(
          (errData as { error?: { message?: string } })?.error?.message ??
            `Request failed (${response.status})`,
        );
      }

      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };
      const rawContent =
        data.choices?.[0]?.message?.content ?? "No response received.";

      // Parse any structured suggestions from the response
      const suggestions = parseAISuggestions(rawContent);
      const cleanContent = stripSuggestionTags(rawContent);

      setMessages([
        ...newMessages,
        { role: "assistant", content: cleanContent, suggestions },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  }, [input, config, isLoading, project, messages, simulationResult, factoryMachines, factorySimulation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Model name for display
  const modelLabel = config.model.split("/").pop()?.replace(/:.*$/, "") ?? config.model;

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">FICSIT AI</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
            BETA
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasKey && (
            <span className="text-[10px] text-muted-foreground mr-1 max-w-[80px] truncate" title={config.model}>
              {modelLabel}
            </span>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-1.5 rounded transition-colors",
              hasKey
                ? "text-neon-green hover:bg-neon-green/10"
                : "text-muted-foreground hover:bg-secondary",
            )}
            title="AI Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <AISettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onConfigChange={handleConfigChange}
      />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {!hasKey && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              AI Factory Assistant
            </p>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">
              Configure your AI model and API key in settings to get
              optimization suggestions, production planning, and bottleneck
              analysis.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Settings className="w-3 h-3" /> Open Settings
            </button>
          </div>
        )}

        {hasKey && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="w-10 h-10 text-primary/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Ask me anything about your factory
            </p>
            <div className="space-y-1.5 w-full">
              {[
                "What should I automate next?",
                "How do I fix my bottlenecks?",
                "Plan a production line for computers",
                "How much power does my factory need?",
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="w-full text-left text-xs px-3 py-2 rounded bg-secondary/30 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-2",
              msg.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div className="max-w-[85%] space-y-2">
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary/15 text-foreground"
                    : "bg-secondary/40 text-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>

              {/* Suggestion buttons from AI */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="space-y-1">
                  {msg.suggestions.map((s, j) => (
                    <button
                      key={j}
                      className="w-full text-left text-[10px] px-2.5 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                      title={`${s.type}: ${JSON.stringify(s.attributes)}`}
                    >
                      <Zap className="w-3 h-3 shrink-0" />
                      {s.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded bg-secondary/40 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
          </motion.div>
        ))}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2"
          >
            <div className="w-6 h-6 rounded bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-secondary/40 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-xs text-destructive"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </motion.div>
        )}
      </div>

      {/* Input */}
      {hasKey && (
        <div className="p-3 border-t border-border/50">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your factory..."
              rows={1}
              className="flex-1 text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="px-3 py-2 rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">
            Powered by {modelLabel} via {config.customEndpoint ? "custom endpoint" : "OpenRouter"}
          </p>
        </div>
      )}
    </div>
  );
}

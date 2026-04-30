import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  Trash2,
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
  shouldSendOpenRouterHeaders,
  type AIConfig,
} from "./AISettings";
import { MACHINES } from "@/data/machines";
import type { MachineType, FactorySimulationResult, MachineInstance } from "@/types/factory";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  suggestions?: AISuggestion[];
}

interface AiChatProps {
  factoryMachines?: MachineInstance[];
  factorySimulation?: FactorySimulationResult | null;
}

export default function AiChat({
  factoryMachines,
  factorySimulation,
}: AiChatProps) {
  const { project, simulationResult } = useProjectStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AIConfig>(loadAIConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const addMachine = useProjectStore(s => s.addMachine);
  const updateMachineRecipe = useProjectStore(s => s.updateMachineRecipe);
  const updateMachineOverclock = useProjectStore(s => s.updateMachineOverclock);

  const hasKey = config.apiKey.length > 0;
  const projectId = project?.project_id;

  const applySuggestion = useCallback(
    (s: AISuggestion) => {
      switch (s.type) {
        case "add_machine": {
          const machineType = s.attributes.machine as MachineType | undefined;
          const recipeId = s.attributes.recipe;
          const count = parseInt(s.attributes.count ?? "1");
          if (!machineType || !MACHINES[machineType]) return;
          for (let i = 0; i < count; i++) {
            const id = addMachine(machineType);
            if (recipeId) updateMachineRecipe(id, recipeId);
          }
          break;
        }
        case "change_overclock": {
          const id = s.attributes.machineId;
          const oc = parseFloat(s.attributes.overclock ?? "1");
          if (!id || isNaN(oc)) return;
          updateMachineOverclock(id, Math.max(0.01, Math.min(2.5, oc)));
          break;
        }
        case "fix_recipe": {
          const id = s.attributes.machineId;
          const recipeId = s.attributes.recipe;
          if (!id) return;
          updateMachineRecipe(id, recipeId ?? null);
          break;
        }
        default:
          // Unknown suggestion shape — fall through silently.
          break;
      }
    },
    [addMachine, updateMachineRecipe, updateMachineOverclock],
  );

  // Load chat history from localStorage when project changes
  useEffect(() => {
    if (projectId) {
      const saved = localStorage.getItem(`chat_history_${projectId}`);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse chat history", e);
        }
      } else {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [projectId]);

  // Save chat history to localStorage when messages change
  useEffect(() => {
    if (projectId && messages.length > 0) {
      localStorage.setItem(
        `chat_history_${projectId}`,
        JSON.stringify(messages),
      );
    } else if (projectId && messages.length === 0) {
      // If cleared, remove from storage
      localStorage.removeItem(`chat_history_${projectId}`);
    }
  }, [messages, projectId]);

  const clearHistory = useCallback(() => {
    if (confirm("Clear local chat history?")) {
      setMessages([]);
    }
  }, []);

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

  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (messageText?: string) => {
      const text = messageText ?? input.trim();
      if (!text || !config.apiKey || isLoading || isStreaming || !project)
        return;

      const userMessage: ChatMessage = { role: "user", content: text };
      if (!messageText) setInput("");
      setError(null);

      // Create placeholder for assistant message
      const newMessages: ChatMessage[] = [
        ...messages,
        userMessage,
        { role: "assistant", content: "" },
      ];
      setMessages(newMessages);
      setIsLoading(true);
      setIsStreaming(true);

      try {
        // Build factory context
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

        // Prepare API messages
        const apiMessages = [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: text },
        ];

        // Setup abort controller
        abortControllerRef.current = new AbortController();
        const endpoint = getEndpointForConfig(config);

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
        if (shouldSendOpenRouterHeaders(config)) {
          headers["HTTP-Referer"] = window.location.origin;
          headers["X-Title"] = "FICSIT Automation Tracker";
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: config.model,
            messages: apiMessages,
            max_tokens: 2048,
            temperature: 0.7,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          if (response.status === 401) throw new Error("Invalid API key.");
          throw new Error(
            (errData as any)?.error?.message ?? `Error ${response.status}`,
          );
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");

          for (const line of lines) {
            if (line === "data: [DONE]") continue;
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                const delta = data.choices?.[0]?.delta?.content || "";
                if (delta) {
                  assistantContent += delta;
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg.role === "assistant") {
                      lastMsg.content = assistantContent;
                    }
                    return updated;
                  });
                }
              } catch (e) {
                console.warn("Failed to parse stream chunk", e);
              }
            }
          }
        }

        // Post-processing: Extract suggestions from the full content
        const suggestions = parseAISuggestions(assistantContent);
        const cleanContent = stripSuggestionTags(assistantContent);

        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg.role === "assistant") {
            lastMsg.content = cleanContent;
            lastMsg.suggestions = suggestions;
          }
          return updated;
        });
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Generation stopped by user");
        } else {
          setError(err.message || "Failed to get response");
          // Remove the empty assistant message on error if it's empty
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last.role === "assistant" && !last.content) {
              return prev.slice(0, -1);
            }
            return prev;
          });
        }
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [
      input,
      config,
      isLoading,
      isStreaming,
      project,
      messages,
      simulationResult,
      factoryMachines,
      factorySimulation,
    ],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Model name for display
  const modelLabel =
    config.model.split("/").pop()?.replace(/:.*$/, "") ?? config.model;

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
            <span
              className="text-[10px] text-muted-foreground mr-1 max-w-[80px] truncate"
              title={config.model}
            >
              {modelLabel}
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-1.5 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Clear Chat History"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
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
              ].map((suggestion) => (
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
                  "rounded-lg px-3 py-2 text-xs leading-relaxed min-h-[2rem]",
                  msg.role === "user"
                    ? "bg-primary/15 text-foreground"
                    : "bg-secondary/40 text-foreground",
                )}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="markdown-content">
                    {msg.content ? (
                      <div className="prose prose-invert prose-xs max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>h1]:text-sm [&>h1]:font-bold [&>h2]:text-xs [&>h2]:font-bold [&>code]:bg-black/30 [&>code]:px-1 [&>code]:rounded [&>pre]:bg-black/30 [&>pre]:p-2 [&>pre]:rounded [&>pre]:overflow-x-auto">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : /* Show spinner if purely empty (waiting for start) */
                    isLoading && isStreaming && i === messages.length - 1 ? (
                      <span className="flex items-center gap-2 text-muted-foreground/50 italic">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Thinking...
                      </span>
                    ) : null}
                    {/* Blinking cursor at end of streaming message */}
                    {isStreaming &&
                      i === messages.length - 1 &&
                      msg.content && (
                        <span className="inline-block w-1.5 h-3 bg-primary/50 ml-0.5 animate-pulse align-middle" />
                      )}
                  </div>
                )}
              </div>

              {/* Suggestion buttons from AI */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="space-y-1">
                  {msg.suggestions.map((s, j) => (
                    <button
                      key={j}
                      onClick={() => applySuggestion(s)}
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

        {/* Removed standalone loader, now integrated into empty message */}
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your factory..."
              rows={1}
              className="flex-1 text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            />
            {isStreaming ? (
              <button
                onClick={stopGeneration}
                className="px-3 py-2 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors flex items-center justify-center"
                title="Stop generation"
              >
                <div className="w-2.5 h-2.5 bg-current rounded-[1px]" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">
            Powered by {modelLabel} via{" "}
            {config.customEndpoint ? "custom endpoint" : "OpenRouter"}
          </p>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  Key,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useProjectStore } from "@/store/projectStore";
import { ITEMS, getRecipeForItem } from "@/data/recipes";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "z-ai/glm-4.5-air:free";

const STORAGE_KEY = "openrouter-api-key";

function buildSystemPrompt(
  projectName: string,
  automatedItems: { key: string; label: string; machines: number; overclock: number }[],
  bottlenecks: { label: string; shortfall: number }[],
): string {
  const itemList = automatedItems
    .map(
      (i) =>
        `- ${i.label}: ${i.machines} machine(s) at ${Math.round(i.overclock * 100)}% overclock`,
    )
    .join("\n");

  const bottleneckList = bottlenecks.length > 0
    ? bottlenecks.map((b) => `- ${b.label}: shortfall ${b.shortfall.toFixed(1)}/min`).join("\n")
    : "None detected";

  return `You are FICSIT Factory AI, an expert automation consultant for the game Satisfactory. You help players optimize their factory production lines.

Current Factory: "${projectName}"

Currently Automated Items:
${itemList || "No items automated yet."}

Current Bottlenecks:
${bottleneckList}

Available game knowledge:
- Satisfactory has resources, ingots, parts, intermediates, fluids, fuel, nuclear items, alien tech, and space elevator parts
- Production chains go: Raw Resources -> Ingots -> Basic Parts -> Intermediates -> Advanced Products
- Machines include: Miners, Smelters, Foundries, Constructors, Assemblers, Manufacturers, Refineries, Blenders, Particle Accelerators, Converters, Quantum Encoders
- Overclock range: 1% to 250% (higher overclock uses exponentially more power)
- Each machine type has specific recipes with defined input/output rates

Your role:
1. Help users plan and optimize their factory production lines
2. Suggest which items to automate next based on their current setup
3. Identify and explain bottlenecks and how to resolve them
4. Recommend optimal machine counts and overclock settings
5. Explain production chains and dependencies
6. Help with factory planning for space elevator parts and end-game items

Keep responses concise and practical. Use specific numbers when suggesting machine counts. Reference the user's current factory state when relevant.`;
}

export default function AiChat() {
  const { project, simulationResult } = useProjectStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasKey = apiKey.length > 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const saveKey = useCallback((key: string) => {
    setApiKey(key);
    localStorage.setItem(STORAGE_KEY, key);
    setShowKeyInput(false);
    setError(null);
  }, []);

  const clearKey = useCallback(() => {
    setApiKey("");
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !apiKey || isLoading || !project) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setInput("");
    setError(null);

    const automatedItems = Object.entries(project.items)
      .filter(([, i]) => i.automated)
      .map(([key, i]) => ({
        key,
        label: ITEMS[key]?.label ?? key,
        machines: i.machines,
        overclock: i.overclock,
      }));

    const bottlenecks = simulationResult?.bottlenecks.map((b) => ({
      label: b.label,
      shortfall: b.shortfall,
    })) ?? [];

    const systemPrompt = buildSystemPrompt(
      project.name,
      automatedItems,
      bottlenecks,
    );

    const newMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "FICSIT Automation Tracker",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: apiMessages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Invalid API key. Please check your OpenRouter key.");
        }
        throw new Error(
          (errData as { error?: { message?: string } })?.error?.message ??
            `Request failed (${response.status})`,
        );
      }

      const data = (await response.json()) as {
        choices: { message: { content: string } }[];
      };
      const assistantContent =
        data.choices?.[0]?.message?.content ?? "No response received.";

      setMessages([
        ...newMessages,
        { role: "assistant", content: assistantContent },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  }, [input, apiKey, isLoading, project, messages, simulationResult]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">FICSIT AI</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
            BETA
          </span>
        </div>
        <button
          onClick={() => (hasKey ? setShowKeyInput(!showKeyInput) : setShowKeyInput(true))}
          className={cn(
            "p-1.5 rounded transition-colors",
            hasKey
              ? "text-neon-green hover:bg-neon-green/10"
              : "text-muted-foreground hover:bg-secondary",
          )}
          title={hasKey ? "API key configured" : "Set API key"}
        >
          <Key className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Key Input */}
      <AnimatePresence>
        {showKeyInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border/50"
          >
            <div className="p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Enter your OpenRouter API key to use the AI assistant.{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Get a free key <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="sk-or-..."
                  defaultValue={apiKey}
                  className="flex-1 text-xs px-2 py-1.5 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveKey((e.target as HTMLInputElement).value);
                    }
                  }}
                  ref={(el) => {
                    if (el && !apiKey) el.focus();
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement);
                    saveKey(input.value);
                  }}
                  className="px-2 py-1.5 rounded bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
                >
                  Save
                </button>
                {hasKey && (
                  <button
                    onClick={clearKey}
                    className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {!hasKey && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              AI Factory Assistant
            </p>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">
              Set up your OpenRouter API key to get AI-powered factory
              optimization suggestions, production planning help, and
              bottleneck analysis.
            </p>
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
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
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
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                msg.role === "user"
                  ? "bg-primary/15 text-foreground"
                  : "bg-secondary/40 text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
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
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your factory..."
              rows={1}
              className="flex-1 text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-3 py-2 rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center">
            Powered by GLM-4.5 via OpenRouter
          </p>
        </div>
      )}
    </div>
  );
}

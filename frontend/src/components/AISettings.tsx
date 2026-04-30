import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  X,
  ExternalLink,
  Check,
  ChevronDown,
  PlugZap,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AIProvider =
  | "openrouter"
  | "openai"
  | "anthropic_compat"
  | "local"
  | "custom";

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  customEndpoint?: string;
}

const STORAGE_KEY_CONFIG = "ai-chat-config";

interface ProviderPreset {
  id: AIProvider;
  label: string;
  description: string;
  defaultEndpoint: string;
  /** Models surfaced as suggestions (user can still type their own). */
  suggestedModels: { id: string; label: string }[];
  /** True if the OpenRouter-specific HTTP-Referer / X-Title headers
   *  should be added to chat requests. */
  isOpenRouter: boolean;
  /** True if API key is required. */
  needsKey: boolean;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "Aggregator. Free tier on z-ai/glm-4.5-air:free.",
    defaultEndpoint: "https://openrouter.ai/api/v1/chat/completions",
    isOpenRouter: true,
    needsKey: true,
    suggestedModels: [
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
      { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
      { id: "openai/gpt-4o", label: "GPT-4o" },
      { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "z-ai/glm-4.5-air:free", label: "GLM-4.5 Air (free)" },
      { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Direct to OpenAI API.",
    defaultEndpoint: "https://api.openai.com/v1/chat/completions",
    isOpenRouter: false,
    needsKey: true,
    suggestedModels: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
  },
  {
    id: "anthropic_compat",
    label: "Anthropic-compatible",
    description: "OpenAI-shape proxy in front of Claude API.",
    defaultEndpoint: "https://api.anthropic.com/v1/chat/completions",
    isOpenRouter: false,
    needsKey: true,
    suggestedModels: [
      { id: "claude-opus-4-7", label: "Claude Opus 4.7" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "local",
    label: "Local server",
    description: "llama-swap / Ollama / OpenWebUI.",
    defaultEndpoint: "http://localhost:8080/v1/chat/completions",
    isOpenRouter: false,
    needsKey: false,
    suggestedModels: [
      { id: "qwen2.5-3b", label: "Qwen2.5 3B" },
      { id: "qwen2.5-7b", label: "Qwen2.5 7B" },
      { id: "llama-3.1-8b", label: "Llama 3.1 8B" },
    ],
  },
  {
    id: "custom",
    label: "Custom endpoint",
    description: "Any OpenAI-compatible /chat/completions URL.",
    defaultEndpoint: "",
    isOpenRouter: false,
    needsKey: true,
    suggestedModels: [],
  },
];

export function loadAIConfig(): AIConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (stored) {
      const cfg = JSON.parse(stored) as AIConfig;
      if (cfg.provider && cfg.model) return cfg;
    }
  } catch {
    // ignore
  }
  return {
    provider: "openrouter",
    model: "z-ai/glm-4.5-air:free",
    apiKey: localStorage.getItem("openrouter-api-key") ?? "",
  };
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  if (config.provider === "openrouter" && config.apiKey) {
    localStorage.setItem("openrouter-api-key", config.apiKey);
  }
}

/** Resolve the effective endpoint URL for a given config. */
export function getEndpointForConfig(config: AIConfig): string {
  if (config.customEndpoint && config.customEndpoint.trim().length > 0) {
    return config.customEndpoint.trim();
  }
  const preset = PROVIDER_PRESETS.find(p => p.id === config.provider);
  return preset?.defaultEndpoint ?? "https://openrouter.ai/api/v1/chat/completions";
}

/** Whether to attach OpenRouter-only attribution headers (HTTP-Referer, X-Title). */
export function shouldSendOpenRouterHeaders(config: AIConfig): boolean {
  return PROVIDER_PRESETS.find(p => p.id === config.provider)?.isOpenRouter ?? false;
}

interface AISettingsProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onConfigChange: (config: AIConfig) => void;
}

export default function AISettings({ isOpen, onClose, config, onConfigChange }: AISettingsProps) {
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [showProviderList, setShowProviderList] = useState(false);
  const [showModelList, setShowModelList] = useState(false);
  const [testState, setTestState] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string>("");

  const handleSave = useCallback(() => {
    saveAIConfig(localConfig);
    onConfigChange(localConfig);
    onClose();
  }, [localConfig, onConfigChange, onClose]);

  const selectedProvider = PROVIDER_PRESETS.find(p => p.id === localConfig.provider) ?? PROVIDER_PRESETS[0];
  const effectiveEndpoint = getEndpointForConfig(localConfig);

  const setProvider = useCallback((p: AIProvider) => {
    setLocalConfig(c => {
      const preset = PROVIDER_PRESETS.find(x => x.id === p);
      const stillValid = preset?.suggestedModels.some(m => m.id === c.model);
      const nextModel = stillValid ? c.model : (preset?.suggestedModels[0]?.id ?? c.model);
      return {
        ...c,
        provider: p,
        model: nextModel,
        customEndpoint: p === "custom" ? c.customEndpoint : undefined,
      };
    });
    setShowProviderList(false);
    setTestState("idle");
  }, []);

  const runTest = useCallback(async () => {
    setTestState("running");
    setTestMessage("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (selectedProvider.needsKey && localConfig.apiKey) {
        headers["Authorization"] = `Bearer ${localConfig.apiKey}`;
      }
      if (selectedProvider.isOpenRouter) {
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "FICSIT Automation Tracker";
      }
      const resp = await fetch(effectiveEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: localConfig.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          temperature: 0,
        }),
      });
      if (resp.ok) {
        setTestState("ok");
        setTestMessage("Connection looks good.");
      } else {
        const err = await resp.text();
        setTestState("error");
        setTestMessage(`HTTP ${resp.status}: ${err.slice(0, 200)}`);
      }
    } catch (e: unknown) {
      setTestState("error");
      setTestMessage(e instanceof Error ? e.message : "Network error");
    }
  }, [selectedProvider, localConfig, effectiveEndpoint]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute inset-x-0 top-0 z-50 bg-card border-b border-border shadow-lg"
        >
          <div className="p-4 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                AI Settings
              </h3>
              <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Provider</label>
              <button
                onClick={() => setShowProviderList(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded bg-background/80 border border-border/50 text-sm text-foreground hover:border-primary/50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-xs font-medium">{selectedProvider.label}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedProvider.description}</p>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showProviderList && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showProviderList && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pt-1">
                      {PROVIDER_PRESETS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setProvider(p.id)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded text-left transition-colors",
                            localConfig.provider === p.id
                              ? "bg-primary/10 border border-primary/30"
                              : "bg-secondary/30 hover:bg-secondary/50",
                          )}
                        >
                          <div>
                            <p className="text-xs font-medium">{p.label}</p>
                            <p className="text-[10px] text-muted-foreground">{p.description}</p>
                          </div>
                          {localConfig.provider === p.id && <Check className="w-3.5 h-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</label>
              <input
                type="text"
                value={localConfig.model}
                onChange={e => setLocalConfig(c => ({ ...c, model: e.target.value }))}
                placeholder="model id"
                className="w-full text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
              {selectedProvider.suggestedModels.length > 0 && (
                <div className="space-y-1">
                  <button
                    onClick={() => setShowModelList(v => !v)}
                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <ChevronDown className={cn("w-3 h-3 transition-transform", showModelList && "rotate-180")} />
                    Suggested for {selectedProvider.label}
                  </button>
                  <AnimatePresence>
                    {showModelList && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-0.5">
                          {selectedProvider.suggestedModels.map(m => (
                            <button
                              key={m.id}
                              onClick={() => setLocalConfig(c => ({ ...c, model: m.id }))}
                              className={cn(
                                "w-full text-left px-2 py-1 rounded text-[11px] transition-colors",
                                localConfig.model === m.id
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:bg-secondary/40",
                              )}
                            >
                              {m.label} <span className="font-mono opacity-60">{m.id}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {selectedProvider.needsKey && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Key</label>
                <input
                  type="password"
                  placeholder={selectedProvider.id === "openrouter" ? "sk-or-..." : "sk-..."}
                  value={localConfig.apiKey}
                  onChange={e => setLocalConfig(c => ({ ...c, apiKey: e.target.value }))}
                  className="w-full text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                {selectedProvider.id === "openrouter" && (
                  <p className="text-[10px] text-muted-foreground">
                    Get a free key at{" "}
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      openrouter.ai <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {localConfig.provider === "custom" ? "Endpoint URL" : "Override endpoint (optional)"}
              </label>
              <input
                type="text"
                placeholder={selectedProvider.defaultEndpoint || "https://…/v1/chat/completions"}
                value={localConfig.customEndpoint ?? ""}
                onChange={e => setLocalConfig(c => ({ ...c, customEndpoint: e.target.value || undefined }))}
                className="w-full text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
              <p className="text-[10px] text-muted-foreground/70 break-all">
                Effective: <span className="font-mono">{effectiveEndpoint || "(not set)"}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={runTest}
                disabled={testState === "running" || (selectedProvider.needsKey && !localConfig.apiKey)}
                className="w-full py-2 rounded bg-secondary/40 text-foreground text-xs font-medium hover:bg-secondary/70 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testState === "running" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlugZap className="w-3.5 h-3.5" />
                )}
                Test connection
              </button>
              {testState === "ok" && (
                <p className="text-[11px] text-neon-green flex items-center gap-1">
                  <Check className="w-3 h-3" /> {testMessage}
                </p>
              )}
              {testState === "error" && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {testMessage}
                </p>
              )}
            </div>

            <button
              onClick={handleSave}
              className="w-full py-2 rounded bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

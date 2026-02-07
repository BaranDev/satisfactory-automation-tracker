import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  X,
  ExternalLink,
  Check,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIConfig {
  provider: "openrouter" | "anthropic" | "openai" | "custom";
  model: string;
  apiKey: string;
  customEndpoint?: string;
}

const STORAGE_KEY_CONFIG = "ai-chat-config";

const MODEL_PRESETS = [
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", description: "Best reasoning", provider: "openrouter" as const },
  { id: "openai/gpt-4o", label: "GPT-4o", description: "Fast and capable", provider: "openrouter" as const },
  { id: "z-ai/glm-4.5-air:free", label: "GLM-4.5 Air (Free)", description: "No cost", provider: "openrouter" as const },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B", description: "Open source", provider: "openrouter" as const },
  { id: "custom", label: "Custom Model", description: "Enter any model ID", provider: "custom" as const },
];

export function loadAIConfig(): AIConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (stored) {
      return JSON.parse(stored) as AIConfig;
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
  // Also keep backward compat with old key storage
  if (config.apiKey) {
    localStorage.setItem("openrouter-api-key", config.apiKey);
  }
}

export function getEndpointForConfig(config: AIConfig): string {
  if (config.customEndpoint) return config.customEndpoint;
  return "https://openrouter.ai/api/v1/chat/completions";
}

interface AISettingsProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onConfigChange: (config: AIConfig) => void;
}

export default function AISettings({ isOpen, onClose, config, onConfigChange }: AISettingsProps) {
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [showModelList, setShowModelList] = useState(false);

  const handleSave = useCallback(() => {
    saveAIConfig(localConfig);
    onConfigChange(localConfig);
    onClose();
  }, [localConfig, onConfigChange, onClose]);

  const selectedPreset = MODEL_PRESETS.find(p => p.id === localConfig.model);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute inset-x-0 top-0 z-50 bg-card border-b border-border shadow-lg"
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                AI Settings
              </h3>
              <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Model Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Model
              </label>
              <button
                onClick={() => setShowModelList(!showModelList)}
                className="w-full flex items-center justify-between px-3 py-2 rounded bg-background/80 border border-border/50 text-sm text-foreground hover:border-primary/50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-xs font-medium">{selectedPreset?.label ?? localConfig.model}</p>
                  {selectedPreset && (
                    <p className="text-[10px] text-muted-foreground">{selectedPreset.description}</p>
                  )}
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showModelList && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showModelList && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1 pt-1">
                      {MODEL_PRESETS.map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setLocalConfig(c => ({ ...c, model: preset.id }));
                            setShowModelList(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded text-left transition-colors",
                            localConfig.model === preset.id
                              ? "bg-primary/10 border border-primary/30"
                              : "bg-secondary/30 hover:bg-secondary/50",
                          )}
                        >
                          <div>
                            <p className="text-xs font-medium">{preset.label}</p>
                            <p className="text-[10px] text-muted-foreground">{preset.description}</p>
                          </div>
                          {localConfig.model === preset.id && (
                            <Check className="w-3.5 h-3.5 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Custom Model ID */}
            {localConfig.model === "custom" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Custom Model ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. anthropic/claude-3-opus"
                  value={localConfig.model === "custom" ? "" : localConfig.model}
                  onChange={e => setLocalConfig(c => ({ ...c, model: e.target.value || "custom" }))}
                  className="w-full text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            )}

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                API Key
              </label>
              <input
                type="password"
                placeholder="sk-or-..."
                value={localConfig.apiKey}
                onChange={e => setLocalConfig(c => ({ ...c, apiKey: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
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
            </div>

            {/* Custom Endpoint */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Custom Endpoint (optional)
              </label>
              <input
                type="text"
                placeholder="https://openrouter.ai/api/v1/chat/completions"
                value={localConfig.customEndpoint ?? ""}
                onChange={e => setLocalConfig(c => ({ ...c, customEndpoint: e.target.value || undefined }))}
                className="w-full text-xs px-3 py-2 rounded bg-background/80 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <p className="text-[10px] text-muted-foreground">
                For self-hosted models or alternative providers
              </p>
            </div>

            {/* Save Button */}
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

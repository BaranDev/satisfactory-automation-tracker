import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Plus,
  Link2,
  Factory,
  Zap,
  Share2,
  Bot,
  TrendingUp,
  Github,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/store/projectStore";

const FEATURES = [
  {
    icon: Factory,
    title: "Drag & Drop Factory Builder",
    description:
      "Build your production line visually. Drag items onto the factory floor and configure machines with intuitive controls.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: TrendingUp,
    title: "Real-Time Simulation",
    description:
      "Instantly calculate production rates, detect bottlenecks, and see total yields as you modify your factory.",
    color: "text-neon-cyan",
    bg: "bg-neon-cyan/10",
  },
  {
    icon: Bot,
    title: "AI-Powered Optimization",
    description:
      "Chat with FICSIT AI to get factory suggestions, resolve bottlenecks, and plan complex production chains.",
    color: "text-neon-green",
    bg: "bg-neon-green/10",
  },
  {
    icon: Share2,
    title: "Cloud Sync & Sharing",
    description:
      "Save your factory to the cloud and share it with friends. No account needed -- just share the link.",
    color: "text-ficsit-amber",
    bg: "bg-ficsit-amber/10",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [projectLink, setProjectLink] = useState("");
  const [projectName, setProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { createProject } = useProjectStore();

  const handleCreate = async () => {
    setIsCreating(true);
    const project = await createProject(projectName || "New Factory");
    if (project) {
      navigate(`/p/${project.project_id}`);
    }
    setIsCreating(false);
  };

  const handleJoin = () => {
    const match = projectLink.match(/\/p\/([a-zA-Z0-9_-]+)/);
    if (match) {
      navigate(`/p/${match[1]}`);
    } else if (projectLink.length > 0) {
      navigate(`/p/${projectLink}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="h-14 flex items-center justify-between px-6 border-b border-border/30 glass-strong">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center glow-orange">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-foreground tracking-tight">
            FICSIT Tracker
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold tracking-wider">
            BETA
          </span>
        </div>
        <a
          href="https://github.com/BaranDev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Github className="w-4 h-4" />
          BaranDev
        </a>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 hex-grid-bg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-5xl"
        >
          {/* Hero Text */}
          <div className="text-center mb-14">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="inline-flex items-center gap-3 mb-6"
            >
              <div className="w-16 h-16 rounded-xl bg-primary/15 flex items-center justify-center glow-orange">
                <Factory className="w-8 h-8 text-primary" />
              </div>
            </motion.div>

            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
              <span className="text-foreground">FICSIT </span>
              <span className="text-primary text-glow-orange">Automation</span>
              <span className="text-foreground"> Tracker</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Plan, simulate, and optimize your Satisfactory factory production
              lines. Track automated items, detect bottlenecks, and get
              AI-powered optimization suggestions.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto mb-16">
            {/* Create */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-lg p-6"
            >
              <div className="flex items-center gap-2 mb-1">
                <Plus className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">
                  New Factory
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Start a fresh production tracker
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="Factory name (optional)"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="bg-background/50 border-border/50"
                />
                <Button
                  onClick={handleCreate}
                  disabled={isCreating}
                  variant="neon"
                  className="w-full gap-2"
                >
                  {isCreating ? "Creating..." : "Create Project"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>

            {/* Join */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-lg p-6"
            >
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold text-foreground">
                  Join Factory
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Open an existing project by link or ID
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="Paste link or project ID"
                  value={projectLink}
                  onChange={(e) => setProjectLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="bg-background/50 border-border/50"
                />
                <Button
                  onClick={handleJoin}
                  disabled={!projectLink}
                  variant="neon-pink"
                  className="w-full gap-2"
                >
                  Join Project
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Features Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="max-w-4xl mx-auto"
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="glass rounded-lg p-4 group hover:border-primary/20 transition-all"
                >
                  <div
                    className={`w-9 h-9 rounded-lg ${feature.bg} flex items-center justify-center mb-3`}
                  >
                    <feature.icon className={`w-4 h-4 ${feature.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="h-12 flex items-center justify-between px-6 border-t border-border/30 glass-strong">
        <p className="text-xs text-muted-foreground">
          FICSIT Automation Tracker{" "}
          <span className="text-primary/70">BETA</span> -- Built for the
          Satisfactory community
        </p>
        <a
          href="https://github.com/BaranDev"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          by BaranDev
          <ExternalLink className="w-3 h-3" />
        </a>
      </footer>
    </div>
  );
}

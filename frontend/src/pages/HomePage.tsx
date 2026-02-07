import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Link2, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProjectStore } from "@/store/projectStore";

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
    // Extract project ID from link
    const match = projectLink.match(/\/p\/([a-zA-Z0-9_-]+)/);
    if (match) {
      navigate(`/p/${match[1]}`);
    } else if (projectLink.length > 0) {
      // Assume it's just the ID
      navigate(`/p/${projectLink}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        {/* Hero */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-3 mb-6"
          >
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center neon-cyan">
              <Zap className="w-8 h-8 text-primary" />
            </div>
          </motion.div>

          <h1 className="text-5xl font-bold mb-4 text-glow-cyan">
            Satisfactory Tracker
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Track automated items, simulate production rates, and optimize your
            factory. Share with friends — no account needed.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Create New Project */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  Create New Project
                </CardTitle>
                <CardDescription>
                  Start tracking a new factory from scratch
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Factory name (optional)"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="bg-background/50"
                />
                <Button
                  onClick={handleCreate}
                  disabled={isCreating}
                  variant="neon"
                  className="w-full"
                >
                  {isCreating ? "Creating..." : "Create Project"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Join Existing Project */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-accent" />
                  Join Project
                </CardTitle>
                <CardDescription>
                  Paste a share link or project ID to join
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Paste link or project ID"
                  value={projectLink}
                  onChange={(e) => setProjectLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  className="bg-background/50"
                />
                <Button
                  onClick={handleJoin}
                  disabled={!projectLink}
                  variant="neon-pink"
                  className="w-full"
                >
                  Join Project
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-green" />
              Real-time simulation
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-cyan" />
              Bottleneck detection
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-pink" />
              Shareable links
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-orange" />
              PDF export
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

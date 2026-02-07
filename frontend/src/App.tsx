import { Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-primary/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-accent/10 via-transparent to-transparent blur-3xl" />
      </div>

      <Outlet />
      <Toaster />
    </div>
  );
}

export default App;

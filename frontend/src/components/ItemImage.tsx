import { useState, memo } from "react";
import { cn } from "@/lib/utils";

const ASSETS_BASE = import.meta.env.VITE_ASSETS_BASE_URL || "/api/assets";

// Color palette based on item category
const CATEGORY_COLORS: Record<string, string> = {
  resource: "from-amber-600/40 to-amber-800/60",
  ingot: "from-orange-600/40 to-orange-800/60",
  part: "from-sky-600/40 to-sky-800/60",
  intermediate: "from-violet-600/40 to-violet-800/60",
  fluid: "from-cyan-600/40 to-cyan-800/60",
  fuel: "from-red-600/40 to-red-800/60",
  nuclear: "from-green-600/40 to-green-800/60",
  alien: "from-pink-600/40 to-pink-800/60",
  elevator: "from-yellow-600/40 to-yellow-800/60",
};

interface ItemImageProps {
  icon: string;
  label: string;
  category?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const ItemImage = memo(function ItemImage({
  icon,
  label,
  category = "part",
  size = "md",
  className,
}: ItemImageProps) {
  const [failed, setFailed] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };

  const textSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  const src = `${ASSETS_BASE}/${icon}`;
  const gradient = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.part;

  if (failed) {
    return (
      <div
        className={cn(
          "rounded-md flex items-center justify-center bg-gradient-to-br",
          gradient,
          sizeClasses[size],
          className,
        )}
        title={label}
      >
        <span
          className={cn(
            "font-bold text-white/80 uppercase leading-none",
            textSizes[size],
          )}
        >
          {label.slice(0, 2)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      loading="lazy"
      className={cn(
        "rounded-md object-contain bg-zinc-800/50",
        sizeClasses[size],
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
});

import React, { useState, useRef, useEffect } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "../context/ThemeContext";

const OPTIONS: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "", icon: Sun },
  { value: "dark", label: "", icon: Moon },
  { value: "system", label: "", icon: Monitor },
];

interface ThemeSwitcherProps {
  collapsed?: boolean;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ collapsed = false }) => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];

  if (collapsed) {
    return (
      <div className="relative mb-2" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          title={`Theme: ${current.label}`}
          className="w-full flex items-center justify-center p-2 rounded-md transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--border-subtle)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <current.icon className="w-4 h-4" />
        </button>
        {open && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 rounded-md shadow-xl border py-1 z-50"
            style={{
              background: "var(--bg-tertiary)",
              borderColor: "var(--border-subtle)",
            }}
          >
            {OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                title={label}
                className="flex items-center justify-center w-9 h-8 transition-colors"
                style={{
                  color: theme === value ? "var(--accent-primary)" : "var(--text-secondary)",
                  background: theme === value ? "var(--accent-light)" : "transparent",
                }}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 mb-2">
      <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
        Theme
      </p>
      <div
        className="flex rounded-md p-0.5 gap-0.5"
        style={{
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            title={label}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors"
            style={{
              color: theme === value ? "var(--accent-primary)" : "var(--text-secondary)",
              background: theme === value ? "var(--accent-light)" : "transparent",
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

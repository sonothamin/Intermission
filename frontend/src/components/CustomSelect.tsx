import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  align?: "left" | "right";
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  className = "",
  buttonClassName = "",
  placeholder,
  icon,
  align = "left"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options.find((opt) => opt.value.toString() === value?.toString());

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-between w-full h-full bg-transparent outline-none focus:ring-0 ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {icon}
          {selectedOption ? selectedOption.label : placeholder || "Select..."}
        </span>
        <ChevronDown className="w-3 h-3 opacity-50 ml-1.5 flex-shrink-0" />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-1 max-h-60 overflow-auto rounded-md shadow-xl border ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{
            background: "var(--bg-tertiary)",
            borderColor: "var(--border-subtle)",
            minWidth: "100%",
            width: "max-content",
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(option.value.toString());
                setIsOpen(false);
              }}
              className="w-full text-left text-sm transition-colors whitespace-nowrap"
              style={{
                padding: "0.375rem 0.875rem",
                color:
                  option.value.toString() === value?.toString()
                    ? "var(--accent-primary)"
                    : "var(--text-primary)",
                fontWeight:
                  option.value.toString() === value?.toString() ? 600 : 400,
                background:
                  option.value.toString() === value?.toString()
                    ? "var(--accent-light)"
                    : "transparent",
              }}
              onMouseEnter={(e) => {
                if (option.value.toString() !== value?.toString()) {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "var(--border-subtle)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  option.value.toString() === value?.toString()
                    ? "var(--accent-light)"
                    : "transparent";
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

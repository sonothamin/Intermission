import React from "react";
import { Film } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-theme-primary">
      {/* Left Pane: Minimal Branding */}
      <div
        className="hidden lg:flex flex-col items-center justify-center border-r border-theme relative overflow-hidden p-12"
        style={{
          background: "linear-gradient(to bottom right, var(--auth-panel-from), var(--auth-panel-via), var(--auth-panel-to))",
        }}
      >
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#10b981]/5 filter blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10b981]/3 filter blur-[120px] rounded-full pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-6 text-center select-none animate-fade-in">
          <div
            className="p-5 rounded-2xl border border-theme shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 group"
            style={{
              background: "linear-gradient(to bottom, var(--auth-card-from), var(--auth-card-to))",
            }}
          >
            <Film className="w-16 h-16 text-[#10b981] transition-transform duration-500 group-hover:rotate-12" />
          </div>
          <div className="space-y-2">
            <h1
              className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(to bottom, var(--auth-title-gradient-from), var(--auth-title-gradient-to))",
              }}
            >
              Intermission
            </h1>
            <p className="text-sm text-theme-muted tracking-widest uppercase font-semibold">
              Your Cinema Journey
            </p>
          </div>
        </div>
      </div>

      {/* Right Pane: Authentication Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
        <div className="w-full max-w-md space-y-8 py-8">
          {/* Mobile-only Branding Header */}
          <div className="lg:hidden flex flex-col items-center gap-3 text-center mb-8">
            <div
              className="p-3.5 rounded-xl border border-theme shadow-lg"
              style={{
                background: "linear-gradient(to bottom, var(--auth-card-from), var(--auth-card-to))",
              }}
            >
              <Film className="w-8 h-8 text-[#10b981]" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-theme-primary">
              Intermission
            </h1>
          </div>

          {/* Form wrapper */}
          <div className="animate-fade-in-up">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

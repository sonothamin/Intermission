import React from "react";
import { Film } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#0a0a0a]">
      {/* Left Pane: Minimal Branding */}
      <div className="hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-[#141414] via-[#0d0d0d] to-[#0a0a0a] border-r border-[#27272a] relative overflow-hidden p-12">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#10b981]/5 filter blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10b981]/3 filter blur-[120px] rounded-full pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-6 text-center select-none animate-fade-in">
          <div className="p-5 rounded-2xl bg-gradient-to-b from-[#1a1a1a] to-[#121212] border border-[#27272a] shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 group">
            <Film className="w-16 h-16 text-[#10b981] transition-transform duration-500 group-hover:rotate-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-[#ffffff] to-[#a1a1aa]">
              Intermission
            </h1>
            <p className="text-sm text-[#52525b] tracking-widest uppercase font-semibold">
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
            <div className="p-3.5 rounded-xl bg-gradient-to-b from-[#1a1a1a] to-[#121212] border border-[#27272a] shadow-lg">
              <Film className="w-8 h-8 text-[#10b981]" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#ededed]">
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

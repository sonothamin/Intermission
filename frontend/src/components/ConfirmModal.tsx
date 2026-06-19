import React, { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-[#10b981]/10 text-[#10b981]'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 mt-1">
              <h3 className="text-lg font-semibold text-[#ededed]">{title}</h3>
              <p className="mt-2 text-sm text-[#a1a1aa] leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#0a0a0a] border-t border-[#27272a]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#ededed] bg-[#27272a] border border-[#3f3f46] rounded-md hover:bg-[#3f3f46] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isDestructive
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-[#10b981] hover:bg-[#059669] text-black"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

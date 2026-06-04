import React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  subtitle?: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles = {
  danger: {
    iconBg: "bg-red-500/20 border-red-500/30",
    icon: "text-red-400",
    button: "bg-red-600 hover:bg-red-700",
  },
  warning: {
    iconBg: "bg-amber-500/20 border-amber-500/30",
    icon: "text-amber-400",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  primary: {
    iconBg: "bg-indigo-500/20 border-indigo-500/30",
    icon: "text-indigo-400",
    button: "bg-indigo-600 hover:bg-indigo-700",
  },
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  subtitle,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
}) => {
  const styles = variantStyles[variant];

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-md p-6 relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center border ${styles.iconBg}`}
          >
            <AlertTriangle size={24} className={styles.icon} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {subtitle ? (
              <p className="text-sm text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <p className="text-slate-300 text-sm leading-relaxed mb-6">{message}</p>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 text-white rounded-lg font-medium transition-colors ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return null;
};

export default ConfirmModal;

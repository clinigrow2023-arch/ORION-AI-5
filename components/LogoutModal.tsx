import React from "react";
import { createPortal } from "react-dom";
import { LogOut, X } from "lucide-react";
import { useTranslation } from "../contexts/I18nContext";

interface LogoutModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const LogoutModal: React.FC<LogoutModalProps> = ({ onConfirm, onCancel }) => {
  const { t } = useTranslation();

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
          onClick={onCancel}
          aria-label={t("common.close")}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30">
            <LogOut size={24} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              {t("logoutModal.title")}
            </h2>
            <p className="text-sm text-slate-400">
              {t("logoutModal.subtitle")}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-slate-300 text-sm leading-relaxed">
            {t("logoutModal.message")}
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            {t("logoutModal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );

  // Renderizar modal usando Portal diretamente no body
  if (typeof window !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
};

export default LogoutModal;


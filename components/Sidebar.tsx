import React, { useState } from "react";
import {
  MessageSquare,
  FileText,
  BookOpen,
  LogOut,
  User,
  Shield,
  Lock,
  Mail,
  Loader2,
} from "lucide-react";
import { ViewState } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../contexts/I18nContext";
import ChangePassword from "./ChangePassword";
import LanguageSelector from "./LanguageSelector";
import LogoutModal from "./LogoutModal";
import OrionLogo from "./OrionLogo";

interface SidebarProps {
  currentView: ViewState | "admin";
  setView: (view: ViewState | "admin") => void;
  planNotice?: "pending" | "ready" | null;
  hasSavedPlan?: boolean;
  onOpenReadyPlan?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  planNotice,
  onOpenReadyPlan,
}) => {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <div className="w-full md:w-72 md:min-w-[16rem] md:max-w-[19rem] bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-4 md:p-6 flex items-center gap-2 border-b border-slate-800 min-w-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0 md:mt-0 mt-16 overflow-hidden bg-slate-950 ring-1 ring-indigo-500/40">
          <OrionLogo size={32} className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight md:mt-0 mt-16 min-w-0 truncate">
          {t("app.name")}
        </h1>
      </div>

      {/* User Info */}
      {user && (
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg min-w-0">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
              <User size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate" title={user.name}>
                {user.name}
              </p>
              <p className="text-xs text-slate-400 truncate" title={user.email}>
                {user.email}
              </p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <button
          onClick={() => setView("chat")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 min-w-0 ${
            currentView === "chat"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <MessageSquare size={20} className="shrink-0" />
          <span className="font-medium min-w-0 flex-1 text-left leading-snug break-words">
            {t("sidebar.chat")}
          </span>
        </button>

        <button
          onClick={() => {
            if (planNotice === "ready" && onOpenReadyPlan) {
              onOpenReadyPlan();
              return;
            }
            setView("plan");
          }}
          className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg transition-all duration-200 min-w-0 ${
            currentView === "plan"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <FileText size={20} className="shrink-0" />
          <span className="font-medium flex-1 min-w-0 text-left leading-snug break-words">
            {t("sidebar.plan")}
          </span>
          {planNotice === "pending" && (
            <Loader2
              size={16}
              className="animate-spin text-amber-300 shrink-0"
            />
          )}
          {planNotice === "ready" && (
            <span className="text-[10px] font-semibold bg-emerald-600 text-white px-1.5 py-0.5 rounded animate-pulse shrink-0 normal-case tracking-normal">
              {t("sidebar.planReady")}
            </span>
          )}
        </button>

        <button
          onClick={() => setView("guide")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 min-w-0 ${
            currentView === "guide"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <BookOpen size={20} className="shrink-0" />
          <span className="font-medium min-w-0 flex-1 text-left leading-snug break-words">
            {t("sidebar.guide")}
          </span>
        </button>

        <button
          onClick={() => setView("support")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 min-w-0 ${
            currentView === "support"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Mail size={20} className="shrink-0" />
          <span className="font-medium min-w-0 flex-1 text-left leading-snug break-words">
            {t("sidebar.support")}
          </span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setView("admin")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 min-w-0 ${
              currentView === "admin"
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Shield size={20} className="shrink-0" />
            <span className="font-medium min-w-0 flex-1 text-left leading-snug break-words">
              {t("sidebar.admin")}
            </span>
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-xs text-slate-400 leading-relaxed break-words">
            {t("sidebar.quote")}
          </p>
          <p className="text-xs text-indigo-400 mt-1 font-semibold break-words">
            {t("sidebar.quoteAuthor")}
          </p>
        </div>
        <LanguageSelector variant="sidebar" />
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition-all duration-200 min-w-0"
        >
          <Lock size={20} className="shrink-0" />
          <span className="font-medium min-w-0 flex-1 text-left leading-snug break-words text-sm">
            {t("sidebar.changePassword")}
          </span>
        </button>
        <button
          onClick={() => setShowLogoutModal(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-all duration-200 min-w-0"
        >
          <LogOut size={20} className="shrink-0" />
          <span className="font-medium min-w-0 flex-1 text-left leading-snug break-words">
            {t("sidebar.signOut")}
          </span>
        </button>
      </div>

      {showChangePassword && (
        <ChangePassword onClose={() => setShowChangePassword(false)} />
      )}

      {showLogoutModal && (
        <LogoutModal
          onConfirm={() => {
            setShowLogoutModal(false);
            logout();
          }}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
    </div>
  );
};

export default Sidebar;

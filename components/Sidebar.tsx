import React, { useState } from "react";
import {
  MessageSquare,
  FileText,
  BookOpen,
  Star,
  LogOut,
  User,
  Shield,
  Lock,
} from "lucide-react";
import { ViewState } from "../types";
import { useAuth } from "../contexts/AuthContext";
import ChangePassword from "./ChangePassword";
import LogoutModal from "./LogoutModal";

interface SidebarProps {
  currentView: ViewState | "admin";
  setView: (view: ViewState | "admin") => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const { user, logout, isAdmin } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  return (
    <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-6 flex items-center gap-2 border-b border-slate-800">
        <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Star className="w-5 h-5 text-white fill-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Orion AI
        </h1>
      </div>

      {/* User Info */}
      {user && (
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
              {user.accessExpiresAt && (
                <p
                  className={`text-xs mt-1 ${
                    new Date(user.accessExpiresAt) < new Date()
                      ? "text-red-400"
                      : "text-indigo-400"
                  }`}
                >
                  {new Date(user.accessExpiresAt) < new Date()
                    ? `Access expired on ${new Date(
                        user.accessExpiresAt
                      ).toLocaleDateString()}`
                    : `Access until ${new Date(
                        user.accessExpiresAt
                      ).toLocaleDateString()}`}
                </p>
              )}
              {!user.isActive && !user.accessExpiresAt && (
                <p className="text-xs text-orange-400 mt-1">Access pending</p>
              )}
              {!user.isActive && user.accessExpiresAt && (
                <p className="text-xs text-orange-400 mt-1">Access revoked</p>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => setView("chat")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
            currentView === "chat"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <MessageSquare size={20} />
          <span className="font-medium">Mentor Chat</span>
        </button>

        <button
          onClick={() => setView("plan")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
            currentView === "plan"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <FileText size={20} />
          <span className="font-medium">My Action Plan</span>
        </button>

        <button
          onClick={() => setView("guide")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
            currentView === "guide"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <BookOpen size={20} />
          <span className="font-medium">Strategy Guide</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setView("admin")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentView === "admin"
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Shield size={20} />
            <span className="font-medium">Admin Dashboard</span>
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-xs text-slate-400 leading-relaxed">
            "Emotions are the fuel, but strategy is the engine."
          </p>
          <p className="text-xs text-indigo-400 mt-1 font-semibold">
            — Orion Philosophy
          </p>
        </div>
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition-all duration-200"
        >
          <Lock size={20} />
          <span className="font-medium">Change Password</span>
        </button>
        <button
          onClick={() => setShowLogoutModal(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-all duration-200"
        >
          <LogOut size={20} />
          <span className="font-medium">Sign Out</span>
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

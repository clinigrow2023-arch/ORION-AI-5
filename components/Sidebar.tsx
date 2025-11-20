import React from 'react';
import { MessageSquare, FileText, BookOpen, Star } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  return (
    <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-6 flex items-center gap-2 border-b border-slate-800">
        <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Star className="w-5 h-5 text-white fill-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Orion AI</h1>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => setView('chat')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
            currentView === 'chat'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <MessageSquare size={20} />
          <span className="font-medium">Mentor Chat</span>
        </button>

        <button
          onClick={() => setView('plan')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
            currentView === 'plan'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <FileText size={20} />
          <span className="font-medium">My Action Plan</span>
        </button>

        <button
          onClick={() => setView('guide')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
            currentView === 'guide'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <BookOpen size={20} />
          <span className="font-medium">Strategy Guide</span>
        </button>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-xs text-slate-400 leading-relaxed">
            "Emotions are the fuel, but strategy is the engine."
          </p>
          <p className="text-xs text-indigo-400 mt-1 font-semibold">— Orion Philosophy</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
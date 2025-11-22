import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import PlanDisplay from './components/PlanDisplay';
import GuideView from './components/GuideView';
import AdminDashboard from './components/AdminDashboard';
import Auth from './components/Auth';
import { useAuth } from './contexts/AuthContext';
import { ViewState, Message, ActionPlan, Sender } from './types';
import { Menu, X, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const { isAuthenticated, loading, isAdmin } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState | 'admin'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'admin':
        return <AdminDashboard />;
      case 'chat':
        return <ChatInterface messages={messages} addMessage={addMessage} />;
      case 'plan':
        return <PlanDisplay plan={plan} setPlan={setPlan} />;
      case 'guide':
        return <GuideView />;
      default:
        return <ChatInterface messages={messages} addMessage={addMessage} />;
    }
  };

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={48} />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Mostrar tela de autenticação se não estiver autenticado
  if (!isAuthenticated) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile Menu Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-slate-800 text-white rounded-lg shadow-lg border border-slate-700"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Hidden on mobile unless toggled */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar currentView={currentView} setView={(view) => {
          setCurrentView(view);
          setIsMobileMenuOpen(false);
        }} />
      </div>

      {/* Main Content */}
      <main className="flex-1 h-full relative w-full">
        {renderContent()}
      </main>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
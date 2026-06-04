import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ResetChatModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const ResetChatModal: React.FC<ResetChatModalProps> = ({ onConfirm, onCancel }) => {
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
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center border border-orange-500/30">
            <AlertTriangle size={24} className="text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Reset Chat</h2>
            <p className="text-sm text-slate-400">Start a new conversation</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-slate-300 text-sm leading-relaxed">
            Are you sure you want to reset this chat? All messages will be permanently deleted from your account
            and you will start fresh. This action cannot be undone.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
          >
            Reset Chat
          </button>
        </div>
      </div>
    </div>
  );

  // Renderizar modal usando Portal diretamente no body
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  
  return null;
};

export default ResetChatModal;


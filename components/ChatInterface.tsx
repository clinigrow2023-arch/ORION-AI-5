import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { Message, Sender } from '../types';
import { geminiService } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  messages: Message[];
  addMessage: (msg: Message) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, addMessage }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamedResponse, setStreamedResponse] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedResponse]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: Sender.User,
      timestamp: new Date()
    };

    addMessage(userMsg);
    setInput('');
    setIsLoading(true);
    setStreamedResponse('');

    try {
      const fullResponse = await geminiService.sendMessageStream(input, (chunk) => {
        setStreamedResponse(prev => prev + chunk);
      });

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: fullResponse,
        sender: Sender.Bot,
        timestamp: new Date()
      };
      
      addMessage(botMsg);
    } catch (error: any) {
      let errorText = "I encountered an error processing your strategy. Please try again.";
      
      // Check for leaked API key error
      if (error?.message?.includes('vazada') || error?.message?.includes('leaked') || error?.code === 403) {
        errorText = `🔒 **Erro de Segurança Detectado**\n\nSua chave API foi reportada como vazada pelo Google.\n\n**Para resolver:**\n1. Acesse [Google AI Studio](https://aistudio.google.com/apikey)\n2. Gere uma nova chave API\n3. Atualize o arquivo \`.env\` com a nova chave:\n   \`GEMINI_API_KEY=sua_nova_chave_aqui\`\n4. Reinicie o servidor (\`npm run dev\`)`;
      } else if (error?.message?.includes('API key is missing')) {
        errorText = `⚠️ **Chave API não encontrada**\n\nPor favor, adicione sua chave API do Gemini no arquivo \`.env\`:\n\`GEMINI_API_KEY=sua_chave_aqui\`\n\nDepois, reinicie o servidor.`;
      }
      
      const errorMsg: Message = {
        id: Date.now().toString(),
        text: errorText,
        sender: Sender.Bot,
        timestamp: new Date()
      };
      addMessage(errorMsg);
    } finally {
      setIsLoading(false);
      setStreamedResponse('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <h2 className="text-lg font-semibold text-slate-200">Consultation Session</h2>
        <p className="text-sm text-slate-400">Provide details about your situation for analysis.</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <Bot size={48} className="text-indigo-500 mb-4" />
            <h3 className="text-xl font-medium text-slate-200">Welcome to Orion AI</h3>
            <p className="max-w-md mt-2 text-slate-400">
              Tell me about your relationship status. Why did it end? What is your goal? I will analyze and guide you.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 ${msg.sender === Sender.User ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              msg.sender === Sender.User ? 'bg-indigo-600' : 'bg-slate-700'
            }`}>
              {msg.sender === Sender.User ? <User size={20} /> : <Bot size={20} className="text-indigo-300" />}
            </div>
            
            <div className={`max-w-[80%] rounded-2xl p-4 ${
              msg.sender === Sender.User 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
            }`}>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
              <span className="text-[10px] opacity-50 mt-2 block">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {/* Streaming message placeholder */}
        {isLoading && streamedResponse && (
           <div className="flex gap-4 flex-row">
             <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-slate-700">
               <Bot size={20} className="text-indigo-300" />
             </div>
             <div className="max-w-[80%] rounded-2xl p-4 bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700">
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{streamedResponse}</ReactMarkdown>
                </div>
                <span className="flex gap-1 mt-2">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                </span>
             </div>
           </div>
        )}

        {isLoading && !streamedResponse && (
            <div className="flex items-center gap-2 text-slate-500 text-sm ml-14">
                <Loader2 className="animate-spin w-4 h-4" />
                <span>Analyzing situation...</span>
            </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <div className="relative flex items-center max-w-4xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the situation (e.g., 'She broke up with me yesterday because I was too needy...')"
            className="w-full bg-slate-800 text-slate-200 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 resize-none h-[60px] scrollbar-hide"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
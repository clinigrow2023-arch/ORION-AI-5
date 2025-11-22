import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, AlertCircle, Key } from "lucide-react";
import { Message, Sender } from "../types";
import { geminiService } from "../services/geminiService";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../lib/auth";
import ReactMarkdown from "react-markdown";

interface ChatInterfaceProps {
  messages: Message[];
  addMessage: (msg: Message) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  addMessage,
}) => {
  const { user, refreshUser } = useAuth();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamedResponse, setStreamedResponse] = useState("");
  const hasLoadedHistory = useRef(false);
  const messageIdCounter = useRef(0);

  // Função para gerar ID único
  const generateUniqueId = () => {
    messageIdCounter.current += 1;
    return `${Date.now()}-${messageIdCounter.current}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedResponse]);

  // Carregar histórico ao montar (apenas uma vez)
  useEffect(() => {
    // Evitar carregar múltiplas vezes
    if (hasLoadedHistory.current) return;

    const loadConversation = async () => {
      try {
        const token = authService.getToken();
        if (!token) return;

        // Se já tem mensagens, não carregar novamente
        if (messages.length > 0) {
          hasLoadedHistory.current = true;
          return;
        }

        const response = await fetch("/.netlify/functions/conversations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Carregar última conversa se existir
          if (data.conversations && data.conversations.length > 0) {
            const lastConv = data.conversations[0];
            if (
              lastConv.messages &&
              Array.isArray(lastConv.messages) &&
              lastConv.messages.length > 0
            ) {
              // Converter mensagens do histórico para o formato do componente
              const loadedMessages: Message[] = lastConv.messages.map(
                (msg: any, index: number) => ({
                  id: msg.id || generateUniqueId(),
                  text: msg.text || "",
                  sender: msg.sender === "user" ? Sender.User : Sender.Bot,
                  timestamp: msg.timestamp
                    ? new Date(msg.timestamp)
                    : new Date(),
                })
              );

              // Adicionar mensagens ao estado apenas se ainda não foram carregadas
              if (loadedMessages.length > 0 && messages.length === 0) {
                hasLoadedHistory.current = true;
                // Verificar duplicação antes de adicionar
                const existingIds = new Set(messages.map((m) => m.id));
                const uniqueMessages = loadedMessages.filter(
                  (msg) => !existingIds.has(msg.id)
                );

                // Adicionar todas as mensagens de uma vez
                uniqueMessages.forEach((msg) => addMessage(msg));
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to load conversation:", error);
      }
    };

    loadConversation();
  }, [messages.length, addMessage]);

  const saveConversation = async (allMessages: Message[]) => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const messagesToSave = allMessages.map((msg) => ({
        id: msg.id,
        text: msg.text,
        sender: msg.sender === Sender.User ? "user" : "bot",
        timestamp: msg.timestamp.toISOString(),
      }));

      const response = await fetch("/.netlify/functions/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: messagesToSave }),
      });

      if (response.ok) {
        // Conversa salva com sucesso - não precisa atualizar usuário
        // Removido refreshUser() para evitar requisições desnecessárias
      } else if (response.status === 403) {
        // Conta bloqueada
        const errorMsg: Message = {
          id: generateUniqueId(),
          text: "🚫 **Account Blocked**\n\nYour account has been blocked. Please contact an administrator.",
          sender: Sender.Bot,
          timestamp: new Date(),
        };
        addMessage(errorMsg);
        // Forçar logout e reload
        setTimeout(() => {
          authService.logout();
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error("Failed to save conversation:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Verificar se usuário tem acesso ANTES de enviar mensagem (para não gastar prompts)
    if (!user) return;

    // Bloquear se usuário está bloqueado
    if (user.isBlocked) {
      alert("Sua conta foi bloqueada. Entre em contato com um administrador.");
      return;
    }

    // Bloquear se usuário não tem acesso ativo (exceto admin)
    if (user.role !== "admin" && !user.isActive) {
      alert(
        "Seu acesso ainda não foi liberado. Entre em contato com um administrador."
      );
      return;
    }

    // Bloquear se acesso expirou (exceto admin) - VERIFICAR ANTES DE CHAMAR API
    const isExpired = user.role !== "admin" &&
      user.accessExpiresAt &&
      new Date(user.accessExpiresAt) < new Date();
    
    if (isExpired) {
      alert(
        "Seu acesso expirou. Entre em contato com um administrador para renovar."
      );
      return;
    }

    // Só adiciona mensagem e chama API se passou todas as validações
    const userMsg: Message = {
      id: generateUniqueId(),
      text: input,
      sender: Sender.User,
      timestamp: new Date(),
    };

    const currentMessages = [...messages, userMsg];
    addMessage(userMsg);
    setInput("");
    setIsLoading(true);
    setStreamedResponse("");

    try {
      const fullResponse = await geminiService.sendMessageStream(
        input,
        (chunk) => {
          setStreamedResponse((prev) => prev + chunk);
        }
      );

      const botMsg: Message = {
        id: generateUniqueId(),
        text: fullResponse,
        sender: Sender.Bot,
        timestamp: new Date(),
      };

      const updatedMessages = [...currentMessages, botMsg];
      addMessage(botMsg);

      // Salvar conversa após resposta completa
      await saveConversation(updatedMessages);
    } catch (error: any) {
      let errorText =
        "I encountered an error processing your strategy. Please try again.";

      // Check for leaked API key error
      if (
        error?.message?.includes("vazada") ||
        error?.message?.includes("leaked") ||
        error?.code === 403
      ) {
        errorText = `🔒 **Erro de Segurança Detectado**\n\nSua chave API foi reportada como vazada pelo Google.\n\n**Para resolver:**\n1. Acesse [Google AI Studio](https://aistudio.google.com/apikey)\n2. Gere uma nova chave API\n3. Atualize o arquivo \`.env\` com a nova chave:\n   \`GEMINI_API_KEY=sua_nova_chave_aqui\`\n4. Reinicie o servidor (\`npm run dev\`)`;
      } else if (error?.message?.includes("API key is missing")) {
        errorText = `⚠️ **Chave API não encontrada**\n\nPor favor, adicione sua chave API do Gemini no arquivo \`.env\`:\n\`GEMINI_API_KEY=sua_chave_aqui\`\n\nDepois, reinicie o servidor.`;
      } else if (
        error?.message?.includes("access not granted") ||
        error?.message?.includes("access has expired")
      ) {
        errorText =
          "⚠️ **Access Not Granted**\n\nYour account access has not been granted or has expired. Please contact an administrator to grant access.";
      }

      const errorMsg: Message = {
        id: generateUniqueId(),
        text: errorText,
        sender: Sender.Bot,
        timestamp: new Date(),
      };
      addMessage(errorMsg);
    } finally {
      setIsLoading(false);
      setStreamedResponse("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">
              Consultation Session
            </h2>
            <p className="text-sm text-slate-400">
              Provide details about your situation for analysis.
            </p>
          </div>
          {user?.accessExpiresAt && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              new Date(user.accessExpiresAt) < new Date()
                ? "bg-red-500/10 border-red-500/20"
                : "bg-slate-800 border-slate-700"
            }`}>
              <Key size={18} className={new Date(user.accessExpiresAt) < new Date() ? "text-red-400" : "text-indigo-400"} />
              <span className={`text-sm font-medium ${
                new Date(user.accessExpiresAt) < new Date()
                  ? "text-red-400"
                  : "text-slate-300"
              }`}>
                {new Date(user.accessExpiresAt) < new Date()
                  ? "Access expired on "
                  : "Access until "}
                {new Date(user.accessExpiresAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        {user && !user.isActive && (
          <div className="mt-3 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 text-orange-400 text-sm">
            <AlertCircle size={16} />
            <span>
              Your account access has not been granted. Please contact an
              administrator.
            </span>
          </div>
        )}
        {user?.accessExpiresAt &&
          new Date(user.accessExpiresAt) < new Date() && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>
                Your access has expired. Please contact an administrator to
                renew.
              </span>
            </div>
          )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <Bot size={48} className="text-indigo-500 mb-4" />
            <h3 className="text-xl font-medium text-slate-200">
              Welcome to Orion AI
            </h3>
            <p className="max-w-md mt-2 text-slate-400">
              Tell me about your relationship status. Why did it end? What is
              your goal? I will analyze and guide you.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 ${
              msg.sender === Sender.User ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                msg.sender === Sender.User ? "bg-indigo-600" : "bg-slate-700"
              }`}
            >
              {msg.sender === Sender.User ? (
                <User size={20} />
              ) : (
                <Bot size={20} className="text-indigo-300" />
              )}
            </div>

            <div
              className={`max-w-[80%] rounded-2xl p-4 ${
                msg.sender === Sender.User
                  ? "bg-indigo-600 text-white rounded-tr-none"
                  : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
              <span className="text-[10px] opacity-50 mt-2 block">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}

        {/* Streaming message placeholder */}
        {isLoading && streamedResponse && (
          <div className="flex gap-4 flex-row">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-slate-700">
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
            placeholder={
              !user
                ? "Please log in to use the chat"
                : user.isBlocked
                ? "Your account is blocked. Contact an administrator."
                : user.role !== "admin" && !user.isActive
                ? "Your access has not been granted. Contact an administrator."
                : user.role !== "admin" &&
                  user.accessExpiresAt &&
                  new Date(user.accessExpiresAt) < new Date()
                ? "Your access has expired. Contact an administrator to renew."
                : "Describe the situation (e.g., 'She broke up with me yesterday because I was too needy...')"
            }
            disabled={
              !user ||
              user.isBlocked ||
              (user.role !== "admin" && !user.isActive) ||
              (user.role !== "admin" &&
                user.accessExpiresAt &&
                new Date(user.accessExpiresAt) < new Date())
            }
            className="w-full bg-slate-800 text-slate-200 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 resize-none h-[60px] scrollbar-hide disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={
              !input.trim() ||
              isLoading ||
              !user ||
              user.isBlocked ||
              (user.role !== "admin" && !user.isActive) ||
              (user.role !== "admin" &&
                user.accessExpiresAt &&
                new Date(user.accessExpiresAt) < new Date())
            }
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

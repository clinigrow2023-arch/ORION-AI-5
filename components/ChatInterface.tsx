import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  AlertCircle,
  Key,
  RotateCcw,
  MessageSquare,
  Trash2,
  ChevronDown,
  X,
} from "lucide-react";
import { Message, Sender } from "../types";
import { geminiService } from "../services/geminiService";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../lib/auth";
import ReactMarkdown from "react-markdown";
import ResetChatModal from "./ResetChatModal";
import DeleteConversationModal from "./DeleteConversationModal";

interface ChatInterfaceProps {
  messages: Message[];
  addMessage: (msg: Message) => void;
  onResetChat: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  addMessage,
  onResetChat,
}) => {
  const { user, refreshUser } = useAuth();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamedResponse, setStreamedResponse] = useState("");
  const hasLoadedHistory = useRef(false);
  const messageIdCounter = useRef(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [conversations, setConversations] = useState<
    Array<{ id: string; createdAt: string; updatedAt: string }>
  >([]);
  const [showConversationsList, setShowConversationsList] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<{
    id: string;
    date: string;
  } | null>(null);

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

  // Verificar periodicamente se o acesso expirou (a cada 30 segundos)
  // Atualiza o estado do usuário quando a data de expiração é atingida
  useEffect(() => {
    if (!user || user.role === "admin") return;

    const checkExpiration = async () => {
      // Verificar se acesso expirou (mesmo que isActive ainda seja true)
      if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) {
        // Acesso expirou - atualizar estado do usuário para refletir expiração
        // Isso atualiza os elementos visuais (Sidebar, ChatInterface header)
        await refreshUser();
      }
    };

    // Verificar imediatamente
    checkExpiration();

    // Verificar periodicamente (a cada 30 segundos)
    const interval = setInterval(checkExpiration, 30000);

    return () => clearInterval(interval);
  }, [user?.accessExpiresAt, user?.isActive, user?.role, refreshUser]);

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

          // Carregar última conversa se existir e não houver conversa atual selecionada
          if (
            data.conversations &&
            data.conversations.length > 0 &&
            !currentConversationId
          ) {
            const lastConv = data.conversations[0];
            setCurrentConversationId(lastConv.id);
            if (
              lastConv.messages &&
              Array.isArray(lastConv.messages) &&
              lastConv.messages.length > 0
            ) {
              // Limpar histórico do geminiService para evitar compartilhamento entre usuários
              geminiService.clearHistory();

              // Reconstruir histórico do geminiService a partir das mensagens salvas
              lastConv.messages.forEach((msg: any) => {
                if (msg.sender === "user") {
                  geminiService.addToHistory("user", msg.text);
                } else {
                  geminiService.addToHistory("model", msg.text);
                }
              });

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
          } else if (!currentConversationId) {
            // Se não há conversas, limpar histórico do geminiService
            geminiService.clearHistory();
          }
        }
      } catch (error) {
        console.error("Failed to load conversation:", error);
      }
    };

    loadConversation();
    loadConversations(); // Carregar lista de conversas
  }, [messages.length, addMessage]);

  const loadConversations = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch("/.netlify/functions/conversations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversations) {
          setConversations(data.conversations);
        }
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };

  const handleDeleteClick = (conversationId: string, updatedAt: string) => {
    const date = new Date(updatedAt).toLocaleDateString();
    setConversationToDelete({ id: conversationId, date });
    setShowConversationsList(false); // Fechar dropdown ao abrir modal
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await fetch("/.netlify/functions/conversations", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId }),
      });

      if (response.ok) {
        await loadConversations();
        if (currentConversationId === conversationId) {
          // Se deletou a conversa atual, limpar mensagens
          onResetChat();
          setCurrentConversationId(null);
        }
        setConversationToDelete(null); // Fechar modal após deletar
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

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
        body: JSON.stringify({
          messages: messagesToSave,
          conversationId: currentConversationId || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversation) {
          setCurrentConversationId(data.conversation.id);
          await loadConversations(); // Atualizar lista de conversas
        }
      } else if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));

        if (errorData.maxConversations) {
          // Limite de 3 conversas atingido
          const errorMsg: Message = {
            id: generateUniqueId(),
            text: "⚠️ **Maximum Conversations Reached**\n\nYou have reached the maximum of 3 conversations. Please delete a conversation to create a new one.",
            sender: Sender.Bot,
            timestamp: new Date(),
          };
          addMessage(errorMsg);
          return;
        }

        let errorText =
          "⚠️ **Access Not Granted**\n\nYour account access has not been granted or has expired. Please contact an administrator to grant access.";

        if (errorData.error?.includes("blocked")) {
          errorText =
            "🚫 **Account Blocked**\n\nYour account has been blocked. Please contact an administrator.";
          setTimeout(() => {
            authService.logout();
            window.location.reload();
          }, 2000);
        }

        const errorMsg: Message = {
          id: generateUniqueId(),
          text: errorText,
          sender: Sender.Bot,
          timestamp: new Date(),
        };
        addMessage(errorMsg);
      }
    } catch (error) {
      console.error("Failed to save conversation:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // CRÍTICO: Verificar acesso ANTES de qualquer processamento (para não gastar tokens)
    // IMPORTANTE: Usuários bloqueados já foram deslogados, então não chegam aqui
    if (!user) {
      alert("Por favor, faça login para usar o chat.");
      return;
    }

    // Verificar acesso ANTES de chamar API - BLOQUEAR IMEDIATAMENTE se sem acesso
    // Admin sempre tem acesso ilimitado
    if (user.role !== "admin") {
      // Verificar se usuário está bloqueado (não deveria chegar aqui, mas verificar por segurança)
      if (user.isBlocked) {
        alert(
          "Sua conta foi bloqueada. Entre em contato com um administrador."
        );
        authService.logout();
        window.location.reload();
        return;
      }

      // Bloquear se usuário não tem acesso ativo
      // isActive: false = acesso revogado (permanece logado mas não pode usar chat)
      if (!user.isActive) {
        alert(
          "Seu acesso ainda não foi liberado. Entre em contato com um administrador."
        );
        return;
      }

      // Bloquear se acesso expirou - VERIFICAR ANTES DE CHAMAR API
      // accessExpiresAt expirado = acesso expirado (permanece logado mas não pode usar chat)
      if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) {
        alert(
          "Seu acesso expirou. Entre em contato com um administrador para renovar."
        );
        return;
      }
    }

    // Atualizar estado do usuário antes de enviar (garantir dados mais recentes)
    await refreshUser();

    // Obter usuário atualizado após refresh
    const updatedUser = user; // refreshUser já atualiza o estado, mas vamos usar o user do contexto

    // Verificar novamente após refresh (caso acesso tenha sido revogado durante o uso)
    // Nota: O backend também valida, mas esta verificação dupla garante que não gastamos tokens
    if (updatedUser && updatedUser.role !== "admin") {
      if (
        updatedUser.isBlocked ||
        !updatedUser.isActive ||
        (updatedUser.accessExpiresAt &&
          new Date(updatedUser.accessExpiresAt) < new Date())
      ) {
        alert(
          "Seu acesso foi revogado ou expirou. Por favor, entre em contato com um administrador."
        );
        return;
      }
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

      // Limpar streamedResponse ANTES de adicionar a mensagem final
      // Isso evita a duplicação visual (placeholder + mensagem final)
      setStreamedResponse("");

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
          <div className="flex-1">
            <div className="flex items-center gap-3 justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-200">
                  Consultation Session
                </h2>
                <p className="text-sm text-slate-400">
                  Provide details about your situation for analysis.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Conversas Dropdown */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setShowConversationsList(!showConversationsList)
                    }
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
                    title="Manage conversations"
                  >
                    <MessageSquare size={18} />
                    <ChevronDown
                      size={14}
                      className={showConversationsList ? "rotate-180" : ""}
                    />
                    {conversations.length > 0 && (
                      <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                        {conversations.length}/3
                      </span>
                    )}
                  </button>

                  {showConversationsList && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                      <div className="p-2 border-b border-slate-700 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">
                          Conversations
                        </span>
                        <button
                          onClick={() => setShowConversationsList(false)}
                          className="p-1 text-slate-400 hover:text-slate-200"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="p-2 space-y-1">
                        {conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={`p-2 rounded-lg flex items-center justify-between group ${
                              currentConversationId === conv.id
                                ? "bg-indigo-600/20 border border-indigo-500/50"
                                : "hover:bg-slate-700"
                            }`}
                          >
                            <button
                              onClick={async () => {
                                // Carregar conversa selecionada
                                setCurrentConversationId(conv.id);
                                setShowConversationsList(false);

                                // Carregar mensagens da conversa selecionada
                                try {
                                  const token = authService.getToken();
                                  if (!token) return;

                                  const response = await fetch(
                                    "/.netlify/functions/conversations",
                                    {
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    }
                                  );

                                  if (response.ok) {
                                    const data = await response.json();
                                    const selectedConv =
                                      data.conversations.find(
                                        (c: any) => c.id === conv.id
                                      );

                                    if (selectedConv && selectedConv.messages) {
                                      // Limpar mensagens atuais e histórico do geminiService
                                      onResetChat();

                                      // Reconstruir histórico do geminiService a partir das mensagens salvas
                                      selectedConv.messages.forEach(
                                        (msg: any) => {
                                          if (msg.sender === "user") {
                                            geminiService.addToHistory(
                                              "user",
                                              msg.text
                                            );
                                          } else {
                                            geminiService.addToHistory(
                                              "model",
                                              msg.text
                                            );
                                          }
                                        }
                                      );

                                      // Carregar mensagens da conversa selecionada
                                      const loadedMessages: Message[] =
                                        selectedConv.messages.map(
                                          (msg: any) => ({
                                            id: msg.id || generateUniqueId(),
                                            text: msg.text || "",
                                            sender:
                                              msg.sender === "user"
                                                ? Sender.User
                                                : Sender.Bot,
                                            timestamp: msg.timestamp
                                              ? new Date(msg.timestamp)
                                              : new Date(),
                                          })
                                        );

                                      loadedMessages.forEach((msg) =>
                                        addMessage(msg)
                                      );
                                      hasLoadedHistory.current = true;
                                    }
                                  }
                                } catch (error) {
                                  console.error(
                                    "Failed to load conversation:",
                                    error
                                  );
                                }
                              }}
                              className="flex-1 text-left text-sm text-slate-300"
                            >
                              <div className="font-medium">
                                Chat{" "}
                                {new Date(conv.updatedAt).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date(conv.updatedAt).toLocaleTimeString()}
                              </div>
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteClick(conv.id, conv.updatedAt)
                              }
                              className="p-1 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete conversation"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        {conversations.length < 3 && (
                          <button
                            onClick={() => {
                              setCurrentConversationId(null);
                              onResetChat();
                              setShowConversationsList(false);
                            }}
                            className="w-full p-2 text-sm text-indigo-400 hover:bg-slate-700 rounded-lg text-center"
                          >
                            + New Conversation
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {messages.length > 0 && (
                  <button
                    onClick={() => setShowResetModal(true)}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Reset current chat"
                  >
                    <RotateCcw size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {user && !user.isActive && !user.accessExpiresAt && (
          <div className="mt-3 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 text-orange-400 text-sm">
            <AlertCircle size={16} />
            <span>
              Your account access has not been granted. Please contact an
              administrator.
            </span>
          </div>
        )}
        {user && !user.isActive && user.accessExpiresAt && (
          <div className="mt-3 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 text-orange-400 text-sm">
            <AlertCircle size={16} />
            <span>
              Your access has been revoked. Please contact an administrator to
              restore access.
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

      {/* Reset Chat Modal */}
      {showResetModal && (
        <ResetChatModal
          onConfirm={async () => {
            // Limpar mensagens localmente
            onResetChat();
            setCurrentConversationId(null);
            setShowResetModal(false);
            hasLoadedHistory.current = false; // Permitir recarregar histórico se necessário

            // Deletar conversa do backend se houver uma conversa atual
            if (currentConversationId) {
              await deleteConversation(currentConversationId);
            }
            setCurrentConversationId(null);
          }}
          onCancel={() => setShowResetModal(false)}
        />
      )}

      {/* Delete Conversation Modal */}
      {conversationToDelete && (
        <DeleteConversationModal
          onConfirm={async () => {
            await deleteConversation(conversationToDelete.id);
          }}
          onCancel={() => setConversationToDelete(null)}
          conversationDate={conversationToDelete.date}
        />
      )}
    </div>
  );
};

export default ChatInterface;

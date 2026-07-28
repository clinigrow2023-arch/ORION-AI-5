import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  User,
  Loader2,
  AlertCircle,
  Key,
  RotateCcw,
  MessageSquare,
  Trash2,
  ChevronDown,
  X,
  Bot,
} from "lucide-react";
import { Message, Sender } from "../types";
import { chatService, ChatServiceError } from "../services/chatService";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../contexts/I18nContext";
import { apiFetch } from "../lib/api-endpoints";
import { authService } from "../lib/auth";
import {
  getActiveConversationId,
  setActiveConversationId,
} from "../lib/active-conversation";
import {
  fetchConversationDetail,
  fetchConversationsSummary,
  invalidateConversationsCache,
} from "../lib/conversations-client";
import {
  formatConversationSubtitle,
  formatConversationTitle,
} from "../lib/conversation-label";
import OrionLogo from "./OrionLogo";
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
  const { user } = useAuth();
  const { t, formatShortTime } = useI18n();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamedResponse, setStreamedResponse] = useState("");
  const hasLoadedHistory = useRef(false);
  const bootstrapStarted = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const pendingCreateRef = useRef<Promise<string | null> | null>(null);
  const messageIdCounter = useRef(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [conversations, setConversations] = useState<
    Array<{
      id: string;
      createdAt: string;
      updatedAt: string;
      messageCount?: number;
    }>
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

  const botNotice = (text: string): Message => ({
    id: generateUniqueId(),
    text,
    sender: Sender.Bot,
    timestamp: new Date(),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (streamedResponse) {
      scrollToBottom();
    }
  }, [streamedResponse.length]);

  const loadConversationsList = async (force = false) => {
    try {
      const list = await fetchConversationsSummary(force);
      setConversations(list);
      return list;
    } catch (error) {
      console.error("Failed to load conversations:", error);
      return [];
    }
  };

  const loadConversationById = async (conversationId: string) => {
    try {
      const conv = await fetchConversationDetail(conversationId);
      if (!conv?.messages?.length) return;

      conversationIdRef.current = conv.id;
      setCurrentConversationId(conv.id);
      setActiveConversationId(conv.id);
      chatService.clearHistory();

      conv.messages.forEach((msg: any) => {
        if (msg.sender === "user") {
          chatService.addToHistory("user", msg.text);
        } else {
          chatService.addToHistory("model", msg.text);
        }
      });

      const loadedMessages: Message[] = conv.messages.map((msg: any) => ({
        id: msg.id || generateUniqueId(),
        text: msg.text || "",
        sender: msg.sender === "user" ? Sender.User : Sender.Bot,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      }));

      loadedMessages.forEach((msg) => addMessage(msg));
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const token = authService.getToken();
      if (!token || cancelled) return;

      const storedId = getActiveConversationId();
      if (storedId) {
        conversationIdRef.current = storedId;
        setCurrentConversationId(storedId);
      }

      const list = await loadConversationsList(true);
      if (cancelled) return;

      if (bootstrapStarted.current) return;
      bootstrapStarted.current = true;

      const preferred =
        storedId && list.some((c) => c.id === storedId)
          ? storedId
          : list[0]?.id;

      if (preferred && messages.length === 0) {
        await loadConversationById(preferred);
      } else if (list.length === 0 && messages.length === 0) {
        conversationIdRef.current = null;
        setActiveConversationId(null);
        chatService.clearHistory();
      }

      hasLoadedHistory.current = true;
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeleteClick = (conversationId: string, updatedAt: string) => {
    const date = new Date(updatedAt).toLocaleDateString();
    setConversationToDelete({ id: conversationId, date });
    setShowConversationsList(false); // Fechar dropdown ao abrir modal
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const response = await apiFetch("conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });

      if (response.ok) {
        invalidateConversationsCache(conversationId);
        await loadConversationsList(true);
        if (conversationIdRef.current === conversationId) {
          onResetChat();
          conversationIdRef.current = null;
          setCurrentConversationId(null);
          setActiveConversationId(null);
        }
        setConversationToDelete(null); // Fechar modal após deletar
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const ensureConversationId = async (
    allMessages: Message[]
  ): Promise<string | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    if (allMessages.length === 0) return null;

    if (pendingCreateRef.current) {
      return pendingCreateRef.current;
    }

    const token = authService.getToken();
    if (!token) return null;

    if (conversations.length >= 3) {
      addMessage(botNotice(t("chat.notices.maxConversations")));
      return null;
    }

    const messagesToSave = allMessages.map((msg) => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender === Sender.User ? "user" : "bot",
      timestamp: msg.timestamp.toISOString(),
    }));

    pendingCreateRef.current = (async () => {
      const response = await apiFetch("conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSave }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.maxConversations) {
            addMessage(botNotice(t("chat.notices.maxConversations")));
          }
        }
        return null;
      }

      const data = await response.json();
      const id = data.conversation?.id as string | undefined;
      if (!id) return null;

      conversationIdRef.current = id;
      setCurrentConversationId(id);
      setActiveConversationId(id);
      invalidateConversationsCache();
      await loadConversationsList(true);
      return id;
    })();

    try {
      return await pendingCreateRef.current;
    } finally {
      pendingCreateRef.current = null;
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

      const conversationId = await ensureConversationId(allMessages);
      if (!conversationId) return;

      const response = await apiFetch("conversations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: messagesToSave,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversation) {
          invalidateConversationsCache(conversationId);
          setConversations((prev) => {
            const existing = prev.find((c) => c.id === data.conversation.id);
            if (existing) {
              return prev.map((c) =>
                c.id === data.conversation.id
                  ? {
                      ...c,
                      updatedAt: data.conversation.updatedAt,
                      messageCount: messagesToSave.length,
                    }
                  : c
              );
            }
            return [
              {
                id: data.conversation.id,
                createdAt: data.conversation.createdAt,
                updatedAt: data.conversation.updatedAt,
                messageCount: messagesToSave.length,
              },
              ...prev,
            ];
          });
        }
      } else if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));

        if (errorData.maxConversations) {
          // Limite de 3 conversas atingido
          addMessage(botNotice(t("chat.notices.maxConversations")));
          return;
        }

        // `blocked` chega como flag do servidor: a mensagem em si vem traduzida
        // e não serve para decidir o fluxo.
        if (errorData.blocked) {
          addMessage(botNotice(t("chat.notices.accountBlocked")));
          setTimeout(() => {
            authService.logout();
            window.location.reload();
          }, 2000);
          return;
        }

        addMessage(botNotice(t("chat.notices.accessNotGranted")));
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
      alert(t("chat.alerts.loginRequired"));
      return;
    }

    // Verificar acesso ANTES de chamar API - BLOQUEAR IMEDIATAMENTE se bloqueado
    // Admin sempre tem acesso ilimitado
    if (user.role !== "admin") {
      // Verificar se usuário está bloqueado (não deveria chegar aqui, mas verificar por segurança)
      if (user.isBlocked) {
        alert(t("chat.alerts.accountBlocked"));
        authService.logout();
        window.location.reload();
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
      const fullResponse = await chatService.sendMessageStream(
        input,
        (chunk) => {
          setStreamedResponse((prev) => prev + chunk);
        }
      );

      // Validar se a resposta não está vazia
      if (
        !fullResponse ||
        (typeof fullResponse === "string" && fullResponse.trim() === "")
      ) {
        throw new Error(t("chat.notices.emptyResponse"));
      }

      // Limpar streamedResponse ANTES de adicionar a mensagem final
      // Isso evita a duplicação visual (placeholder + mensagem final)
      setStreamedResponse("");

      // Garantir que temos uma resposta válida antes de criar a mensagem
      const responseText =
        typeof fullResponse === "string"
          ? fullResponse.trim()
          : String(fullResponse || "").trim();

      if (!responseText) {
        throw new Error(t("chat.notices.emptyResponse"));
      }

      const botMsg: Message = {
        id: generateUniqueId(),
        text: responseText,
        sender: Sender.Bot,
        timestamp: new Date(),
      };

      // Validar novamente antes de adicionar
      if (!botMsg.text || botMsg.text.trim() === "") {
        throw new Error(t("chat.notices.emptyResponse"));
      }

      const updatedMessages = [...currentMessages, botMsg];
      addMessage(botMsg);

      // Salvar conversa após resposta completa
      await saveConversation(updatedMessages);
    } catch (error: unknown) {
      // O chatService expõe um `code` estável por falha conhecida, para a
      // detecção não depender do idioma da mensagem.
      const code = error instanceof ChatServiceError ? error.code : undefined;
      let errorText: string;

      switch (code) {
        case "busy":
          errorText = t("chat.notices.aiBusy");
          break;
        case "access_denied":
          errorText = t("chat.notices.accessNotGranted");
          break;
        case "empty_response":
          errorText = t("chat.notices.emptyResponse");
          break;
        case "provider_failed":
          errorText = t("chat.notices.aiUnavailable");
          break;
        default:
          errorText = t("chat.notices.genericError");
          break;
      }

      addMessage(botNotice(errorText));
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
                  {t("chat.header.title")}
                </h2>
                <p className="text-sm text-slate-400">
                  {t("chat.header.subtitle")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Conversas Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      const open = !showConversationsList;
                      setShowConversationsList(open);
                      if (open) void loadConversationsList(true);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
                    title={t("chat.conversations.manage")}
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
                          {t("chat.conversations.title")}
                        </span>
                        <button
                          onClick={() => setShowConversationsList(false)}
                          className="p-1 text-slate-400 hover:text-slate-200"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="p-2 space-y-1">
                        {conversations.length === 0 ? (
                          <p className="text-xs text-slate-500 px-2 py-3 text-center">
                            {t("chat.conversations.empty")}
                          </p>
                        ) : null}
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
                                setShowConversationsList(false);
                                onResetChat();
                                await loadConversationById(conv.id);
                                hasLoadedHistory.current = true;
                              }}
                              className="flex-1 text-left text-sm text-slate-300"
                            >
                              <div className="font-medium text-slate-200 line-clamp-2 text-sm leading-snug">
                                {formatConversationTitle(conv)}
                              </div>
                              <div className="text-xs text-slate-500">
                                {formatConversationSubtitle(conv)}
                              </div>
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteClick(conv.id, conv.updatedAt)
                              }
                              className="p-1 text-slate-400 hover:text-red-400 transition-opacity "
                              title={t("chat.conversations.delete")}
                            >
                              <Trash2 className="w-5" />
                            </button>
                          </div>
                        ))}
                        {conversations.length < 3 && (
                          <button
                            onClick={() => {
                              // Validar novamente antes de criar (dupla verificação)
                              if (conversations.length >= 3) {
                                addMessage(
                                  botNotice(t("chat.notices.maxConversations"))
                                );
                                setShowConversationsList(false);
                                return;
                              }
                              conversationIdRef.current = null;
                              setCurrentConversationId(null);
                              setActiveConversationId(null);
                              onResetChat();
                              setShowConversationsList(false);
                            }}
                            className="w-full p-2 text-sm text-indigo-400 hover:bg-slate-700 rounded-lg text-center"
                          >
                            {t("chat.conversations.create")}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Botões sempre visíveis no mobile */}
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <button
                      onClick={() => setShowResetModal(true)}
                      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                      title={t("chat.conversations.reset")}
                    >
                      <RotateCcw size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <OrionLogo size={150} className="mb-4 opacity-90" />
            <h3 className="text-xl font-medium text-slate-200">
              {t("chat.welcome.title")}
            </h3>
            <p className="max-w-md mt-2 text-slate-400">
              {t("chat.welcome.subtitle")}
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
                <Bot size={30} />
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
                {msg.text && msg.text.trim() ? (
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                ) : (
                  <div className="text-slate-400 italic">
                    <p>{t("chat.emptyMessage.title", { id: msg.id })}</p>
                    <p className="text-xs mt-1">
                      {t("chat.emptyMessage.hint")}
                    </p>
                  </div>
                )}
              </div>
              <span className="text-[10px] opacity-50 mt-2 block">
                {formatShortTime(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}

        {/* Streaming message placeholder */}
        {isLoading && streamedResponse && (
          <div className="flex gap-4 flex-row">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-slate-700">
              <Bot size={50} />
            </div>
            <div className="max-w-[80%] rounded-2xl p-4 bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700">
              <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap">
                {streamedResponse}
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
            <span>{t("chat.analyzing")}</span>
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
                ? t("chat.input.placeholderSignedOut")
                : t("chat.input.placeholder")
            }
            disabled={!user}
            className="w-full bg-slate-800 text-slate-200 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-slate-700 resize-none h-[60px] scrollbar-hide disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !user}
            aria-label={t("chat.input.send")}
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
            const idToDelete = conversationIdRef.current;
            onResetChat();
            conversationIdRef.current = null;
            setCurrentConversationId(null);
            setActiveConversationId(null);
            setShowResetModal(false);
            hasLoadedHistory.current = true;

            if (idToDelete) {
              await deleteConversation(idToDelete);
            }
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

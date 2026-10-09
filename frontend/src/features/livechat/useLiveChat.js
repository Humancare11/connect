import { useCallback, useEffect, useRef, useState } from "react";

// Patient-side chat state. Talks to the server over Socket.IO (/livechat) with the chat token that the contact form
// returns; without that token the server refuses every chat event.
//
// Stored in this browser (first-party, functional): the visitor id, the chat token (so a returning visitor skips
// the form) and whether the window was open (so a chat survives page changes).

const API_BASE = import.meta.env.VITE_API_URL || "";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (typeof window !== "undefined" ? window.location.origin : "");
const TOKEN_KEY = "hcLiveChatToken";
const ID_KEY = "hcLiveChatVisitorId"; // shared with the visitor tracker so chats and presence line up
const OPEN_KEY = "hcLiveChatOpen";

const store = {
  get(key, area = "local") {
    try {
      return (area === "session" ? sessionStorage : localStorage).getItem(key) || "";
    } catch {
      return "";
    }
  },
  set(key, value, area = "local") {
    try {
      (area === "session" ? sessionStorage : localStorage).setItem(key, value);
    } catch {
      /* storage unavailable: the chat still works for this page */
    }
  },
  remove(key, area = "local") {
    try {
      (area === "session" ? sessionStorage : localStorage).removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// Sent when a chat starts: the browser's time zone ("their time" in the support panel) and the cookie choice.
const startDetails = () => {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    tz = "";
  }
  const consent = store.get("cookieConsent");
  return {
    path: window.location.pathname,
    title: document.title || "",
    tz,
    cookies: consent === "accepted" ? "accepted" : consent === "rejected" ? "declined" : "unknown",
  };
};

const ERRORS = {
  rate_limited: "You're sending messages too quickly. Please wait a moment.",
  message_too_long: "Messages can be up to 1,000 characters.",
  empty_message: "",
  chat_limit: "You've reached today's chat limit. Please try again tomorrow or email support@humancareconnect.co.",
  contact_required: "Please fill in your details to start the chat.",
  no_conversation: "This chat has ended. Please start a new one.",
  server_error: "Something went wrong. Please try again.",
};

export function useLiveChat() {
  const [phase, setPhase] = useState(() => (store.get(TOKEN_KEY) ? "loading" : "form")); // loading | form | chat
  const [conversation, setConversation] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [aiTyping, setAiTyping] = useState(false);
  const [agentTyping, setAgentTyping] = useState(""); // the agent's name while they type, else ""
  const [connection, setConnection] = useState("connecting"); // connecting | online | offline
  const [notice, setNotice] = useState("");
  const [unread, setUnread] = useState(0);
  const [open, setOpenState] = useState(() => store.get(OPEN_KEY, "session") === "1");

  const socketRef = useRef(null);
  const connectingRef = useRef(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const setOpen = useCallback((value) => {
    setOpenState(value);
    store.set(OPEN_KEY, value ? "1" : "0", "session");
    if (value) setUnread(0);
  }, []);

  const emit = useCallback(
    (event, payload) =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket) return resolve({ ok: false, error: "server_error" });
        const timer = setTimeout(() => resolve({ ok: false, error: "server_error" }), 15_000);
        const done = (reply) => {
          clearTimeout(timer);
          resolve(reply || { ok: false, error: "server_error" });
        };
        if (payload === undefined) socket.emit(event, done);
        else socket.emit(event, payload, done);
      }),
    []
  );

  const resume = useCallback(async () => {
    const res = await emit("chat:resume");
    if (res.needContact) {
      // The server does not know this contact (e.g. data was removed): ask again.
      store.remove(TOKEN_KEY);
      setPhase("form");
      return;
    }
    if (res.ok) {
      setFirstName(res.firstName || "");
      setConversation(res.conversation || null);
      setPhase("chat");
    }
  }, [emit]);

  const connect = useCallback(() => {
    if (socketRef.current) return connectingRef.current;
    const token = store.get(TOKEN_KEY);
    if (!token) return Promise.reject(new Error("no token"));
    connectingRef.current = (async () => {
      const { io } = await import("socket.io-client");
      const socket = io(`${SOCKET_URL}/livechat`, {
        path: "/socket.io/",
        transports: ["websocket", "polling"],
        // Chat only: no cookie-consent flag, so a chat client is never added to the visitor list.
        auth: { chatToken: token, referrer: document.referrer || "" },
        withCredentials: false,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 20_000,
      });
      socketRef.current = socket;

      socket.on("chat:message", ({ conversationId, message }) => {
        setConversation((current) => {
          if (!current || current.conversationId !== conversationId) return current;
          if (current.messages.some((m) => m.id === message.id)) return current;
          return { ...current, messages: [...current.messages, message] };
        });
        if (message.sender === "agent") setAgentTyping("");
        if (message.sender !== "patient" && !openRef.current) setUnread((n) => n + 1);
      });
      socket.on("chat:state", (state) => setConversation(state));
      socket.on("chat:typing", ({ from, typing, name }) => {
        if (from === "ai") setAiTyping(Boolean(typing));
        if (from === "agent") setAgentTyping(typing ? name || "Support" : "");
      });
      let first = true;
      socket.on("connect", () => {
        setConnection("online");
        if (!first) resume(); // reconnected: catch up on anything missed
        first = false;
      });
      socket.on("disconnect", () => setConnection("offline"));
      socket.on("connect_error", (err) => {
        if (String(err?.message).includes("invalid_token") || String(err?.message).includes("Invalid namespace")) {
          socket.close();
          socketRef.current = null;
          connectingRef.current = null;
          if (String(err.message).includes("invalid_token")) {
            store.remove(TOKEN_KEY);
            setPhase("form");
          }
        }
      });

      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("connect timeout")), 10_000);
        socket.once("connect", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    })();
    connectingRef.current.catch(() => {
      connectingRef.current = null;
    });
    return connectingRef.current;
  }, [resume]);

  // Returning visitor: restore the chat quietly once the widget is mounted.
  useEffect(() => {
    if (!store.get(TOKEN_KEY)) return undefined;
    let cancelled = false;
    connect()
      .then(() => (cancelled ? null : resume()))
      .catch(() => setPhase((p) => (p === "loading" ? "chat" : p)));
    return () => {
      cancelled = true;
    };
  }, [connect, resume]);

  useEffect(
    () => () => {
      socketRef.current?.close();
      socketRef.current = null;
      connectingRef.current = null;
    },
    []
  );

  // Opening the window with contact details but no chat yet starts one (greeting + option cards).
  const startedRef = useRef(false);
  useEffect(() => {
    if (!open || phase !== "chat" || conversation || startedRef.current) return;
    startedRef.current = true;
    emit("chat:start", startDetails()).then((res) => {
      startedRef.current = false;
      if (res.ok) setConversation(res.conversation);
      else setNotice(ERRORS[res.error] || ERRORS.server_error);
    });
  }, [open, phase, conversation, emit]);

  const submitContact = useCallback(
    async ({ name, email, phone, turnstileToken, companyUrl }) => {
      let body;
      try {
        const res = await fetch(`${API_BASE}/api/livechat/contact`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            phone,
            turnstileToken,
            companyUrl,
            consent: true,
            visitorId: store.get(ID_KEY) || undefined,
          }),
        });
        body = await res.json().catch(() => ({}));
        if (res.status === 429) return { ok: false, errors: { form: "Too many attempts. Please wait a few minutes and try again." } };
      } catch {
        return { ok: false, errors: { form: "We couldn't reach the server. Please check your connection and try again." } };
      }
      if (!body.ok) return { ok: false, errors: body.errors || { form: ERRORS.server_error } };
      if (!body.token) return { ok: false, errors: { form: "Something went wrong. Please reload the page and try again." } };

      store.set(TOKEN_KEY, body.token);
      store.set(ID_KEY, body.visitorId);
      setFirstName(body.firstName || "");
      try {
        await connect();
        await resume();
      } catch {
        return { ok: false, errors: { form: "We couldn't start the chat. Please try again." } };
      }
      return { ok: true };
    },
    [connect, resume]
  );

  const send = useCallback(
    async (text) => {
      setNotice("");
      const res = await emit("chat:message", { text });
      if (!res.ok) setNotice(ERRORS[res.error] ?? ERRORS.server_error);
      return Boolean(res.ok);
    },
    [emit]
  );

  const pickOption = useCallback(
    async (key) => {
      setNotice("");
      const res = await emit("chat:option", { key });
      if (!res.ok) setNotice(ERRORS[res.error] ?? ERRORS.server_error);
    },
    [emit]
  );

  // After a chat ended (resolved by the team): open a fresh one.
  const startNew = useCallback(async () => {
    setNotice("");
    const res = await emit("chat:start", startDetails());
    if (res.ok) setConversation(res.conversation);
    else setNotice(ERRORS[res.error] ?? ERRORS.server_error);
  }, [emit]);

  const talkToAgent = useCallback(async () => {
    setNotice("");
    const res = await emit("chat:agent");
    if (!res.ok) setNotice(ERRORS[res.error] ?? ERRORS.server_error);
  }, [emit]);

  // Typing indicator for the support team: a boolean only, never the text.
  const typingTimer = useRef(null);
  const notifyTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("chat:typing", { typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("chat:typing", { typing: false }), 1800);
  }, []);

  return {
    phase,
    conversation,
    firstName,
    aiTyping,
    agentTyping,
    connection,
    notice,
    unread,
    open,
    setOpen,
    submitContact,
    send,
    pickOption,
    talkToAgent,
    startNew,
    notifyTyping,
    dismissNotice: () => setNotice(""),
  };
}

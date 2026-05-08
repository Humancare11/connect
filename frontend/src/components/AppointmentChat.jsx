import { useEffect, useRef, useState } from "react";
import socket from "../socket";

export default function AppointmentChat({ appointmentId, userName, userId }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [joined, setJoined] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!appointmentId) return;

    if (!socket.connected) socket.connect();

    socket.emit("join-appointment-room", { appointmentId });
    setJoined(true);

    const handleMessage = (msg) => {
      if (msg.appointmentId !== appointmentId) return;
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("appointment-message", handleMessage);

    return () => {
      socket.emit("leave-appointment-room", { appointmentId });
      socket.off("appointment-message", handleMessage);
      setJoined(false);
    };
  }, [appointmentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const payload = {
      appointmentId,
      senderId: userId || null,
      senderName: userName || "Patient",
      text: message.trim(),
    };

    socket.emit("appointment-message", payload);
    setMessages((prev) => [...prev, { ...payload, createdAt: new Date().toISOString() }]);
    setMessage("");
  };

  return (
    <div className="chat-card" style={{ marginTop: 24 }}>
      <div className="chat-header">Live Consultation Chat</div>
      <div className="chat-messages" style={{ maxHeight: 280, overflowY: "auto", padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        {messages.length === 0 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>
            Waiting for messages...
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{msg.senderName || "Unknown"}</div>
              <div style={{ background: "#fff", padding: 10, borderRadius: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={joined ? "Write a message..." : "Joining chat..."}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
          disabled={!joined}
        />
        <button type="submit" disabled={!message.trim()} style={{ padding: "10px 16px", borderRadius: 8, background: "#3b82f6", color: "white", border: "none" }}>
          Send
        </button>
      </form>
    </div>
  );
}

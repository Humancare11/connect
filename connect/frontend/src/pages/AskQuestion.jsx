import { useEffect, useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AskQuestion() {
  const [question, setQuestion] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchQuestions = async () => {
    try {
      const res = await api.get("/api/qna");
      setQuestions(res.data);
    } catch (error) {
      console.error("Fetch questions error:", error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handlePostQuestion = async () => {
    setFormError("");
    if (!question.trim()) {
      setFormError("Please enter your question before submitting.");
      return;
    }

    if (!user) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      await api.post(
        "/api/qna/ask",
        {
          question: question.trim(),
          name: user?.name || "User",
          category: "General",
        }
      );
      setQuestion("");
      navigate("/qna");
    } catch (error) {
      console.error(error);
      setFormError(error.response?.data?.msg || "Failed to post question. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Ask Question</h2>

      {formError && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 12,
          fontSize: 13,
          color: "#dc2626",
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: 700,
        }}>
          <span>&#9888;</span> {formError}
        </div>
      )}

      <textarea
        value={question}
        onChange={(e) => { setQuestion(e.target.value); if (formError) setFormError(""); }}
        placeholder="Type your question here..."
        rows={5}
        style={{
          width: "100%",
          maxWidth: "700px",
          padding: "10px",
          borderRadius: "8px",
          border: formError ? "1.5px solid #fca5a5" : "1px solid #ccc",
        }}
      />
      <br />
      <button
        onClick={handlePostQuestion}
        disabled={loading}
        style={{
          marginTop: "10px",
          padding: "10px 18px",
          border: "none",
          borderRadius: "8px",
          background: "#2563eb",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {loading ? "Posting..." : "Post Question"}
      </button>

      <hr style={{ margin: "30px 0" }} />

      <h3>Recent Questions &amp; Answers</h3>

      {fetching ? (
        <p>Loading...</p>
      ) : questions.length === 0 ? (
        <p>No questions yet.</p>
      ) : (
        questions.map((q) => (
          <div
            key={q._id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "15px",
              marginBottom: "15px",
              maxWidth: "800px",
            }}
          >
            <p>
              <strong>Question:</strong> {q.question}
            </p>

            <p>
              <strong>Asked By:</strong> {q.name}
            </p>

            <p>
              <strong>Category:</strong> {q.category || "General"}
            </p>

            {q.answers && q.answers.length > 0 ? (
              <div style={{ marginTop: "10px", padding: "10px", background: "#f8f8f8", borderRadius: "8px" }}>
                <strong>Latest Answer:</strong>
                <p style={{ marginTop: "8px" }}>
                  {q.answers[q.answers.length - 1].answer}
                </p>
                <small>
                  By: {q.answers[q.answers.length - 1].name}
                </small>
              </div>
            ) : (
              <p style={{ color: "#888" }}>No answer yet</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

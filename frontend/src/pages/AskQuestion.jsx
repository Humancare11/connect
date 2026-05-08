import { useEffect, useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

export default function AskQuestion() {
  const [question, setQuestion] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const navigate = useNavigate();

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
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user"));

    if (!question.trim()) {
      alert("Please enter your question");
      return;
    }

    if (!token) {
      alert("Pehle login kariye");
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
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setQuestion("");
      navigate("/qna");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.msg || "Question post failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Ask Question</h2>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Apna question likhiye..."
        rows={5}
        style={{
          width: "100%",
          maxWidth: "700px",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #ccc",
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

      <h3>Recent Questions & Answers</h3>

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
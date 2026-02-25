import { useState, useEffect } from "react";
import { useQuizSocket } from "../hooks/useQuizSocket";
import { COLORS } from "../styles/colors";
import { getRankEmoji, formatAddress } from "../utils/helpers";

function Leaderboard({ scores, quiz }) {
  const sorted = Object.entries(scores)
    .map(([address, s]) => ({ address, ...s }))
    .sort((a, b) => b.correct - a.correct || 0);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 10 }}>
        LEADERBOARD
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((p, i) => (
          <div key={p.address} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: "10px 14px",
          }}>
            <span style={{ fontSize: 16, width: 28 }}>{getRankEmoji(i + 1)}</span>
            <span style={{
              flex: 1, fontFamily: "JetBrains Mono, monospace",
              fontSize: 12, color: COLORS.text,
            }}>
              {formatAddress(p.address)}
            </span>
            <span style={{ color: COLORS.muted, fontSize: 12 }}>
              {p.correct}/{quiz.questions.length} correct
            </span>
            <span style={{
              background: `${COLORS.accent}22`, border: `1px solid ${COLORS.accent}44`,
              borderRadius: 6, padding: "3px 8px",
              fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: COLORS.accent,
            }}>
              ⬡ {p.totalTokens ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function HostGame({ quiz, wallet, onGameEnd }) {
  const [phase, setPhase] = useState("lobby");
  // lobby | question_active | waiting_answers | showing_stats | finished | distributing
  const [currentQ, setCurrentQ] = useState(0);
  const [players, setPlayers] = useState([]);
  const [answerCount, setAnswerCount] = useState({ answered: 0, total: 0 });
  const [questionStats, setQuestionStats] = useState(null);
  const [scores, setScores] = useState({});
  const [allAnswered, setAllAnswered] = useState(false);

  const { emit } = useQuizSocket(quiz.roomCode, "host", {
    player_joined: ({ players }) => setPlayers(players),
    answer_count: (data) => {
      setAnswerCount(data);
      if (data.answered >= data.total) setAllAnswered(true);
    },
    all_answered: () => setAllAnswered(true),
    question_stats: (stats) => {
      setQuestionStats(stats);
      if (stats.scores) setScores(stats.scores);
      setPhase("showing_stats");
    },
    quiz_ended: ({ scores }) => {
      setScores(scores);
      setPhase("finished");
    },
    rewards_distributed: () => setPhase("distributing"),
  });

  const startQuiz = () => {
    emit("host_start_quiz");
    setPhase("question_active");
    setAllAnswered(false);
    setAnswerCount({ answered: 0, total: players.length });
    emit("host_open_question", { questionIndex: 0 });
  };

  const showStats = () => {
    emit("host_show_stats", { questionIndex: currentQ });
  };

  const nextQuestion = () => {
    const next = currentQ + 1;
    if (next >= quiz.questions.length) {
      emit("host_end_quiz");
    } else {
      setCurrentQ(next);
      setAllAnswered(false);
      setAnswerCount({ answered: 0, total: players.length });
      setQuestionStats(null);
      setPhase("question_active");
      emit("host_open_question", { questionIndex: next });
    }
  };

  const handleGameEnd = () => {
    emit("host_end_without_distribute");
    onGameEnd();
  };

  const distributeRewards = () => {
    emit("host_distribute");
  };

  const question = quiz.questions[currentQ];
  const sortedScores = Object.entries(scores)
    .map(([address, s]) => ({ address, ...s }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "Space Grotesk, sans-serif" }}>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 24px", borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
      }}>
        <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 14, color: COLORS.accent }}>
          HOST CONSOLE
        </span>
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 8, padding: "6px 14px", fontSize: 13, color: COLORS.muted,
        }}>
          Room: <strong style={{ fontFamily: "JetBrains Mono, monospace", letterSpacing: 4, color: COLORS.accent }}>
            {quiz.roomCode}
          </strong>
        </div>
        <span style={{ color: COLORS.muted, fontSize: 13 }}>
          {players.length} student{players.length !== 1 ? "s" : ""} joined
        </span>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 20px" }}>

        {/* LOBBY */}
        {phase === "lobby" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 24, marginBottom: 8, color: COLORS.text }}>
              {quiz.name}
            </h2>
            <p style={{ color: COLORS.muted, marginBottom: 32 }}>
              {quiz.questions.length} questions
            </p>

            {/* Room code display */}
            <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: "24px 40px", display: "inline-block", marginBottom: 16,
            }}>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>SHARE THIS CODE</div>
            <div style={{
                fontFamily: "Orbitron, sans-serif", fontSize: 42, fontWeight: 900,
                color: COLORS.accent, letterSpacing: 10,
            }}>
                {quiz.roomCode}
            </div>
            </div>

            {/* Waiting message — now below the box */}
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 32 }}>
            Waiting for students to join...
            </p>

            {/* Player list */}
            {players.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 10 }}>
                  Students in lobby:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {players.map((p, i) => (
                    <div key={i} style={{
                      background: COLORS.card, border: `1px solid ${COLORS.border}`,
                      borderRadius: 8, padding: "6px 12px", fontSize: 13,
                      display: "flex", alignItems: "center", gap: 8, color: COLORS.text
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: COLORS.accent, display: "inline-block",
                      }} />
                      {p.name || formatAddress(p.address)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={startQuiz}
              disabled={players.length < 1}
              style={{
                background: players.length === 0 ? COLORS.border : COLORS.accent,
                color: "#000", border: "none", borderRadius: 10,
                padding: "16px 40px", fontSize: 16, fontWeight: 700,
                cursor: players.length === 0 ? "not-allowed" : "pointer",
                fontFamily: "Space Grotesk, sans-serif",
              }}>
              {players.length === 0 ? "Waiting for students..." : `▶ Start Quiz (${players.length} ready)`}
            </button>
          </div>
        )}

        {/* QUESTION ACTIVE */}
        {phase === "question_active" && (
          <div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 16 }}>
              Question {currentQ + 1} of {quiz.questions.length}
            </div>

            <div style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: 24, marginBottom: 20,
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: COLORS.text }}>
                {question.question}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {question.options.map((opt, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", borderRadius: 8, fontSize: 13,
                    background: COLORS.surface,
                    border: `1px solid COLORS.border`,
                    color: COLORS.text,
                  }}>
                    {["A", "B", "C", "D"][i]}. {opt}
                  </div>
                ))}
              </div>
            </div>

            {/* Answer progress */}
            <div style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: 20, marginBottom: 20, textAlign: "center",
            }}>
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "Orbitron, sans-serif", color: COLORS.accent }}>
                {answerCount.answered} / {answerCount.total}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 12 }}>
                students answered
              </div>
              <div style={{
                height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", background: COLORS.accent, borderRadius: 3,
                  width: answerCount.total > 0
                    ? `${(answerCount.answered / answerCount.total) * 100}%`
                    : "0%",
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>

            <button
              onClick={showStats}
              style={{
                width: "100%", background: allAnswered ? COLORS.accent : COLORS.purple,
                color: allAnswered ? "#000" : "#fff",
                border: "none", borderRadius: 10, padding: "14px",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
              }}>
              {allAnswered ? "✓ All answered — Show Results" : "⏭ Show Results Now"}
            </button>
          </div>
        )}

        {/* SHOWING STATS */}
        {phase === "showing_stats" && questionStats && (
          <div>
            <div style={{
              textAlign: "center", fontFamily: "Orbitron, sans-serif",
              fontSize: 20, marginBottom: 24, color: COLORS.accent,
            }}>
              QUESTION {currentQ + 1} RESULTS
            </div>

            {/* Answer distribution */}
            <div style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: 20, marginBottom: 16,
            }}>
              {questionStats.distribution.map((d, i) => {
                const pct = questionStats.totalPlayers > 0
                  ? Math.round((d.count / questionStats.totalPlayers) * 100)
                  : 0;
                const isCorrect = i === questionStats.correctIndex;
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      fontSize: 13, marginBottom: 4,
                    }}>
                      <span style={{ color: isCorrect ? COLORS.accent : COLORS.text }}>
                        {["A", "B", "C", "D"][i]}. {quiz.questions[currentQ].options[i]}
                        {isCorrect && " ✓"}
                      </span>
                      <span style={{ color: COLORS.muted }}>{d.count} ({pct}%)</span>
                    </div>
                    <div style={{
                      height: 8, background: COLORS.border,
                      borderRadius: 4, overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        width: `${pct}%`,
                        background: isCorrect ? COLORS.accent : COLORS.muted,
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
              <div style={{
                textAlign: "center", marginTop: 16, fontSize: 14,
                color: COLORS.accent, fontWeight: 700,
              }}>
                {questionStats.correctCount} / {questionStats.totalPlayers} got it right
              </div>
            </div>

            {Object.keys(scores).length > 0 && (
              <Leaderboard scores={scores} quiz={quiz} />
            )}

            <button
              onClick={nextQuestion}
              style={{
                width: "100%", background: COLORS.accent, color: "#000",
                border: "none", borderRadius: 10, padding: "14px",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
              }}>
              {currentQ + 1 < quiz.questions.length
                ? `Next Question (${currentQ + 2}/${quiz.questions.length}) →`
                : "🏁 End Quiz & Calculate Scores"}
            </button>
          </div>
        )}

        {/* FINISHED */}
        {phase === "finished" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🏆</div>
            <h2 style={{
              fontFamily: "Orbitron, sans-serif", fontSize: 24,
              marginBottom: 24, color: COLORS.accent,
            }}>
              FINAL SCORES
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
              {sortedScores.map((p, i) => (
                <div key={p.address} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: COLORS.card, border: `1px solid ${COLORS.border}`,
                  borderRadius: 10, padding: "12px 16px",
                }}>
                  <span style={{ fontSize: 20, width: 32 }}>{getRankEmoji(i + 1)}</span>
                  <span style={{ flex: 1, fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: COLORS.text }}>
                    {formatAddress(p.address)}
                  </span>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>
                    {p.correct}/{quiz.questions.length} correct
                  </span>
                  <span style={{
                    background: `${COLORS.accent}22`, border: `1px solid ${COLORS.accent}44`,
                    borderRadius: 6, padding: "4px 10px",
                    fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: COLORS.accent,
                  }}>
                    ⬡ {p.totalTokens} QTKN
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={distributeRewards}
              style={{
                width: "100%", background: COLORS.accent, color: "#000",
                border: "none", borderRadius: 10, padding: "16px",
                fontSize: 16, fontWeight: 700, cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif", marginBottom: 12,
              }}>
              ⬡ Distribute Rewards to All Students
            </button>
            <button
              onClick={handleGameEnd}
              style={{
                width: "100%", background: "transparent",
                color: COLORS.muted, border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: "12px",
                fontSize: 14, cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
              }}>
              Back to Dashboard
            </button>
          </div>
        )}

        {/* DISTRIBUTING */}
        {phase === "distributing" && (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 22, color: COLORS.accent }}>
            Rewards Sent!
            </h2>
            <p style={{ color: COLORS.muted, marginTop: 8, marginBottom: 32 }}>
            Students are claiming their QTKN tokens.
            </p>
            <button
            onClick={handleGameEnd}
            style={{
                background: COLORS.accent, color: "#000",
                border: "none", borderRadius: 10, padding: "14px 32px",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
            }}>
            ← Back to Dashboard
            </button>
        </div>
        )}

      </div>
    </div>
  );
}
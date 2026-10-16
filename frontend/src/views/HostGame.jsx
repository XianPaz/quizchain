import { useState, useEffect, useRef } from "react";
import { useQuizSocket } from "../hooks/useQuizSocket";
import { COLORS } from "../styles/colors";
import { getRankEmoji, formatAddress } from "../utils/helpers";
import { distributeRewards } from "../utils/blockchain";
import { copy } from "../copy/es-AR.js";
import HighlightsBanner from "../components/HighlightsBanner";

function Leaderboard({ scores, players, quiz }) {
  const sorted = Object.entries(scores)
    .map(([address, s]) => ({ address, ...s }))
    .sort((a, b) => (b.totalPoints ?? b.totalTokens ?? 0) - (a.totalPoints ?? a.totalTokens ?? 0));

  // Build address → nickname map from players list
  const nicknameMap = {};
  players.forEach(p => { nicknameMap[p.address] = p.name; });

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 10 }}>
        {copy.game.leaderboard}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((p, i) => (
          <div key={p.address} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 10, padding: "10px 14px",
          }}>
            <span style={{ fontSize: 16, width: 28 }}>{getRankEmoji(i + 1)}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
              {nicknameMap[p.address] || formatAddress(p.address)}
            </span>
            <span style={{ color: COLORS.muted, fontSize: 12 }}>
              {quiz ? copy.host.correctOf(p.correct, quiz.questions.length) : `${p.correct}`}
              {p.streak >= 3 ? ` · 🔥${p.streak}` : ""}
            </span>
            <span style={{
              background: `${COLORS.accent}22`, border: `1px solid ${COLORS.accent}44`,
              borderRadius: 6, padding: "3px 8px",
              fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: COLORS.accent,
            }}>
              {p.totalPoints ?? p.totalTokens ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function HostGame({ quiz, wallet, onGameEnd, resumeData }) {
  const [phase, setPhase] = useState("lobby");
  // lobby | question_active | waiting_answers | showing_stats | finished | distributing
  const [currentQ, setCurrentQ] = useState(0);
  const [players, setPlayers] = useState([]);
  const [answerCount, setAnswerCount] = useState({ answered: 0, total: 0 });
  const [questionStats, setQuestionStats] = useState(null);
  const [scores, setScores] = useState({});
  const [allAnswered, setAllAnswered] = useState(false);
  const [distributingPending, setDistributingPending] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [distributeError, setDistributeError] = useState("");
  const [highlights, setHighlights] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startCountdown = (seconds) => {
    clearTimer();
    setTimeRemaining(seconds);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const { emit } = useQuizSocket(quiz.roomCode, "host", {
    
    player_joined: ({ players }) => setPlayers(players),
    
    answer_count: (data) => {
      setAnswerCount(data);
      if (data.answered >= data.total) setAllAnswered(true);
    },
    
    all_answered: () => setAllAnswered(true),
    question_stats: (stats) => {
      clearTimer();
      setQuestionStats(stats);
      if (stats.scores) setScores(stats.scores);
      if (stats.highlights) setHighlights(stats.highlights);
      setPhase("showing_stats");
    },
    
    quiz_ended: ({ scores }) => {
      setScores(scores);
      setPhase("finished");
    },
    
    rewards_distributed: () => setPhase("distributing"),
  });

  useEffect(() => {
    if (!resumeData) return;

    const { status, currentQuestion, scores, players, questionStats, answeredCount, txHash, remainingTime, highlights } = resumeData;

    setPlayers(players || []);
    setScores(scores || {});
    setCurrentQ(currentQuestion === -1 ? 0 : currentQuestion);
    if (highlights) setHighlights(highlights);

    if (status === "waiting" || status === "active") {
      setPhase("lobby");
    } else if (status === "question_open") {
      setPhase("question_active");
      const answered = answeredCount ?? 0;
      const total = players.length;
      setAnswerCount({ answered, total });
      setAllAnswered(answered >= total && total > 0);
      const q = quiz.questions[currentQuestion === -1 ? 0 : currentQuestion];
      startCountdown(remainingTime ?? q?.timeLimit ?? 20);
    } else if (status === "showing_stats") {
      if (questionStats) setQuestionStats(questionStats);
      setPhase("showing_stats");
    } else if (status === "finished") {
      setPhase("finished");
    } else if (status === "distributing") {
      if (txHash) setTxHash(txHash);
      setPhase("distributing");
    }
  }, [resumeData]);


  useEffect(() => () => clearTimer(), []);

  const startQuiz = () => {
    emit("host_start_quiz");
    setPhase("question_active");
    setAllAnswered(false);
    setAnswerCount({ answered: 0, total: players.length });
    setHighlights(null);
    startCountdown(quiz.questions[0]?.timeLimit || 20);
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
      setHighlights(null);
      setPhase("question_active");
      startCountdown(quiz.questions[next]?.timeLimit || 20);
      emit("host_open_question", { questionIndex: next });
    }
  };

  const handleGameEnd = () => {
    emit("host_end_without_distribute");
    onGameEnd();
  };

  const distributeRewardsOnChain = async () => {
    setDistributeError("");
    setDistributingPending(true);
    try {
      const hash = await distributeRewards(scores);
      setTxHash(hash);
      emit("host_distribute", { txHash: hash });
      setPhase("distributing");
    } catch (err) {
      setDistributeError(err.message || "Transaction failed");
    } finally {
      setDistributingPending(false);
    }
  };

  const question = quiz.questions[currentQ];
  const sortedScores = Object.entries(scores)
    .map(([address, s]) => ({ address, ...s }))
    .sort((a, b) => (b.totalPoints ?? b.totalTokens ?? 0) - (a.totalPoints ?? a.totalTokens ?? 0));

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "Space Grotesk, sans-serif" }}>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 24px", borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
      }}>
        <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 14, color: COLORS.accent }}>
          {copy.host.console}
        </span>
        <div style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`,
          borderRadius: 8, padding: "6px 14px", fontSize: 13, color: COLORS.muted,
        }}>
          {copy.host.room}: <strong style={{ fontFamily: "JetBrains Mono, monospace", letterSpacing: 4, color: COLORS.accent }}>
            {quiz.roomCode}
          </strong>
        </div>
        <span style={{ color: COLORS.muted, fontSize: 13 }}>
          {copy.host.joined(players.length)}
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
              {copy.host.questionsCount(quiz.questions.length)}
            </p>

            {/* Room code display */}
            <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: "24px 40px", display: "inline-block", marginBottom: 16,
            }}>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>{copy.host.shareCode}</div>
            <div style={{
                fontFamily: "Orbitron, sans-serif", fontSize: 42, fontWeight: 900,
                color: COLORS.accent, letterSpacing: 10,
            }}>
                {quiz.roomCode}
            </div>
            </div>

            {/* Waiting message — now below the box */}
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 32 }}>
            {copy.host.waitingStudents}
            </p>

            {/* Player list */}
            {players.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 10 }}>
                  {copy.host.studentsInLobby}
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
              {players.length === 0 ? copy.host.startDisabled : copy.host.start(players.length)}
            </button>
          </div>
        )}

        {/* QUESTION ACTIVE */}
        {phase === "question_active" && (
          <div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: COLORS.muted }}>
                {copy.host.questionOf(currentQ + 1, quiz.questions.length)}
              </div>
              <div style={{
                fontFamily: "Orbitron, sans-serif", fontSize: 28, fontWeight: 900,
                color: timeRemaining <= 5 ? COLORS.red : COLORS.accent,
              }}>
                {timeRemaining}s
              </div>
            </div>
            <div style={{
              height: 6, background: COLORS.border, borderRadius: 3,
              overflow: "hidden", marginBottom: 20,
            }}>
              <div style={{
                height: "100%",
                background: timeRemaining <= 5 ? COLORS.red : COLORS.accent,
                borderRadius: 3,
                width: `${question?.timeLimit ? (timeRemaining / question.timeLimit) * 100 : 0}%`,
                transition: "width 1s linear",
              }} />
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
                    {["A", "B", "C", "D", "E", "F"][i]}. {opt}
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
                {copy.host.answered}
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
              {allAnswered || timeRemaining === 0
                ? copy.host.showResults
                : copy.host.closeNow}
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
              {copy.host.results(currentQ + 1)}
            </div>

            {/* Question description */}
            <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: 20, marginBottom: 16,
            fontSize: 16, fontWeight: 700, color: COLORS.text, lineHeight: 1.5,
            }}>
            {quiz.questions[currentQ].question}
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
                        {["A", "B", "C", "D", "E", "F"][i]}. {quiz.questions[currentQ].options[i]}
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
                {copy.host.gotItRight(questionStats.correctCount, questionStats.totalPlayers)}
              </div>
            </div>

            <HighlightsBanner highlights={highlights} />

            {Object.keys(scores).length > 0 && (
              <Leaderboard scores={scores} players={players} quiz={quiz} />
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
                ? copy.host.nextQuestion(currentQ + 2, quiz.questions.length)
                : copy.host.endQuiz}
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
              {copy.host.finalScores}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
              {sortedScores.map((p, i) => {
                const nickname = players.find(pl => pl.address === p.address)?.name;
                return (
                  <div key={p.address} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: COLORS.card, border: `1px solid ${COLORS.border}`,
                    borderRadius: 10, padding: "12px 16px",
                  }}>
                    <span style={{ fontSize: 20, width: 32 }}>{getRankEmoji(i + 1)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>
                        {nickname || formatAddress(p.address)}
                      </div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: COLORS.muted }}>
                        {formatAddress(p.address)}
                      </div>
                    </div>
                    <span style={{ color: COLORS.muted, fontSize: 12 }}>
                      {copy.host.correctOf(p.correct, quiz.questions.length)}
                    </span>
                    <span style={{
                      background: `${COLORS.accent}22`, border: `1px solid ${COLORS.accent}44`,
                      borderRadius: 6, padding: "4px 10px",
                      fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: COLORS.accent,
                    }}>
                      ⬡ {p.totalQtkn ?? p.totalTokens ?? 0} QTKN
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={distributeRewardsOnChain}
              disabled={distributingPending}
              style={{
                width: "100%", background: distributingPending ? COLORS.border : COLORS.accent,
                color: distributingPending ? COLORS.muted : "#000",
                border: "none", borderRadius: 10, padding: "16px",
                fontSize: 16, fontWeight: 700,
                cursor: distributingPending ? "not-allowed" : "pointer",
                fontFamily: "Space Grotesk, sans-serif", marginBottom: 12,
              }}>
              {distributingPending ? copy.host.distributing : copy.host.distribute}
            </button>

            {distributeError && (
              <div style={{
                background: `${COLORS.red}11`, border: `1px solid ${COLORS.red}44`,
                borderRadius: 8, padding: "10px 14px",
                color: COLORS.red, fontSize: 13, marginBottom: 12,
              }}>
                ⚠️ {distributeError}
              </div>
            )}

            <button
              onClick={handleGameEnd}
              style={{
                width: "100%", background: "transparent",
                color: COLORS.muted, border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: "12px",
                fontSize: 14, cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
              }}>
              {copy.host.backToDashboard}
            </button>
          </div>
        )}

        {/* DISTRIBUTING */}
        {phase === "distributing" && (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 22, color: COLORS.accent }}>
              {copy.host.rewardsSent}
            </h2>
            <p style={{ color: COLORS.muted, marginTop: 8, marginBottom: 16 }}>
              {copy.host.rewardsSentBody}
            </p>
            {txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}33`,
                  borderRadius: 8, padding: "8px 14px", marginBottom: 24,
                  fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                  color: COLORS.accent, textDecoration: "none",
                }}>
                {copy.host.viewOnEtherscan}
              </a>
            )}
            <br />
            <button
              onClick={handleGameEnd}
              style={{
                background: COLORS.accent, color: "#000",
                border: "none", borderRadius: 10, padding: "14px 32px",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
              }}>
              ← {copy.host.backToDashboard}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
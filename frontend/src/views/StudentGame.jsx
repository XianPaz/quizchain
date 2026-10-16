import { useState, useEffect, useRef } from "react";
import { useQuizSocket } from "../hooks/useQuizSocket";
import { COLORS } from "../styles/colors";
import { formatAddress, getRankEmoji, placeLabel, pointsToTokens, normalizeAddress, sameAddress } from "../utils/helpers";
import { getTokenBalance } from "../utils/blockchain";
import { CONTRACTS } from "../config";
import HighlightsBanner from "../components/HighlightsBanner";

function Leaderboard({ scores, players, myAddress, quiz }) {
  const sorted = Object.entries(scores)
    .map(([address, s]) => ({ address, ...s }))
    .sort((a, b) => (b.totalPoints ?? b.totalTokens ?? 0) - (a.totalPoints ?? a.totalTokens ?? 0));

  const nicknameMap = {};
  players.forEach(p => { nicknameMap[p.address] = p.name; });

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 10 }}>
        LEADERBOARD
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((p, i) => {
          const isMe = sameAddress(p.address, myAddress);
          return (
            <div key={p.address} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: isMe ? `${COLORS.accent}11` : COLORS.card,
              border: `1px solid ${isMe ? COLORS.accent + "44" : COLORS.border}`,
              borderRadius: 10, padding: "10px 14px",
            }}>
              <span style={{ fontSize: 16, width: 28 }}>{getRankEmoji(i + 1)}</span>
              <span style={{
                flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 400,
                color: isMe ? COLORS.accent : COLORS.text,
              }}>
                {nicknameMap[p.address] || formatAddress(p.address)}
                {isMe && <span style={{ color: COLORS.muted, fontSize: 11 }}> (you)</span>}
              </span>
              <span style={{ color: COLORS.muted, fontSize: 12 }}>
                {p.correct}{quiz ? `/${quiz.questions.length}` : ""} correct
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
          );
        })}
      </div>
    </div>
  );
};

export default function StudentGame({ quiz, wallet, nickname, resumeData, onPlayAgain, onGameEnd }) {
  const [phase, setPhase] = useState("lobby_wait");
  // lobby_wait | answering | answer_wait | viewing_stats | finished | claiming | claimed
  const [currentQ, setCurrentQ] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [questionStats, setQuestionStats] = useState(null);
  const [allScores, setAllScores] = useState({});
  const myAddress = normalizeAddress(wallet?.address);
  const myScore = (myAddress && allScores[myAddress]) || null;
  const [players, setPlayers] = useState([]);
  const [balance, setBalance] = useState(null);
  const [highlights, setHighlights] = useState(null);
  const timerRef = useRef(null);
  const questionOpenedAt = useRef(null);
  const emitRef = useRef(null);
  const pendingRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const secondsLeft = (deadline, fallback) => {
    if (deadline != null) return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    return fallback ?? 0;
  };

  const armDeadlineTimer = (deadline, timeLimit) => {
    clearTimer();
    const limit = timeLimit || 20;
    const left = secondsLeft(deadline, limit);
    setTimeRemaining(left);
    questionOpenedAt.current = deadline != null ? deadline - limit * 1000 : Date.now();
    if (left <= 0) {
      setPhase((prev) => (prev === "answering" ? "answer_wait" : prev));
      return;
    }
    timerRef.current = setInterval(() => {
      const next = secondsLeft(deadline, 0);
      setTimeRemaining(next);
      if (next <= 0) {
        clearTimer();
        setPhase((prev) => (prev === "answering" ? "answer_wait" : prev));
      }
    }, 250);
  };

  useEffect(() => {
    if (!resumeData) return;
    const {
      status, currentQuestion, scores, players, alreadyAnswered,
      questionStats, remainingTime, deadline, highlights,
    } = resumeData;

    setPlayers(players || []);
    setAllScores(scores || {});
    setCurrentQ(currentQuestion === -1 ? 0 : currentQuestion);
    if (highlights) setHighlights(highlights);

    if (status === "waiting" || status === "active") {
      setPhase("lobby_wait");
    } else if (status === "question_open") {
      setAnswered(alreadyAnswered || false);
      if (alreadyAnswered) {
        setPhase("answer_wait");
      } else {
        setPhase("answering");
        const q = quiz.questions[currentQuestion === -1 ? 0 : currentQuestion];
        const fromRemaining = remainingTime != null
          ? Date.now() + remainingTime * 1000
          : null;
        armDeadlineTimer(deadline ?? fromRemaining, q?.timeLimit);
      }
    } else if (status === "showing_stats") {
      if (questionStats) setQuestionStats(questionStats);
      setPhase("viewing_stats");
    } else if (status === "finished") {
      setPhase("finished");
    } else if (status === "claiming") {
      setPhase("claiming");
    }
  }, [resumeData]);

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (phase === "claiming" && wallet?.address) {
      getTokenBalance(wallet.address).then(b => setBalance(parseFloat(b).toFixed(2)));
    }
  }, [phase]);

  const question = quiz.questions[currentQ];

  const { emit } = useQuizSocket(quiz.roomCode, "student", {
    player_joined: ({ players }) => setPlayers(players),

    quiz_started: () => {
      setPhase("lobby_wait"); // wait for first question_opened
    },

    question_opened: ({ questionIndex, deadline, timeLimit }) => {
      clearTimer();
      pendingRef.current = false;
      setCurrentQ(questionIndex);
      setSelectedAnswer(null);
      setAnswered(false);
      setQuestionStats(null);
      setHighlights(null);
      setPhase("answering");
      const limit = timeLimit || quiz.questions[questionIndex]?.timeLimit;
      armDeadlineTimer(deadline, limit);
    },

    answer_ack: () => {
      clearTimer();
      pendingRef.current = false;
      setAnswered(true);
      setPhase("answer_wait");
    },

    answer_rejected: ({ reason }) => {
      pendingRef.current = false;
      if (reason === "after_deadline" || reason === "question_not_open") {
        clearTimer();
        setSelectedAnswer(null);
        setAnswered(true);
        setPhase("answer_wait");
        return;
      }
      setSelectedAnswer(null);
      setAnswered(false);
    },

    question_stats: (stats) => {
      clearTimer();
      setQuestionStats(stats);
      if (stats.scores) setAllScores(stats.scores);
      if (stats.highlights) setHighlights(stats.highlights);
      setPhase("viewing_stats");
    },

    quiz_ended: ({ scores }) => {
      setAllScores(scores);
      setPhase("finished");
    },

    session_cancelled: ({ scores }) => {
      setAllScores(scores);
      setPhase("cancelled");
    },

    rewards_distributed: ({ scores }) => {
      setAllScores(scores);
      setPhase("claiming");
    },

    session_resumed: ({
      status, currentQuestion, scores, players, alreadyAnswered,
      questionStats, highlights, remainingTime, deadline,
    }) => {
      setPlayers(players);
      setAllScores(scores);
      setCurrentQ(currentQuestion === -1 ? 0 : currentQuestion);
      if (highlights) setHighlights(highlights);

      if (status === "waiting" || status === "active") {
        setPhase("lobby_wait");
      } else if (status === "question_open") {
        setAnswered(alreadyAnswered);
        if (alreadyAnswered) {
          setPhase("answer_wait");
        } else {
          setPhase("answering");
          const q = quiz.questions[currentQuestion === -1 ? 0 : currentQuestion];
          const fromRemaining = remainingTime != null
            ? Date.now() + remainingTime * 1000
            : null;
          armDeadlineTimer(deadline ?? fromRemaining, q?.timeLimit);
        }
      } else if (status === "showing_stats") {
        if (questionStats) setQuestionStats(questionStats);
        setPhase("viewing_stats");
      } else if (status === "finished") {
        setPhase("finished");
      } else if (status === "claiming") {
        setPhase("claiming");
      }
    },

  });

  emitRef.current = emit;

  const handleAnswer = (answerIndex) => {
    if (answered || pendingRef.current || phase !== "answering") return;
    pendingRef.current = true;
    setSelectedAnswer(answerIndex);
    emit("student_answer", {
      questionIndex: currentQ,
      answerIndex,
    });
  };

  const sortedScores = Object.entries(allScores)
    .map(([address, s]) => ({ address, ...s }))
    .sort((a, b) => (b.totalPoints ?? b.totalTokens ?? 0) - (a.totalPoints ?? a.totalTokens ?? 0));

  const myRank = sortedScores.findIndex((s) => sameAddress(s.address, myAddress)) + 1;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "Space Grotesk, sans-serif" }}>

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 24px", borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
      }}>
        <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 14, color: COLORS.accent }}>
          QUIZCHAIN
        </span>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: COLORS.muted }}>
          {formatAddress(wallet?.address)}
        </span>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px" }}>

        {/* WAITING FOR HOST */}
        {phase === "lobby_wait" && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 22, marginBottom: 8, color: COLORS.text }}>
              {quiz.name}
            </h2>
            <p style={{ color: COLORS.muted }}>Waiting for the host to start the quiz...</p>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}33`,
              borderRadius: 8, padding: "8px 16px", marginTop: 24, fontSize: 13, color: COLORS.text
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: COLORS.accent,
                display: "inline-block", boxShadow: `0 0 6px ${COLORS.accent}`,
              }} />
              Connected to room <strong style={{ color: COLORS.accent }}>{quiz.roomCode}</strong>
            </div>
          </div>
        )}

        {/* ANSWERING */}
        {phase === "answering" && (
          <div>
            {/* Timer */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 16,
            }}>
              <span style={{ color: COLORS.muted, fontSize: 13 }}>
                Question {currentQ + 1} / {quiz.questions.length}
              </span>
              <div style={{
                fontFamily: "Orbitron, sans-serif", fontSize: 28, fontWeight: 900,
                color: timeRemaining <= 5 ? COLORS.red : COLORS.accent,
              }}>
                {timeRemaining}s
              </div>
            </div>

            <div style={{
              height: 6, background: COLORS.border, borderRadius: 3,
              overflow: "hidden", marginBottom: 24,
            }}>
              <div style={{
                height: "100%",
                background: timeRemaining <= 5 ? COLORS.red : COLORS.accent,
                borderRadius: 3,
                width: `${(timeRemaining / question.timeLimit) * 100}%`,
                transition: "width 1s linear",
              }} />
            </div>

            <div style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: 24, marginBottom: 20, fontSize: 18, fontWeight: 700, color: COLORS.text
            }}>
              {question.question}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {question.options.map((opt, i) => (
                <div
                  key={i}
                  onClick={() => handleAnswer(i)}
                  style={{
                    background: selectedAnswer === i ? `${COLORS.blue}22` : COLORS.card,
                    border: `2px solid ${selectedAnswer === i ? COLORS.blue : COLORS.border}`,
                    borderRadius: 10, padding: "16px 20px",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
                    fontSize: 15, fontWeight: 500, transition: "all 0.15s", color: COLORS.text
                  }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    background: [COLORS.red, "#f97316", COLORS.blue, COLORS.purple, "#06b6d4", "#84cc16"][i],
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14, color: "#fff",
                  }}>
                    {["A", "B", "C", "D", "E", "F"][i]}
                  </div>
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WAITING AFTER ANSWERING */}
        {phase === "answer_wait" && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              {selectedAnswer !== null ? "✅" : "⏱️"}
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: COLORS.text }}>
              {selectedAnswer !== null ? "Answer submitted!" : "Time's up!"}
            </h3>
            <p style={{ color: COLORS.muted }}>
              Waiting for all students to answer...
            </p>
          </div>
        )}

        {/* VIEWING STATS */}
        {phase === "viewing_stats" && questionStats && (
          <div>
            <div style={{
              textAlign: "center", fontFamily: "Orbitron, sans-serif",
              fontSize: 18, marginBottom: 20, color: COLORS.accent,
            }}>
              QUESTION {currentQ + 1} RESULTS
            </div>

            {/* Question description */}
            <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 12, padding: 20, marginBottom: 16,
            fontSize: 16, fontWeight: 700, color: COLORS.text, lineHeight: 1.5,
            }}>
            {quiz.questions[currentQ].question}
            </div>

            {(() => {
              const gotIt = (myScore?.lastPoints ?? 0) > 0;
              const label = gotIt ? "⚡ Correct!" : selectedAnswer === null ? "⏱️ Time's up" : "✗ Wrong answer";
              return (
              <div style={{
                background: gotIt ? `${COLORS.accent}22` : `${COLORS.red}22`,
                border: `1px solid ${gotIt ? COLORS.accent + "55" : COLORS.red + "55"}`,
                borderRadius: 10, padding: 16, textAlign: "center",
                marginBottom: 20,
                color: gotIt ? COLORS.accent : COLORS.red
              }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{label}</div>
                {gotIt && myScore?.lastPlace && (
                  <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
                    {placeLabel(myScore.lastPlace)} to answer correctly
                  </div>
                )}
                <div style={{
                  fontFamily: "Orbitron, sans-serif", fontSize: 32, fontWeight: 900, marginTop: 6,
                }}>
                  {gotIt ? `+${myScore.lastPoints}` : "+0"}
                </div>
                <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
                  ⬡ {gotIt ? pointsToTokens(myScore.lastPoints) : 0} QTKN
                </div>
                {gotIt && myScore?.streak >= 2 && (
                  <div style={{ fontSize: 13, marginTop: 4 }}>🔥 {myScore.streak} streak</div>
                )}
              </div>
              );
            })()}

            <HighlightsBanner highlights={highlights} myAddress={myAddress} />

            {/* Distribution */}
            <div style={{
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 12, padding: 20, marginBottom: 20,
            }}>
              {questionStats.distribution.map((d, i) => {
                const pct = questionStats.totalPlayers > 0
                  ? Math.round((d.count / questionStats.totalPlayers) * 100) : 0;
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
                    <div style={{ height: 8, background: COLORS.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 4, width: `${pct}%`,
                        background: isCorrect ? COLORS.accent : COLORS.muted,
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {Object.keys(allScores).length > 0 && (
              <Leaderboard scores={allScores} players={players} myAddress={myAddress} quiz={quiz} />
            )}

            <p style={{ textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
              Waiting for host to continue...
            </p>
          </div>
        )}

        {/* CANCELLED */}
        {phase === "cancelled" && (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>😔</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 22, marginBottom: 8, color: COLORS.text }}>
            Session Ended
            </h2>
            <p style={{ color: COLORS.muted, marginBottom: 24 }}>
            The host ended the session without distributing rewards.
            </p>
            {myScore && (
            <div style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`,
                borderRadius: 12, padding: 20, marginBottom: 24,
            }}>
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>YOUR SCORE</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text }}>
                {myScore.correct}/{quiz.questions.length} correct
                </div>
            </div>
            )}
            <button
            onClick={onPlayAgain}
            style={{
                background: COLORS.card, color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: "12px 28px",
                fontSize: 14, cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
            }}>
            Back to Home
            </button>
        </div>
        )}

        {/* FINISHED — waiting for distribution */}
        {phase === "finished" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🏁</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 22, marginBottom: 8, color: COLORS.text }}>
              Quiz Complete!
            </h2>
            {myScore && (
              <div style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`,
                borderRadius: 12, padding: 24, marginBottom: 24,
              }}>
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>YOUR SCORE</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.text }}>
                      {myScore.correct}/{quiz.questions.length}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>Correct</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.accent }}>
                      {myScore.totalPoints ?? 0}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>Points</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900 }}>{getRankEmoji(myRank)}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>Rank</div>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(allScores).length > 0 && (
              <Leaderboard scores={allScores} players={players} myAddress={myAddress} quiz={quiz} />
            )}

            <p style={{ color: COLORS.muted, fontSize: 14 }}>
              ⏳ Waiting for host to distribute rewards...
            </p>
          </div>
        )}

        {/* CLAIMING */}
        {phase === "claiming" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 22, marginBottom: 8, color: COLORS.accent }}>
              Tokens Received!
            </h2>
            <div style={{
              background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}44`,
              borderRadius: 12, padding: 24, marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>YOU RECEIVED</div>
              <div style={{
                fontFamily: "Orbitron, sans-serif", fontSize: 42, fontWeight: 900,
                color: COLORS.accent,
              }}>
                {myScore?.totalTokens ?? "—"} QTKN
              </div>
              {balance && (
                <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 8 }}>
                  Your new balance: <strong style={{ color: COLORS.text }}>{balance} QTKN</strong>
                </div>
              )}
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
                Sent to {formatAddress(wallet?.address)} on Sepolia
              </div>
            </div>
            <a
              href={`https://sepolia.etherscan.io/token/${CONTRACTS.QUIZ_TOKEN}?a=${wallet?.address}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}33`,
                borderRadius: 8, padding: "8px 14px", marginBottom: 24,
                fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                color: COLORS.accent, textDecoration: "none",
              }}>
              🔗 View on Etherscan
            </a>

            <br />
            <button
              onClick={onPlayAgain}
              style={{
                background: COLORS.card, color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: "12px 28px",
                fontSize: 14, cursor: "pointer",
                fontFamily: "Space Grotesk, sans-serif",
              }}>
              Play Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
import { useState, useEffect, useRef } from "react";
import { useQuizSocket } from "../hooks/useQuizSocket";
import { useDeadlineTimer } from "../hooks/useDeadlineTimer";
import { COLORS } from "../styles/colors";
import { formatAddress, getRankEmoji, placeLabel, pointsToTokens, normalizeAddress } from "../utils/helpers";
import { getTokenBalance } from "../utils/blockchain";
import { CONTRACTS } from "../config";
import { copy } from "../copy/es-AR.js";
import HighlightsBanner from "../components/HighlightsBanner";
import Leaderboard from "../components/Leaderboard";
import { rankedScores } from "../utils/ranking";

export default function StudentGame({ quiz, wallet, nickname, resumeData, onPlayAgain, onGameEnd }) {
  const [phase, setPhase] = useState("lobby_wait");
  // lobby_wait | answering | answer_wait | viewing_stats | finished | claiming | claimed
  const [currentQ, setCurrentQ] = useState(0);
  const { timeRemaining, arm: armDeadlineTimer, stop: clearTimer } = useDeadlineTimer();
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [questionStats, setQuestionStats] = useState(null);
  const [allScores, setAllScores] = useState({});
  const myAddress = normalizeAddress(wallet?.address);
  const myScore = (myAddress && allScores[myAddress]) || null;
  const [players, setPlayers] = useState([]);
  const [balance, setBalance] = useState(null);
  const [highlights, setHighlights] = useState(null);
  const pendingRef = useRef(false);
  // Los handlers del socket se registran una sola vez, así que leen de una ref.
  const applyResumeRef = useRef(() => {});

  const onDeadlineReached = () => {
    setPhase((prev) => (prev === "answering" ? "answer_wait" : prev));
  };

  // Se le pasa cuánto falta, no la hora del servidor: el reloj del celular puede
  // estar corrido y la resta daría cero.
  const armQuestion = (secondsLeft, timeLimit) => {
    armDeadlineTimer(secondsLeft, timeLimit, onDeadlineReached);
  };

  // Usado por la prop resumeData y por session_resumed cuando vuelve el socket.
  // Estaba escrito dos veces, y la copia del socket no tenía estas guardas.
  const applyResume = (data) => {
    if (!data) return;
    const {
      status, currentQuestion, scores, players, alreadyAnswered,
      questionStats, remainingTime, highlights,
    } = data;

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
        armQuestion(remainingTime, q?.timeLimit);
      }
    } else if (status === "showing_stats") {
      if (questionStats) setQuestionStats(questionStats);
      setPhase("viewing_stats");
    } else if (status === "finished") {
      setPhase("finished");
    } else if (status === "claiming") {
      setPhase("claiming");
    }
  };

  useEffect(() => {
    applyResumeRef.current = applyResume;
  });

  useEffect(() => {
    applyResumeRef.current(resumeData);
  }, [resumeData]);

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

    question_opened: ({ questionIndex, timeLimit }) => {
      clearTimer();
      pendingRef.current = false;
      setCurrentQ(questionIndex);
      setSelectedAnswer(null);
      setAnswered(false);
      setQuestionStats(null);
      setHighlights(null);
      setPhase("answering");
      const limit = timeLimit || quiz.questions[questionIndex]?.timeLimit;
      armQuestion(limit, limit);
    },

    answer_ack: () => {
      clearTimer();
      pendingRef.current = false;
      setAnswered(true);
      setPhase("answer_wait");
    },

    answer_rejected: ({ reason }) => {
      pendingRef.current = false;
      // duplicate: la respuesta ya quedó registrada en el servidor. Volver a
      // "podés responder" la hacía desaparecer de la pantalla y el alumno
      // reintentaba para siempre. seat_moved tampoco se puede reintentar.
      const noSeRetoca = ["after_deadline", "question_not_open", "duplicate", "seat_moved"];
      if (noSeRetoca.includes(reason)) {
        clearTimer();
        if (reason !== "duplicate") setSelectedAnswer(null);
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

    session_resumed: (data) => applyResumeRef.current(data),
  });

  const handleAnswer = (answerIndex) => {
    if (answered || pendingRef.current || phase !== "answering") return;
    pendingRef.current = true;
    setSelectedAnswer(answerIndex);
    emit("student_answer", {
      questionIndex: currentQ,
      answerIndex,
    });
  };

  // The place comes from the server, which ranks with ties and pays by that rank.
  const myRank = myScore?.rank ?? (rankedScores(allScores).findIndex(
    (s) => s.address === myAddress
  ) + 1);

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
            <p style={{ color: COLORS.muted }}>{copy.game.waitingStart}</p>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}33`,
              borderRadius: 8, padding: "8px 16px", marginTop: 24, fontSize: 13, color: COLORS.text
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: COLORS.accent,
                display: "inline-block", boxShadow: `0 0 6px ${COLORS.accent}`,
              }} />
              {copy.game.connectedTo} <strong style={{ color: COLORS.accent }}>{quiz.roomCode}</strong>
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
                {copy.game.questionOf(currentQ + 1, quiz.questions.length)}
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
              {selectedAnswer !== null ? copy.game.answerSent : copy.game.timeout}
            </h3>
            <p style={{ color: COLORS.muted }}>
              {copy.game.waitingAllAnswers}
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
              {copy.game.results(currentQ + 1)}
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
              const label = gotIt
                ? copy.game.correct
                : selectedAnswer === null ? `⏱️ ${copy.game.timeout}` : copy.game.incorrect;
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
                    {copy.game.placeToAnswer(placeLabel(myScore.lastPlace))}
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
                  <div style={{ fontSize: 13, marginTop: 4 }}>{copy.game.streakBadge(myScore.streak)}</div>
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
              <Leaderboard scores={allScores} players={players} quiz={quiz} myAddress={myAddress} />
            )}

            <p style={{ textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
              {copy.game.waitingNextQuestion}
            </p>
          </div>
        )}

        {/* CANCELLED */}
        {phase === "cancelled" && (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>😔</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 22, marginBottom: 8, color: COLORS.text }}>
            {copy.game.cancelledTitle}
            </h2>
            <p style={{ color: COLORS.muted, marginBottom: 24 }}>
            {copy.game.cancelledBody}
            </p>
            {myScore && (
            <div style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`,
                borderRadius: 12, padding: 20, marginBottom: 24,
            }}>
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>{copy.game.yourScore}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text }}>
                {copy.game.correctOf(myScore.correct, quiz.questions.length)}
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
            {copy.game.backHome}
            </button>
        </div>
        )}

        {/* FINISHED — waiting for distribution */}
        {phase === "finished" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🏁</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 22, marginBottom: 8, color: COLORS.text }}>
              {copy.game.finishedTitle}
            </h2>
            {myScore && (
              <div style={{
                background: COLORS.card, border: `1px solid ${COLORS.border}`,
                borderRadius: 12, padding: 24, marginBottom: 24,
              }}>
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 12 }}>{copy.game.yourScore}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.text }}>
                      {myScore.correct}/{quiz.questions.length}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{copy.game.statCorrect}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.accent }}>
                      {myScore.totalPoints ?? 0}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{copy.game.statQtkn}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 900 }}>{getRankEmoji(myRank)}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{copy.game.statRank}</div>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(allScores).length > 0 && (
              <Leaderboard scores={allScores} players={players} quiz={quiz} myAddress={myAddress} />
            )}

            <p style={{ color: COLORS.muted, fontSize: 14 }}>
              {copy.game.waitingRewards}
            </p>
          </div>
        )}

        {/* CLAIMING */}
        {phase === "claiming" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontFamily: "Orbitron, sans-serif", fontSize: 22, marginBottom: 8, color: COLORS.accent }}>
              {copy.game.claimedTitle}
            </h2>
            <div style={{
              background: `${COLORS.accent}11`, border: `1px solid ${COLORS.accent}44`,
              borderRadius: 12, padding: 24, marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>{copy.game.claimedLabel}</div>
              <div style={{
                fontFamily: "Orbitron, sans-serif", fontSize: 42, fontWeight: 900,
                color: COLORS.accent,
              }}>
                {myScore?.totalTokens ?? "—"} QTKN
              </div>
              {balance && (
                <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 8 }}>
                  {copy.game.newBalance}: <strong style={{ color: COLORS.text }}>{balance} QTKN</strong>
                </div>
              )}
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
                {copy.game.sentTo(formatAddress(wallet?.address))}
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
              {copy.game.viewOnEtherscan}
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
              {copy.game.playAgain}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
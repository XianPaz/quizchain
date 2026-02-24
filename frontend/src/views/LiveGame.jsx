import { styles } from "../styles/styles";
import { COLORS } from "../styles/colors";
import { useState, useRef, useCallback } from "react";
import { calcTokenReward, calcSpeedScore, formatAddress, getRankEmoji } from "../utils/helpers";
import TimerCircle from "../components/TimerCircle";
import SpeedIndicator from "../components/SpeedIndicator";
import TokenRain from "../components/TokenRain";

 export default function LiveGame({ quiz, wallet, isHost, onGameEnd }) {
  const [phase, setPhase] = useState("lobby"); // lobby | question | reveal | leaderboard | results
  const [currentQ, setCurrentQ] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [speedScores, setSpeedScores] = useState([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [tokenRains, setTokenRains] = useState([]);
  const [players, setPlayers] = useState([
    { address: wallet?.address || "0x1234...5678", score: 0, tokens: 0, name: "You" },
    { address: "0xAbCd...1234", score: 0, tokens: 0, name: "Player2" },
    { address: "0xDEAD...BEEF", score: 0, tokens: 0, name: "CryptoKing" },
    { address: "0xBEEF...CAFE", score: 0, tokens: 0, name: "QuizMaster" },
  ]);
  const timerRef = useRef(null);
  const questionStart = useRef(null);
  const roomCode = useRef(quiz.roomCode);

  const question = quiz.questions[currentQ];

  const spawnTokenRain = useCallback(() => {
    const rains = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: 100 + Math.random() * (window.innerWidth - 200),
      y: Math.random() * 200,
    }));
    setTokenRains(rains);
    setTimeout(() => setTokenRains([]), 2000);
  }, []);

  const startQuestion = useCallback(() => {
    setPhase("question");
    setSelectedAnswer(null);
    setAnswered(false);
    setTimeRemaining(question.timeLimit);
    questionStart.current = Date.now();

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          revealAnswer(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [question]);

  const revealAnswer = useCallback((selected) => {
    clearInterval(timerRef.current);
    setAnswered(true);
    setPhase("reveal");

    const elapsed = (Date.now() - questionStart.current) / 1000;
    const remaining = Math.max(0, question.timeLimit - elapsed);
    const speedPct = Math.round((remaining / question.timeLimit) * 100);
    const isCorrect = selected === question.correct;

    if (isCorrect) {
      setSpeedScores(prev => [...prev, speedPct]);
      setCorrectCount(prev => prev + 1);
      const earned = Math.round(10 * (1 + speedPct / 100));
      setScore(prev => prev + earned);
      spawnTokenRain();

      // Update player leaderboard (simulate others)
      setPlayers(prev => prev.map((p, i) => {
        if (i === 0) return { ...p, score: p.score + earned, tokens: p.tokens + earned };
        const r = Math.random();
        const othersCorrect = r > 0.3;
        const otherSpeed = Math.round(Math.random() * 80 + 10);
        const otherEarned = othersCorrect ? Math.round(10 * (1 + otherSpeed / 100)) : 0;
        return { ...p, score: p.score + otherEarned, tokens: p.tokens + otherEarned };
      }));
    }

    setTimeout(() => {
      if (currentQ + 1 < quiz.questions.length) {
        setPhase("leaderboard");
        setTimeout(() => {
          setCurrentQ(prev => prev + 1);
          startQuestion();
        }, 3000);
      } else {
        setPhase("results");
      }
    }, 2000);
  }, [question, currentQ, quiz.questions.length, spawnTokenRain, startQuestion]);

  const handleAnswer = (idx) => {
    if (answered) return;
    setSelectedAnswer(idx);
    revealAnswer(idx);
  };

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const myFinalTokens = calcTokenReward(correctCount, speedScores, quiz.questions.length);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg }}>
      <style>{styles}</style>

      {/* Token rain */}
      {tokenRains.map(r => <TokenRain key={r.id} x={r.x} y={r.y} />)}

      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 24px", borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
      }}>
        <div className="brand" style={{ fontSize: 14, color: COLORS.accent }}>QUIZCHAIN</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="token-badge">⬡ {score} QTKN</div>
          <div style={{
            background: COLORS.card, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: "6px 12px", fontSize: 13,
          }}>
            📍 Room: <strong className="mono">{roomCode.current}</strong>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 20px" }}>

        {/* LOBBY */}
        {phase === "lobby" && (
          <div className="slide-up" style={{ opacity: 0, textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎯</div>
            <h2 style={{ fontFamily: "Orbitron", fontSize: 28, marginBottom: 8 }}>{quiz.name}</h2>
            <p style={{ color: COLORS.muted, marginBottom: 32 }}>
              {quiz.questions.length} questions · Speed rewards active
            </p>
            <div className="card" style={{ marginBottom: 24, display: "inline-block", padding: "20px 40px" }}>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>ROOM CODE</div>
              <div style={{
                fontFamily: "Orbitron", fontSize: 36, fontWeight: 900,
                color: COLORS.accent, letterSpacing: 8,
              }}>
                {roomCode.current}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                Share with players
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              {players.map((p, i) => (
                <div key={i} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: COLORS.card, border: `1px solid ${COLORS.border}`,
                  borderRadius: 8, padding: "6px 12px", margin: 4, fontSize: 13,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent, display: "inline-block" }} />
                  {p.name}
                  {p.address === wallet?.address && (
                    <span style={{ color: COLORS.muted, fontSize: 11 }}>(you)</span>
                  )}
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-lg" onClick={startQuestion}>
              ▶ Start Quiz
            </button>
          </div>
        )}

        {/* QUESTION */}
        {(phase === "question" || phase === "reveal") && (
          <div className="fade-in">
            {/* Progress */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 16,
            }}>
              <div style={{ color: COLORS.muted, fontSize: 13 }}>
                Question <strong>{currentQ + 1}</strong> of {quiz.questions.length}
              </div>
              <TimerCircle timeRemaining={timeRemaining} timeLimit={question.timeLimit} />
            </div>

            {/* Timer bar */}
            <div className="progress-bar" style={{ marginBottom: 24 }}>
              <div className="progress-fill"
                style={{
                  width: `${(timeRemaining / question.timeLimit) * 100}%`,
                  background: timeRemaining <= 5 ? COLORS.red : COLORS.accent,
                }}
              />
            </div>

            {/* Question */}
            <div className="card" style={{ marginBottom: 20, padding: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>
                {question.question}
              </div>
            </div>

            {/* Answers */}
            <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
              {question.options.map((opt, i) => {
                let cls = "answer-option";
                if (phase === "reveal") {
                  if (i === question.correct) cls += " correct";
                  else if (i === selectedAnswer && selectedAnswer !== question.correct) cls += " wrong";
                  cls += " disabled";
                } else if (i === selectedAnswer) {
                  cls += " selected";
                }

                const letter = ["A", "B", "C", "D"][i];
                return (
                  <div key={i} className={cls} onClick={() => handleAnswer(i)}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                      background: [COLORS.red, "#f97316", COLORS.blue, COLORS.purple][i],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 14, color: "#fff",
                    }}>
                      {letter}
                    </div>
                    {opt}
                    {phase === "reveal" && i === question.correct && (
                      <span style={{ marginLeft: "auto", color: COLORS.accent, fontSize: 18 }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reveal feedback */}
            {phase === "reveal" && (
              <div className="bounce-in card" style={{
                borderColor: selectedAnswer === question.correct
                  ? `${COLORS.accent}66` : `${COLORS.red}66`,
                background: selectedAnswer === question.correct
                  ? "#00ff8811" : "#f8717111",
                padding: 16, textAlign: "center",
              }}>
                {selectedAnswer === question.correct ? (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>⚡ Correct!</div>
                    <SpeedIndicator
                      speedPct={calcSpeedScore(timeRemaining, question.timeLimit)}
                    />
                  </div>
                ) : selectedAnswer === null ? (
                  <div style={{ color: COLORS.red }}>⏱ Time's up!</div>
                ) : (
                  <div style={{ color: COLORS.red }}>✗ Wrong answer</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* BETWEEN QUESTIONS LEADERBOARD */}
        {phase === "leaderboard" && (
          <div className="slide-up" style={{ opacity: 0 }}>
            <h3 style={{ textAlign: "center", fontFamily: "Orbitron", marginBottom: 20, color: COLORS.accent }}>
              LEADERBOARD
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedPlayers.map((p, i) => (
                <div key={p.address} className={`lb-row top-${i + 1}`}
                  style={{ animationDelay: `${i * 0.1}s` }}>
                  <span style={{ fontSize: 20, width: 32 }}>{getRankEmoji(i + 1)}</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>
                    {p.name}
                    {p.address === wallet?.address &&
                      <span style={{ color: COLORS.accent, fontSize: 12 }}> (you)</span>}
                  </span>
                  <div className="token-badge">⬡ {p.tokens}</div>
                  <span style={{
                    fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 16,
                    color: COLORS.text, width: 60, textAlign: "right",
                  }}>{p.score}pt</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {phase === "results" && (
          <div className="bounce-in" style={{ textAlign: "center", paddingTop: 20 }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>🎉</div>
            <h2 style={{ fontFamily: "Orbitron", fontSize: 28, marginBottom: 4 }}>Quiz Complete!</h2>
            <p style={{ color: COLORS.muted, marginBottom: 32 }}>
              Final results & token distribution
            </p>

            {/* Your stats */}
            <div className="card" style={{
              marginBottom: 24, padding: 24,
              borderColor: `${COLORS.accent}44`, background: "#00ff8808",
            }}>
              <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 12 }}>YOUR PERFORMANCE</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {[
                  { label: "Correct", value: `${correctCount}/${quiz.questions.length}` },
                  { label: "Avg Speed", value: speedScores.length > 0 ? `${Math.round(speedScores.reduce((a, b) => a + b, 0) / speedScores.length)}%` : "0%" },
                  { label: "Rank", value: getRankEmoji(sortedPlayers.findIndex(p => p.address === wallet?.address) + 1) },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="divider" />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <span style={{ color: COLORS.muted, fontSize: 14 }}>Tokens earned:</span>
                <div style={{
                  fontFamily: "Orbitron", fontSize: 32, fontWeight: 900,
                  color: COLORS.accent,
                }}>
                  ⬡ {myFinalTokens} QTKN
                </div>
              </div>

              <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 8 }}>
                Will be minted to {formatAddress(wallet?.address || "0x...")} on Sepolia
              </div>
            </div>

            {/* Final leaderboard */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, textAlign: "left" }}>
                Final Leaderboard
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedPlayers.map((p, i) => {
                  const isMe = p.address === wallet?.address;
                  return (
                    <div key={p.address} className={`lb-row top-${i + 1}`}
                      style={{ border: isMe ? `1px solid ${COLORS.accent}44` : undefined }}>
                      <span style={{ fontSize: 18, width: 28 }}>{getRankEmoji(i + 1)}</span>
                      <span style={{ flex: 1, fontWeight: isMe ? 700 : 400 }}>
                        {p.name} {isMe && <span style={{ color: COLORS.accent, fontSize: 11 }}>← you</span>}
                      </span>
                      <div className="token-badge" style={{ fontSize: 11 }}>
                        ⬡ {i === 0 ? myFinalTokens + 10 : i === 1 ? myFinalTokens + 5 : i === 2 ? myFinalTokens : Math.max(5, myFinalTokens - 8)} QTKN
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn btn-primary btn-lg" onClick={() => {
                if (wallet) {
                  alert(`✅ Minting ${myFinalTokens} QTKN to ${wallet.address} on Sepolia!\n\nIn production, this calls:\nquizGame.finalizeAndDistribute(sessionId)`);
                } else {
                  alert("Connect your MetaMask wallet to receive tokens!");
                }
              }}>
                ⬡ Claim {myFinalTokens} QTKN
              </button>
              <button className="btn btn-secondary btn-lg" onClick={onGameEnd}>
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


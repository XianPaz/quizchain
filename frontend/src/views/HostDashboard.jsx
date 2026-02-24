import WalletBar from "../components/WalletBar";
import { styles } from "../styles/styles";
import { COLORS } from "../styles/colors";
import { useState } from "react";
import { SAMPLE_QUESTIONS, QUIZ_TOKEN_CONTRACT, QUIZ_GAME_CONTRACT } from "../constants/sampleData";

export default function HostDashboard({ wallet, onStartQuiz, onBack }) {
  const [tab, setTab] = useState("create");
  const [questions, setQuestions] = useState(SAMPLE_QUESTIONS);
  const [newQ, setNewQ] = useState({
    question: "", options: ["", "", "", ""], correct: 0, timeLimit: 15
  });
  const [quizName, setQuizName] = useState("Web3 Fundamentals Quiz");
  const [showContract, setShowContract] = useState(false);
  const [contractTab, setContractTab] = useState("token");

  const addQuestion = () => {
    if (!newQ.question.trim()) return;
    setQuestions(prev => [...prev, { ...newQ, id: Date.now() }]);
    setNewQ({ question: "", options: ["", "", "", ""], correct: 0, timeLimit: 15 });
  };

  const removeQuestion = (id) => setQuestions(prev => prev.filter(q => q.id !== id));

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg }}>
      <style>{styles}</style>

      {/* Top bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 24px", borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} className="btn btn-secondary btn-sm">← Back</button>
          <span className="brand" style={{ fontSize: 16, color: COLORS.accent }}>HOST DASHBOARD</span>
        </div>
        <WalletBar wallet={wallet} onConnect={() => {}} onDisconnect={() => {}} />
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
        {/* Tab bar */}
        <div className="tab-bar" style={{ marginBottom: 24 }}>
          {["create", "questions", "contracts"].map(t => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "create" ? "⚙️ Setup" : t === "questions" ? "❓ Questions" : "📜 Contracts"}
            </button>
          ))}
        </div>

        {/* SETUP TAB */}
        {tab === "create" && (
          <div className="slide-up" style={{ opacity: 0 }}>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Quiz Settings</div>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 6 }}>
                    QUIZ NAME
                  </label>
                  <input className="input" value={quizName}
                    onChange={e => setQuizName(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 6 }}>
                      QUESTIONS
                    </label>
                    <input className="input" value={questions.length} readOnly
                      style={{ opacity: 0.6 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: COLORS.muted, display: "block", marginBottom: 6 }}>
                      EST. REWARD POOL
                    </label>
                    <div className="token-badge" style={{ width: "100%", justifyContent: "center" }}>
                      ⬡ {questions.length * 10 * 2 + 5} QTKN max
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reward breakdown */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
                ⬡ Reward Formula
              </div>
              <div style={{
                background: COLORS.bg, borderRadius: 8, padding: 16,
                fontFamily: "JetBrains Mono", fontSize: 12, color: COLORS.muted,
                lineHeight: 2,
              }}>
                <div><span style={{ color: COLORS.accent }}>base</span> = correctAnswers × 10 QTKN</div>
                <div><span style={{ color: COLORS.yellow }}>speedBonus</span> = base × (answerTime/limit) × 2</div>
                <div><span style={{ color: COLORS.blue }}>accuracy</span> = correctAnswers / totalQuestions</div>
                <div style={{ marginTop: 8, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
                  <span style={{ color: COLORS.text }}>total</span> = (base + speedBonus) × accuracy + 5
                </div>
              </div>
            </div>

            {/* Deploy info */}
            <div className="card" style={{
              borderColor: `${COLORS.accent}44`, background: "#00ff8808",
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>🔗</span>
                <span style={{ fontWeight: 700 }}>Sepolia Deployment</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Network", value: "Sepolia Testnet" },
                  { label: "Chain ID", value: "11155111" },
                  { label: "Token", value: "QTKN (ERC-20)" },
                  { label: "Status", value: "⬡ Ready to deploy" },
                ].map(i => (
                  <div key={i.label} style={{ background: COLORS.surface, borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>{i.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{i.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-lg" style={{ width: "100%" }}
              onClick={() => onStartQuiz({ name: quizName, questions })}>
              🚀 Launch Quiz Session
            </button>
          </div>
        )}

        {/* QUESTIONS TAB */}
        {tab === "questions" && (
          <div className="slide-up" style={{ opacity: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {questions.map((q, i) => (
                <div key={q.id} className="card" style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div className="q-number">{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 15 }}>{q.question}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {q.options.map((opt, oi) => (
                          <div key={oi} style={{
                            padding: "6px 10px", borderRadius: 6, fontSize: 12,
                            background: oi === q.correct
                              ? `${COLORS.accent}22`
                              : COLORS.surface,
                            border: `1px solid ${oi === q.correct ? COLORS.accent + "44" : COLORS.border}`,
                            color: oi === q.correct ? COLORS.accent : COLORS.text,
                          }}>
                            {oi === q.correct ? "✓ " : ""}{opt}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <span className="tag" style={{
                          background: `${COLORS.yellow}22`, color: COLORS.yellow, borderColor: `${COLORS.yellow}44`,
                        }}>
                          ⏱ {q.timeLimit}s
                        </span>
                        <span className="tag" style={{
                          background: `${COLORS.accent}22`, color: COLORS.accent,
                        }}>
                          ⬡ up to {q.timeLimit <= 10 ? 20 : 15} QTKN
                        </span>
                      </div>
                    </div>
                    <button onClick={() => removeQuestion(q.id)}
                      style={{
                        background: "none", border: "none", color: COLORS.muted,
                        cursor: "pointer", fontSize: 18, padding: 4,
                      }}>×</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add question form */}
            <div className="card" style={{ borderStyle: "dashed" }}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: COLORS.muted }}>+ Add Question</div>
              <div style={{ display: "grid", gap: 12 }}>
                <input className="input" placeholder="Question text..."
                  value={newQ.question}
                  onChange={e => setNewQ(p => ({ ...p, question: e.target.value }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {newQ.options.map((opt, i) => (
                    <input key={i} className="input"
                      placeholder={`Option ${i + 1}${i === newQ.correct ? " ✓ correct" : ""}`}
                      value={opt}
                      style={{ borderColor: i === newQ.correct ? `${COLORS.accent}66` : undefined }}
                      onChange={e => {
                        const opts = [...newQ.options];
                        opts[i] = e.target.value;
                        setNewQ(p => ({ ...p, options: opts }));
                      }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: COLORS.muted }}>Correct answer (0-3):</label>
                    <input className="input" type="number" min="0" max="3"
                      value={newQ.correct}
                      onChange={e => setNewQ(p => ({ ...p, correct: +e.target.value }))} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: COLORS.muted }}>Time limit (sec):</label>
                    <input className="input" type="number" min="5" max="60"
                      value={newQ.timeLimit}
                      onChange={e => setNewQ(p => ({ ...p, timeLimit: +e.target.value }))} />
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 18 }}
                    onClick={addQuestion}>Add</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTRACTS TAB */}
        {tab === "contracts" && (
          <div className="slide-up" style={{ opacity: 0 }}>
            <div style={{ marginBottom: 16, color: COLORS.muted, fontSize: 14, lineHeight: 1.6 }}>
              Deploy these two contracts to Sepolia Testnet using Hardhat or Remix IDE.
              Deploy <strong>QuizToken</strong> first, then pass its address to <strong>QuizGame</strong>,
              and finally call <code style={{ fontFamily: "JetBrains Mono", fontSize: 12 }}>setQuizGameContract()</code> on the token.
            </div>

            <div className="tab-bar" style={{ marginBottom: 16 }}>
              {["token", "game"].map(t => (
                <button key={t} className={`tab ${contractTab === t ? "active" : ""}`}
                  onClick={() => setContractTab(t)}>
                  {t === "token" ? "📄 QuizToken.sol" : "🎮 QuizGame.sol"}
                </button>
              ))}
            </div>

            <div style={{ position: "relative" }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
                onClick={() => {
                  navigator.clipboard.writeText(
                    contractTab === "token" ? QUIZ_TOKEN_CONTRACT : QUIZ_GAME_CONTRACT
                  );
                }}>
                📋 Copy
              </button>
              <div className="code-block" style={{ maxHeight: 500 }}>
                {(contractTab === "token" ? QUIZ_TOKEN_CONTRACT : QUIZ_GAME_CONTRACT)
                  .split("\n")
                  .map((line, i) => (
                    <div key={i} style={{ display: "flex" }}>
                      <span style={{
                        color: COLORS.border, width: 30, flexShrink: 0,
                        fontSize: 10, paddingRight: 10, userSelect: "none",
                      }}>{i + 1}</span>
                      <span>{line}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>📦 Hardhat Setup</div>
              <div className="code-block" style={{ fontSize: 12 }}>
                {`npm init -y && npm i hardhat @openzeppelin/contracts
npx hardhat init

# Deploy to Sepolia (in scripts/deploy.js)
const token = await ethers.deployContract("QuizToken");
await token.waitForDeployment();

const game = await ethers.deployContract("QuizGame", [token.target]);
await game.waitForDeployment();

await token.setQuizGameContract(game.target);

# .env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=your_deployer_private_key`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


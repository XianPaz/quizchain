import { useState } from "react";
import { COLORS } from "../styles/colors";
import { styles } from "../styles/styles";
import WalletBar from "../components/WalletBar";
import { parseQuizCSV } from "../utils/parseQuizCSV";

export default function HostDashboard({ wallet, onStartQuiz, onBack }) {
  const [tab, setTab] = useState("upload");
  const [questions, setQuestions] = useState([]);
  const [quizName, setQuizName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragging, setDragging] = useState(false);

  const processFile = (file) => {
    setUploadError("");
    setUploadSuccess(false);

    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setUploadError("Please upload a .csv file. Export from Google Sheets via File → Download → CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { quizName: name, questions: qs } = parseQuizCSV(e.target.result);
        setQuizName(name);
        setQuestions(qs);
        setUploadSuccess(true);
        setTab("preview");
      } catch (err) {
        setUploadError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

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
          {["upload", "preview"].map(t => (
            <button
              key={t}
              className={`tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
              disabled={t === "preview" && questions.length === 0}
            >
              {t === "upload" ? "📂 Upload Quiz" : `👁 Preview (${questions.length})`}
            </button>
          ))}
        </div>

        {/* UPLOAD TAB */}
        {tab === "upload" && (
          <div className="slide-up" style={{ opacity: 0 }}>

            {/* Template instructions */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
                📋 Google Sheets Template
              </div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.8, marginBottom: 16 }}>
                Create a Google Sheet following this exact structure, then export as CSV:
              </div>

              {/* Template table */}
              <div style={{ overflowX: "auto", marginBottom: 16 }}>
                <table style={{
                  width: "100%", borderCollapse: "collapse",
                  fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                }}>
                  <tbody>
                    {[
                      ["quiz_name", "My Quiz Title", "", "", "", "", "", "", ""],
                      ["", "", "", "", "", "", "", "", ""],
                      ["question", "option_a", "option_b", "option_c", "option_d", "option_e", "option_f", "correct", "time_limit"],
                      ["What is Ethereum?", "A blockchain", "A database", "A coin", "A protocol", "", "", "A", "20"],
                      ["True or false?", "True", "False", "", "", "", "", "B", "10"],
                    ].map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{
                            padding: "6px 10px",
                            border: `1px solid ${COLORS.border}`,
                            background: ri === 2
                              ? COLORS.surface
                              : ri === 0 && ci < 2
                                ? `${COLORS.accent}11`
                                : COLORS.bg,
                            color: ri === 2
                              ? COLORS.muted
                              : ci === 7 && ri > 2
                                ? COLORS.accent
                                : COLORS.text,
                            fontWeight: ri === 2 || (ri === 0 && ci === 0) ? 700 : 400,
                            whiteSpace: "nowrap",
                            opacity: cell === "" ? 0.3 : 1,
                          }}>
                            {cell || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.8 }}>
                <div>• <strong style={{ color: COLORS.text }}>Row 1:</strong> quiz_name in A1, your quiz title in B1</div>
                <div>• <strong style={{ color: COLORS.text }}>Row 2:</strong> leave empty</div>
                <div>• <strong style={{ color: COLORS.text }}>Row 3:</strong> column headers (required, not imported)</div>
                <div>• <strong style={{ color: COLORS.text }}>Row 4+:</strong> one question per row</div>
                <div>• <strong style={{ color: COLORS.text }}>options:</strong> 2 to 6 columns (option_a to option_f), leave unused columns empty</div>
                <div>• <strong style={{ color: COLORS.text }}>correct:</strong> must be A, B, C, D, E or F matching the number of options</div>
                <div>• <strong style={{ color: COLORS.text }}>time_limit:</strong> seconds between 5 and 120</div>
              </div>

              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: `${COLORS.blue}11`, border: `1px solid ${COLORS.blue}33`,
                borderRadius: 8, fontSize: 12, color: COLORS.blue,
              }}>
                💡 In Google Sheets: <strong>File → Download → Comma Separated Values (.csv)</strong>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("csv-input").click()}
              style={{
                border: `2px dashed ${dragging ? COLORS.accent : COLORS.border}`,
                borderRadius: 12, padding: "48px 24px",
                textAlign: "center", cursor: "pointer",
                background: dragging ? `${COLORS.accent}08` : COLORS.card,
                transition: "all 0.2s", marginBottom: 16,
              }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text, marginBottom: 6 }}>
                Drop your CSV file here
              </div>
              <div style={{ color: COLORS.muted, fontSize: 13 }}>
                or click to browse
              </div>
              <input
                id="csv-input"
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />
            </div>

            {/* Error */}
            {uploadError && (
              <div style={{
                background: `${COLORS.red}11`, border: `1px solid ${COLORS.red}44`,
                borderRadius: 8, padding: "12px 16px",
                color: COLORS.red, fontSize: 13,
              }}>
                ⚠️ {uploadError}
              </div>
            )}
          </div>
        )}

        {/* PREVIEW TAB */}
        {tab === "preview" && questions.length > 0 && (
          <div className="slide-up" style={{ opacity: 0 }}>

            {/* Quiz info */}
            <div className="card" style={{
              marginBottom: 20, borderColor: `${COLORS.accent}44`,
              background: `${COLORS.accent}08`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>QUIZ NAME</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{quizName}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 4 }}>QUESTIONS</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.accent }}>
                    {questions.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Question list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {questions.map((q, i) => (
                <div key={q.id} className="card">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: COLORS.purple, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 14, flexShrink: 0, color: "#fff",
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 15, color: COLORS.text }}>
                        {q.question}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {q.options.map((opt, oi) => (
                          <div key={oi} style={{
                            padding: "6px 10px", borderRadius: 6, fontSize: 12,
                            background: oi === q.correct ? `${COLORS.accent}22` : COLORS.surface,
                            border: `1px solid ${oi === q.correct ? COLORS.accent + "44" : COLORS.border}`,
                            color: oi === q.correct ? COLORS.accent : COLORS.text,
                          }}>
                            {["A", "B", "C", "D", "E", "F"][oi]}. {opt}
                            {oi === q.correct && " ✓"}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 10px", borderRadius: 999, fontSize: 11,
                          fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase",
                          background: `${COLORS.yellow}22`, color: COLORS.yellow,
                        }}>
                          ⏱ {q.timeLimit}s
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setTab("upload"); setQuestions([]); setQuizName(""); setUploadSuccess(false); }}>
                ↩ Upload Different File
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2, fontSize: 16 }}
                onClick={() => onStartQuiz({ name: quizName, questions })}>
                🚀 Launch Quiz Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

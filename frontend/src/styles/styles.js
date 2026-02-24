import { COLORS } from "./colors";  // optional: extract COLORS too

export const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@700;900&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${COLORS.bg};
    color: ${COLORS.text};
    font-family: 'Space Grotesk', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  .mono { font-family: 'JetBrains Mono', monospace; }
  .brand { font-family: 'Orbitron', sans-serif; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }

  /* Animations */
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  @keyframes countdown {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: 283; }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes bounce-in {
    0% { transform: scale(0.3); opacity: 0; }
    50% { transform: scale(1.05); }
    70% { transform: scale(0.9); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes tick {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(1.2); }
  }
  @keyframes correct-flash {
    0%, 100% { background: ${COLORS.card}; }
    50% { background: #00ff8833; }
  }
  @keyframes wrong-flash {
    0%, 100% { background: ${COLORS.card}; }
    50% { background: #f8717133; }
  }
  @keyframes token-rain {
    0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100px) rotate(360deg); opacity: 0; }
  }
  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 20px ${COLORS.accent}44; }
    50% { box-shadow: 0 0 40px ${COLORS.accent}88, 0 0 80px ${COLORS.accent}22; }
  }

  .slide-up { animation: slide-up 0.4s ease forwards; }
  .bounce-in { animation: bounce-in 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards; }
  .fade-in { animation: fade-in 0.3s ease forwards; }

  /* Noise texture overlay */
  .noise::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 9999;
    opacity: 0.4;
  }

  /* Grid background */
  .grid-bg {
    background-image:
      linear-gradient(${COLORS.border}22 1px, transparent 1px),
      linear-gradient(90deg, ${COLORS.border}22 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* Glow effects */
  .glow-green { box-shadow: 0 0 30px ${COLORS.accent}44; }
  .glow-purple { box-shadow: 0 0 30px ${COLORS.purple}44; }

  /* Button styles */
  .btn {
    cursor: pointer;
    border: none;
    border-radius: 8px;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600;
    font-size: 14px;
    padding: 12px 24px;
    transition: all 0.2s;
    letter-spacing: 0.5px;
  }
  .btn:active { transform: scale(0.97); }
  .btn-primary {
    background: ${COLORS.accent};
    color: #000;
  }
  .btn-primary:hover { background: ${COLORS.accentDim}; box-shadow: 0 0 20px ${COLORS.accent}66; }
  .btn-secondary {
    background: transparent;
    color: ${COLORS.text};
    border: 1px solid ${COLORS.border};
  }
  .btn-secondary:hover { border-color: ${COLORS.accent}; color: ${COLORS.accent}; }
  .btn-purple {
    background: ${COLORS.purple};
    color: #fff;
  }
  .btn-purple:hover { background: ${COLORS.purpleDim}; box-shadow: 0 0 20px ${COLORS.purple}66; }
  .btn-lg { padding: 16px 36px; font-size: 16px; border-radius: 10px; }
  .btn-sm { padding: 8px 16px; font-size: 12px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Input styles */
  .input {
    background: ${COLORS.card};
    border: 1px solid ${COLORS.border};
    border-radius: 8px;
    color: ${COLORS.text};
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px;
    padding: 10px 14px;
    width: 100%;
    transition: border-color 0.2s;
    outline: none;
  }
  .input:focus { border-color: ${COLORS.accent}; }
  .input::placeholder { color: ${COLORS.muted}; }

  /* Card */
  .card {
    background: ${COLORS.card};
    border: 1px solid ${COLORS.border};
    border-radius: 12px;
    padding: 20px;
  }

  /* Tag */
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* Answer option */
  .answer-option {
    background: ${COLORS.card};
    border: 2px solid ${COLORS.border};
    border-radius: 10px;
    padding: 16px 20px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 15px;
    font-weight: 500;
  }
  .answer-option:hover:not(.disabled) {
    border-color: ${COLORS.accent};
    background: #00ff8811;
    transform: translateX(4px);
  }
  .answer-option.selected { border-color: ${COLORS.blue}; background: #60a5fa11; }
  .answer-option.correct { border-color: ${COLORS.accent}; background: #00ff8822; animation: correct-flash 0.5s ease; }
  .answer-option.wrong { border-color: ${COLORS.red}; background: #f8717122; animation: wrong-flash 0.5s ease; }
  .answer-option.disabled { cursor: default; }

  /* Progress bar */
  .progress-bar {
    height: 4px;
    background: ${COLORS.border};
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: ${COLORS.accent};
    border-radius: 2px;
    transition: width 0.1s linear;
  }
  .progress-fill.urgent { background: ${COLORS.red}; }

  /* Leaderboard row */
  .lb-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    transition: all 0.3s;
  }
  .lb-row.top-1 { border-color: ${COLORS.yellow}44; background: #fbbf2411; }
  .lb-row.top-2 { border-color: #94a3b844; }
  .lb-row.top-3 { border-color: #cd7f3244; }

  /* Tabs */
  .tab-bar {
    display: flex;
    gap: 2px;
    background: ${COLORS.surface};
    padding: 4px;
    border-radius: 10px;
    border: 1px solid ${COLORS.border};
  }
  .tab {
    flex: 1;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    transition: all 0.2s;
    color: ${COLORS.muted};
    border: none;
    background: transparent;
    font-family: 'Space Grotesk', sans-serif;
  }
  .tab.active {
    background: ${COLORS.card};
    color: ${COLORS.text};
    border: 1px solid ${COLORS.border};
  }

  /* Code block */
  .code-block {
    background: #0d0d0d;
    border: 1px solid ${COLORS.border};
    border-radius: 8px;
    padding: 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    line-height: 1.6;
    overflow-x: auto;
    color: #a8b4c8;
    white-space: pre;
  }
  .code-keyword { color: #c792ea; }
  .code-type { color: #82aaff; }
  .code-string { color: #c3e88d; }
  .code-comment { color: #546e7a; font-style: italic; }
  .code-number { color: #f78c6c; }

  /* Token display */
  .token-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #00ff8811;
    border: 1px solid ${COLORS.accent}44;
    border-radius: 8px;
    padding: 6px 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: ${COLORS.accent};
    font-weight: 700;
  }

  /* Speed indicator */
  .speed-bar {
    height: 8px;
    border-radius: 4px;
    background: ${COLORS.border};
    overflow: hidden;
    margin-top: 4px;
  }
  .speed-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  /* Modal overlay */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: #00000088;
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 20px;
  }
  .modal {
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    border-radius: 16px;
    padding: 32px;
    max-width: 500px;
    width: 100%;
    animation: bounce-in 0.4s ease;
  }

  /* Wallet status dot */
  .wallet-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }
  .wallet-dot.connected {
    background: ${COLORS.accent};
    box-shadow: 0 0 6px ${COLORS.accent};
    animation: glow-pulse 2s ease infinite;
  }
  .wallet-dot.disconnected { background: ${COLORS.muted}; }

  /* Timer circle */
  .timer-svg circle {
    fill: none;
    stroke-width: 4;
    stroke-linecap: round;
    transform-origin: center;
    transform: rotate(-90deg);
  }

  /* Question number pill */
  .q-number {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${COLORS.purple};
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
  }

  /* Floating token animation */
  .token-float {
    position: fixed;
    pointer-events: none;
    z-index: 9998;
    font-size: 24px;
    animation: token-rain 1.5s ease-in forwards;
  }

  /* Section divider */
  .divider {
    height: 1px;
    background: ${COLORS.border};
    margin: 16px 0;
  }

  /* Tooltip */
  .tooltip {
    position: relative;
  }
  .tooltip:hover .tooltip-text {
    display: block;
  }
  .tooltip-text {
    display: none;
    position: absolute;
    bottom: 120%;
    left: 50%;
    transform: translateX(-50%);
    background: ${COLORS.card};
    border: 1px solid ${COLORS.border};
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 11px;
    white-space: nowrap;
    color: ${COLORS.muted};
    z-index: 10;
  }

  /* Scrollable container */
  .scroll-y {
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: ${COLORS.border} transparent;
  }

  .shimmer {
    background: linear-gradient(90deg, ${COLORS.card} 25%, ${COLORS.border} 50%, ${COLORS.card} 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
`;


import { COLORS } from "../styles/colors";

export default function TimerCircle({ timeRemaining, timeLimit, size = 80 }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const progress = timeRemaining / timeLimit;
  const strokeDashoffset = circumference * (1 - progress);
  const urgent = timeRemaining <= 5;
  const color = urgent ? COLORS.red : timeRemaining <= 10 ? COLORS.yellow : COLORS.accent;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 80 80" className="timer-svg">
        <circle cx="40" cy="40" r={radius} stroke={COLORS.border} strokeWidth="4" />
        <circle
          cx="40" cy="40" r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.2s linear, stroke 0.3s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "Orbitron", fontWeight: 700, fontSize: 18,
        color: urgent ? COLORS.red : COLORS.text,
      }}>
        {timeRemaining}
      </div>
    </div>
  );
}

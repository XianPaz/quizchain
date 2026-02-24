import { useState } from "react";
import { useWallet } from "./hooks/useWallet";
import LandingView    from "./views/LandingView";
import HostDashboard  from "./views/HostDashboard";
import JoinView       from "./views/JoinView";
import HostGame    from "./views/HostGame";
import StudentGame from "./views/StudentGame";
import { SAMPLE_QUESTIONS } from "./constants/sampleData";

import { createSession, validateSession } from "./api";
import socket from "./socket";

export default function App() {
  const [view, setView]           = useState("landing");
  const [activeQuiz, setActiveQuiz] = useState(null);
  const { wallet, connect, disconnect } = useWallet();
  const [role, setRole] = useState(null); // "host" | "student"
  const [activeSessions, setActiveSessions] = useState({});

  const handleStartQuiz = async (quizData) => {
    const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const result = await createSession(roomCode, quizData.name, quizData.questions);

    if (!result.success) {
      alert("Failed to create session: " + result.error);
      return;
    }

    socket.connect();
    socket.once("connect", () => {
      socket.emit("join_room", { roomCode, role: "host" });
    });

    setActiveQuiz({ ...quizData, roomCode });
    setRole("host");
    setView("game");
  };

  const handleJoinQuiz = async (code) => {
    const trimmed = code.toUpperCase();
    const result = await validateSession(trimmed);
    if (!result.success) return { error: result.error };

    socket.connect();
    socket.once("connect", () => {
      socket.emit("join_room", {
        roomCode: trimmed,
        player: { address: wallet?.address, name: wallet?.address?.slice(0, 6) },
        role: "student",
      });
    });

    setActiveQuiz(result.session);
    setRole("student");
    setView("game");
    return { success: true };
  };

  if (view === "game" && activeQuiz) {
    if (role === "host")
      return (
        <HostGame
          quiz={activeQuiz}
          wallet={wallet}
          onGameEnd={() => { setView("landing"); setActiveQuiz(null); }}
        />
      );

    return (
      <StudentGame
        quiz={activeQuiz}
        wallet={wallet}
        onPlayAgain={() => { setView("join"); setActiveQuiz(null); }}
        onGameEnd={() => { setView("landing"); setActiveQuiz(null); }}
      />
    );
  };

  if (view === "host")
    return ( 
      <HostDashboard 
        wallet={wallet} 
        onStartQuiz={handleStartQuiz} 
        onBack={() => setView("landing")} 
      />
    );

  if (view === "join")
    return (
      <JoinView
        wallet={wallet}
        onJoin={handleJoinQuiz}
        onBack={() => setView("landing")}
        onConnectWallet={connect}
        activeSessions={activeSessions}
      />
    );

  return (
    <LandingView 
      wallet={wallet} 
      onHostQuiz={() => setView("host")} 
      onJoinQuiz={() => setView("join")} 
      onConnectWallet={connect} 
    />
  );
}
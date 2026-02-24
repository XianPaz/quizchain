import { useState } from "react";
import { useWallet } from "./hooks/useWallet";
import LandingView    from "./views/LandingView";
import HostDashboard  from "./views/HostDashboard";
import JoinView       from "./views/JoinView";
import LiveGame       from "./views/LiveGame";
import { SAMPLE_QUESTIONS } from "./constants/sampleData";

import { createSession, validateSession } from "./api";
import socket from "./socket";

export default function App() {
  const [view, setView]           = useState("landing");
  const [activeQuiz, setActiveQuiz] = useState(null);
  const { wallet, connect, disconnect } = useWallet();

  const [activeSessions, setActiveSessions] = useState({});

  const handleStartQuiz = async (quizData) => {
    console.log("handleStartQuiz called", quizData); // ← add this
    const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    console.log("roomCode generated:", roomCode); // ← and this
    const result = await createSession(roomCode, quizData.name, quizData.questions);
    console.log("createSession result:", result); // ← and this

    if (!result.success) {
      alert("Failed to create session: " + result.error);
      return;
    }

    // Host joins the socket room
    socket.connect();
    socket.emit("join_room", { roomCode });

    setActiveQuiz({ ...quizData, roomCode });
    setView("game");
  };

  const handleJoinQuiz = async (code) => {
    const trimmed = code.toUpperCase();
    const result = await validateSession(trimmed);

    if (!result.success) return { error: result.error };

    // Player joins the socket room
    socket.connect();
    socket.emit("join_room", {
      roomCode: trimmed,
      player: { address: wallet?.address, name: wallet?.address?.slice(0, 6) },
    });

    setActiveQuiz(result.session);
    setView("game");
    return { success: true };
  };

  if (view === "game" && activeQuiz)
    return (
      <LiveGame 
        quiz={activeQuiz} 
        wallet={wallet} 
        onGameEnd={() => { setView("landing"); setActiveQuiz(null); }} 
      />
    );

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
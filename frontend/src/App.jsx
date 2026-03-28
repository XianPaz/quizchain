import { useState } from "react";
import { useWallet } from "./hooks/useWallet";
import LandingView    from "./views/LandingView";
import HostDashboard  from "./views/HostDashboard";
import JoinView       from "./views/JoinView";
import HostGame    from "./views/HostGame";
import StudentGame from "./views/StudentGame";
import { isMinter } from "./utils/blockchain";
import { SAMPLE_QUESTIONS } from "./constants/sampleData";

import { createSession, validateSession } from "./api";
import socket from "./socket";

export default function App() {
  const [view, setView]           = useState("landing");
  const [activeQuiz, setActiveQuiz] = useState(null);
  const { wallet, connect, disconnect, error: walletError, connecting } = useWallet();
  const [role, setRole] = useState(null); // "host" | "student"
  const [activeSessions, setActiveSessions] = useState({});
  const [nickname, setNickname] = useState("");
  const [minterError, setMinterError] = useState("");

  const handleHostQuiz = async () => {
    setMinterError("");

    if (!wallet?.address) {
      console.log("no wallet");
      setMinterError("Please connect your MetaMask wallet first.");
      return;
    }

    try {
      const allowed = await isMinter(wallet.address);
      console.log("isMinter result:", allowed);
      if (!allowed) {
        setMinterError("Your wallet is not authorized to host quizzes. Ask the contract owner to add you as a minter.");
        return;
      }
      setView("host");
    } catch (e) {
      console.log("error:", e);
      setMinterError("Could not verify wallet authorization. Check your connection and try again.");
    }
  };

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

  const handleJoinQuiz = async (code, nickname) => {
    const trimmed = code.toUpperCase();
    const result = await validateSession(trimmed);

    if (!result.success) return { error: result.error };

    socket.connect();
    socket.once("connect", () => {
      const address = wallet?.address;
      if (!address) {
        console.error("Wallet address not available");
        return;
      }
      socket.emit("join_room", {
        roomCode: trimmed,
        player: {
          address,
          name: nickname,
        },
        role: "student",
      });
    });

    setNickname(nickname);
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
        nickname={nickname}
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
        walletError={walletError}
        connecting={connecting}
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
        walletError={walletError}
        connecting={connecting}
      />
    );

  return (
    <LandingView 
      wallet={wallet} 
      onHostQuiz={handleHostQuiz} 
      onJoinQuiz={() => setView("join")} 
      onConnectWallet={connect} 
      onDisconnect={disconnect}
      walletError={walletError}
      minterError={minterError}
      connecting={connecting}
    />
  );
}
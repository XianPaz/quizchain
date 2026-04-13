import { useState, useEffect } from "react";
import { useWallet } from "./hooks/useWallet";
import LandingView    from "./views/LandingView";
import HostDashboard  from "./views/HostDashboard";
import JoinView       from "./views/JoinView";
import HostGame    from "./views/HostGame";
import StudentGame from "./views/StudentGame";
import RejoinView from "./views/RejoinView";
import { isMinter } from "./utils/blockchain";
import { loadSession, saveSession, clearSession } from "./hooks/useSessionPersistence";
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
  const [savedSession, setSavedSession] = useState(null);
  const [resumeData, setResumeData] = useState(null);
  const [studentResumeData, setStudentResumeData] = useState(null);

  useEffect(() => {
    try {
      const saved = loadSession();
      if (!saved) return;

      validateSession(saved.roomCode).then(result => {
        if (saved.role === "host") {
          // For hosts, allow reconnect as long as the session exists (even if finished).
          // Only a 404 (session gone) should clear the saved session.
          if (result.error === "No active quiz found with that code") {
            clearSession();
            return;
          }
          setSavedSession(saved);
          setView("rejoin");
          return;
        }

        // For students, allow reconnect as long as the session exists (even if finished).
        // Only a 404 (session gone) should clear the saved session.
        if (result.error === "No active quiz found with that code") {
          clearSession();
          return;
        }

        // Wait for session_resumed before navigating so StudentGame mounts
        // directly in the correct phase with no lobby_wait flash.
        socket.connect();
        socket.once("connect", () => {
          socket.once("session_resumed", (data) => {
            setStudentResumeData(data);
            setActiveQuiz(saved.quizData);
            setRole("student");
            if (saved.nickname) setNickname(saved.nickname);
            setView("game");
          });
          socket.emit("join_room", {
            roomCode: saved.roomCode,
            player: { address: saved.walletAddress, name: saved.nickname },
            role: "student",
          });
        });

      }).catch(() => {
        clearSession();
      });
    } catch (e) {
      clearSession();
    }
  }, []);

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

    saveSession({
      roomCode,
      quizData,
      role: "host",
      walletAddress: wallet?.address,
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

    saveSession({
      roomCode: trimmed,
      quizData: result.session,
      role: "student",
      walletAddress: wallet?.address,
      nickname,
    });

    setNickname(nickname);
    setActiveQuiz(result.session);
    setRole("student");
    setView("game");
    return { success: true };
  };

  const handleRejoin = () => {
    if (!savedSession) return;

    socket.connect();
    socket.once("connect", () => {
      socket.once("session_resumed", (data) => {
        setResumeData(data);
        setActiveQuiz({ ...savedSession.quizData, roomCode: savedSession.roomCode });
        setRole("host");
        setView("game");
      });

      socket.emit("join_room", {
        roomCode: savedSession.roomCode,
        role: "host",
        player: undefined,
      });
    });

    setActiveQuiz(savedSession.quizData);
    setRole("host");
    setView("game");
  };

  const handleLeaveSession = () => {
    clearSession();
    setSavedSession(null);
    setView("landing");
  };


  if (view === "game" && activeQuiz) {
    if (role === "host")
      return (
        <HostGame
          quiz={activeQuiz}
          wallet={wallet}
          onGameEnd={() => { setView("landing"); setActiveQuiz(null); }}
          resumeData={resumeData}
        />
      );

    return (
      <StudentGame
        quiz={activeQuiz}
        wallet={wallet}
        nickname={nickname}
        resumeData={studentResumeData}
        onPlayAgain={() => { clearSession(); setStudentResumeData(null); setView("join"); setActiveQuiz(null); }}
        onGameEnd={() => { clearSession(); setStudentResumeData(null); setView("landing"); setActiveQuiz(null); }}
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

  if (view === "rejoin" && savedSession)
  return (
    <RejoinView
      savedSession={savedSession}
      wallet={wallet}
      onRejoin={handleRejoin}
      onLeave={handleLeaveSession}
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
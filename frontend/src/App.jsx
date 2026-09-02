import { useState, useEffect, useRef } from "react";
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

import { createSession, validateSession, normalizeRoomCode } from "./api";
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
  const resumeAttempted = useRef(false);
  const joinPayloadRef = useRef(null);

  useEffect(() => {
    const onConnect = () => {
      if (joinPayloadRef.current) socket.emit("join_room", joinPayloadRef.current);
    };
    socket.on("connect", onConnect);
    return () => socket.off("connect", onConnect);
  }, []);

  const joinRoom = (payload) => {
    joinPayloadRef.current = payload;
    if (socket.connected) socket.emit("join_room", payload);
    else socket.connect();
  };

  useEffect(() => {
    if (resumeAttempted.current) return;
    try {
      const saved = loadSession();
      if (!saved) return;

      if (saved.role === "student") {
        if (!wallet?.address) return;
        if (wallet.address.toLowerCase() !== String(saved.walletAddress || "").toLowerCase()) {
          clearSession();
          resumeAttempted.current = true;
          return;
        }
      }

      resumeAttempted.current = true;

      validateSession(saved.roomCode).then(result => {
        if (saved.role === "host") {
          if (result.error === "No active quiz found with that code") {
            clearSession();
            return;
          }
          setSavedSession(saved);
          setView("rejoin");
          return;
        }

        if (result.error === "No active quiz found with that code") {
          clearSession();
          return;
        }

        socket.once("session_resumed", (data) => {
          setStudentResumeData(data);
          setActiveQuiz(saved.quizData);
          setRole("student");
          if (saved.nickname) setNickname(saved.nickname);
          setView("game");
        });
        socket.once("join_rejected", () => {
          joinPayloadRef.current = null;
          clearSession();
        });
        joinRoom({
          roomCode: saved.roomCode,
          player: { address: wallet.address, name: saved.nickname },
          role: "student",
        });

      }).catch(() => {
        clearSession();
      });
    } catch (e) {
      clearSession();
    }
  }, [wallet?.address]);

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
    const result = await createSession(undefined, quizData.name, quizData.questions);

    if (!result.success) {
      alert("No se pudo crear la sala: " + result.error);
      return;
    }

    const roomCode = result.session.roomCode;
    const hostToken = result.session.hostToken;

    joinRoom({ roomCode, role: "host", hostToken });

    saveSession({
      roomCode,
      quizData,
      role: "host",
      walletAddress: wallet?.address,
      hostToken,
    });
        
    setActiveQuiz({ ...quizData, roomCode });
    setRole("host");
    setView("game");
  };

  const handleJoinQuiz = async (code, nickname) => {
    const trimmed = normalizeRoomCode(code);
    const result = await validateSession(trimmed);

    if (!result.success) return { error: result.error };

    const roomCode = result.session.roomCode;
    const publicQuiz = {
      roomCode,
      name: result.session.name,
      questions: result.session.questions || [],
    };

    const address = wallet?.address;
    if (!address) return { error: "Conectá MetaMask primero." };

    const joinError = {
      seat_taken: "Esa wallet ya está en la sala.",
      quiz_already_started: "El quiz ya arrancó.",
      invalid_address: "La wallet no es válida.",
    };

    const outcome = await new Promise((resolve) => {
      const finish = (value) => {
        socket.off("join_accepted", onAccepted);
        socket.off("join_rejected", onRejected);
        resolve(value);
      };
      const onAccepted = () => finish({ success: true });
      const onRejected = ({ reason } = {}) => {
        finish({ error: joinError[reason] || "No se pudo entrar a la sala." });
      };
      socket.once("join_accepted", onAccepted);
      socket.once("join_rejected", onRejected);

      joinRoom({
        roomCode,
        player: { address, name: nickname },
        role: "student",
      });
    });

    if (!outcome.success) return outcome;

    saveSession({
      roomCode,
      quizData: publicQuiz,
      role: "student",
      walletAddress: address,
      nickname,
    });

    setNickname(nickname);
    setActiveQuiz(publicQuiz);
    setRole("student");
    setView("game");
    return { success: true };
  };

  const handleRejoin = () => {
    if (!savedSession) return;

    socket.once("session_resumed", (data) => {
      setResumeData(data);
      setActiveQuiz({ ...savedSession.quizData, roomCode: savedSession.roomCode });
      setRole("host");
      setView("game");
    });
    joinRoom({
      roomCode: savedSession.roomCode,
      role: "host",
      hostToken: savedSession.hostToken,
    });

    setActiveQuiz(savedSession.quizData);
    setRole("host");
    setView("game");
  };

  const handleLeaveSession = () => {
    joinPayloadRef.current = null;
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
          onGameEnd={() => { joinPayloadRef.current = null; setView("landing"); setActiveQuiz(null); }}
          resumeData={resumeData}
        />
      );

    return (
      <StudentGame
        quiz={activeQuiz}
        wallet={wallet}
        nickname={nickname}
        resumeData={studentResumeData}
        onPlayAgain={() => { joinPayloadRef.current = null; clearSession(); setStudentResumeData(null); setView("join"); setActiveQuiz(null); }}
        onGameEnd={() => { joinPayloadRef.current = null; clearSession(); setStudentResumeData(null); setView("landing"); setActiveQuiz(null); }}
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
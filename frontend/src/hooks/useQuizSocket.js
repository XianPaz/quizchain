import { useEffect, useCallback } from "react";
import socket from "../socket";

export function useQuizSocket(roomCode, role, handlers) {
  useEffect(() => {
    if (!roomCode) return;

    // Register all event handlers
    Object.entries(handlers).forEach(([event, fn]) => {
      socket.on(event, fn);
    });

    return () => {
      Object.entries(handlers).forEach(([event, fn]) => {
        socket.off(event, fn);
      });
    };
  }, [roomCode]);

  const emit = useCallback((event, data) => {
    socket.emit(event, { roomCode, ...data });
  }, [roomCode]);

  return { emit };
}
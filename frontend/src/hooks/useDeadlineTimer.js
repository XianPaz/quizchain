import { useEffect, useRef, useState } from "react";

// Un solo reloj para la pantalla del profe y la del alumno.
//
// Cuenta contra un instante local, calculado una sola vez al recibir el aviso del
// servidor. Dos motivos:
//
// - No se compara contra la hora límite absoluta del servidor. Esa hora está en
//   el reloj del servidor, y el del alumno puede estar adelantado. Si lo está, la
//   resta da cero y la pantalla se bloquea sin dejarlo responder, aunque el
//   servidor todavía acepte la respuesta.
// - Sí es un instante absoluto y no un contador que resta de a uno, así que una
//   pestaña en segundo plano, que el navegador frena, se pone al día sola en vez
//   de quedar atrasada respecto del servidor.
//
// El servidor manda el dato sin desfasaje: timeLimit al abrir la pregunta y
// remainingTime al reconectar. Los dos son duraciones, no horas.
export function useDeadlineTimer() {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timerRef = useRef(null);
  const targetRef = useRef(null);
  const onExpireRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  const secondsLeft = (target) => Math.max(0, Math.ceil((target - Date.now()) / 1000));

  // seconds es cuánto falta, en segundos. Sin un valor usable cae al tiempo de la
  // pregunta, nunca a cero: caer a cero era lo que bloqueaba la pantalla.
  const arm = (seconds, timeLimit, onExpire) => {
    clearTimer();
    const limit = Number(timeLimit) > 0 ? Number(timeLimit) : 20;
    const asked = Number(seconds);
    const left = Number.isFinite(asked) && asked >= 0 ? asked : limit;
    const target = Date.now() + left * 1000;
    targetRef.current = target;
    onExpireRef.current = onExpire || null;

    setTimeRemaining(Math.ceil(left));
    if (left <= 0) {
      onExpireRef.current?.();
      return;
    }

    timerRef.current = setInterval(() => {
      const next = secondsLeft(targetRef.current);
      setTimeRemaining(next);
      if (next <= 0) {
        clearTimer();
        onExpireRef.current?.();
      }
    }, 250);
  };

  const stop = () => {
    clearTimer();
    targetRef.current = null;
  };

  return { timeRemaining, arm, stop };
}

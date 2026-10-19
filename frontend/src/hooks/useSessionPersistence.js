const KEY = "quizchain_session";

export function saveSession(data) {
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}
// La última sala que abrió este profe, en localStorage para que sobreviva a
// cerrar la pestaña. Al crear otra se manda, y el servidor pasa a sus alumnos.
const LAST_HOSTED_KEY = "quizchain_last_hosted";

export function saveLastHosted({ roomCode, hostToken }) {
  try {
    localStorage.setItem(LAST_HOSTED_KEY, JSON.stringify({ roomCode, hostToken }));
  } catch {
    // Sin storage el profe igual puede crear salas; solo no se mueve a nadie.
  }
}

export function loadLastHosted() {
  try {
    const raw = localStorage.getItem(LAST_HOSTED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

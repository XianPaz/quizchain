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
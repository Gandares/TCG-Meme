const API_BASE = import.meta.env.VITE_API_BASE || "";

export const AUTH_STORAGE_KEY = "tcg-meme-auth";

export function loadAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveAuth(auth) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function assetUrl(path) {
  if (!path) {
    return "";
  }

  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
}

export async function fetchCards() {
  const response = await fetch(`${API_BASE}/api/cards`);
  if (!response.ok) {
    throw new Error("No se pudieron cargar las cartas.");
  }

  return response.json();
}

export async function login(username, password) {
  return postAuth("/api/auth/login", username, password);
}

export async function register(username, password) {
  return postAuth("/api/auth/register", username, password);
}

async function postAuth(path, username, password) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "No se pudo autenticar.");
  }

  return response.json();
}

export async function fetchCollection(token) {
  const response = await fetch(`${API_BASE}/api/collection`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error("No se pudo cargar la coleccion.");
  }

  return response.json();
}

export async function openPack(token) {
  const response = await fetch(`${API_BASE}/api/packs/open`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "No se pudo abrir el sobre.");
  }

  return response.json();
}

export async function createCard(card, token) {
  const body = new FormData();
  body.set("name", card.name);
  body.set("rarity", card.rarity);
  body.set("description", card.description);
  body.set("flavor", card.flavor);
  body.set("author", card.author);
  if (card.imageFile) {
    body.set("image", card.imageFile);
  }

  const response = await fetch(`${API_BASE}/api/cards`, {
    method: "POST",
    headers: authHeaders(token),
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "No se pudo guardar la carta.");
  }

  return response.json();
}

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || "127.0.0.1";
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const assetsDir = path.join(projectRoot, "assets");
const uploadsDir = path.join(assetsDir, "uploads");
const cardsFile = path.join(dataDir, "card.json");
const legacyCardsFile = path.join(dataDir, "cards.json");
const usersFile = path.join(dataDir, "users.json");
const tokenSecret = "tcg-meme-local-dev-secret";

const contentTypes = {
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

ensureStorage();

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://${host}:${port}`);

  if (requestUrl.pathname === "/api/auth/register" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const user = registerUser(payload);
      sendJson(response, createAuthResponse(user), 201);
    } catch (error) {
      sendJson(response, { error: error.message || "No se pudo registrar el usuario." }, 400);
    }
    return;
  }

  if (requestUrl.pathname === "/api/auth/login" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const user = loginUser(payload);
      sendJson(response, createAuthResponse(user));
    } catch (error) {
      sendJson(response, { error: error.message || "No se pudo iniciar sesion." }, 401);
    }
    return;
  }

  if (requestUrl.pathname === "/api/me" && request.method === "GET") {
    try {
      const user = requireUser(request);
      sendJson(response, publicUser(user));
    } catch (error) {
      sendJson(response, { error: error.message }, 401);
    }
    return;
  }

  if (requestUrl.pathname === "/api/cards" && request.method === "GET") {
    sendJson(response, readCards());
    return;
  }

  if (requestUrl.pathname === "/api/cards" && request.method === "POST") {
    try {
      const user = getOptionalUser(request);
      const payload = await readRequestBody(request);
      const card = createCard(payload);
      const cards = readCards();
      cards.unshift(card);
      writeCards(cards);
      if (user) {
        addCardsToUserCollection(user.username, [card.id]);
      }
      sendJson(response, card, 201);
    } catch (error) {
      sendJson(response, { error: error.message || "No se pudo guardar la carta." }, 400);
    }
    return;
  }

  if (requestUrl.pathname === "/api/collection" && request.method === "GET") {
    try {
      const user = requireUser(request);
      sendJson(response, {
        collection: user.collection || {},
        openedPacks: Number(user.openedPacks) || 0,
        recentPulls: resolveRecentPulls(user.recentPulls || []),
      });
    } catch (error) {
      sendJson(response, { error: error.message }, 401);
    }
    return;
  }

  if (requestUrl.pathname === "/api/packs/open" && request.method === "POST") {
    try {
      const user = requireUser(request);
      const pulls = openPackForUser(user.username);
      sendJson(response, pulls);
    } catch (error) {
      sendJson(response, { error: error.message || "No se pudo abrir el sobre." }, 400);
    }
    return;
  }

  if (requestUrl.pathname.startsWith("/assets/")) {
    serveAsset(requestUrl.pathname, response);
    return;
  }

  sendJson(response, { error: "Ruta no encontrada." }, 404);
});

server.listen(port, host, () => {
  console.log(`TCG Meme API running at http://${host}:${port}`);
});

function ensureStorage() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(cardsFile)) {
    const legacyCards = fs.existsSync(legacyCardsFile) ? readCardsFromFile(legacyCardsFile) : [];
    fs.writeFileSync(cardsFile, `${JSON.stringify(legacyCards, null, 2)}\n`, "utf8");
  }
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, "[]\n", "utf8");
  }
}

function readCards() {
  return readCardsFromFile(cardsFile);
}

function readCardsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8").trim();
    if (!content) {
      return [];
    }
    const cards = JSON.parse(content);
    return Array.isArray(cards) ? cards : [];
  } catch {
    return [];
  }
}

function writeCards(cards) {
  fs.writeFileSync(cardsFile, `${JSON.stringify(cards, null, 2)}\n`, "utf8");
}

function readUsers() {
  try {
    const content = fs.readFileSync(usersFile, "utf8").trim();
    if (!content) {
      return [];
    }
    const users = JSON.parse(content);
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

function registerUser(payload) {
  const username = normalizeUsername(payload.username);
  const password = String(payload.password || "");
  if (!username) {
    throw new Error("El usuario es obligatorio.");
  }
  if (password.length < 4) {
    throw new Error("La contrasena debe tener al menos 4 caracteres.");
  }

  const users = readUsers();
  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Ese usuario ya existe.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const user = {
    username,
    salt,
    passwordHash: hashPassword(password, salt),
    collection: {},
    openedPacks: 0,
    recentPulls: [],
  };
  users.push(user);
  writeUsers(users);
  return user;
}

function loginUser(payload) {
  const username = normalizeUsername(payload.username);
  const password = String(payload.password || "");
  const user = readUsers().find((item) => item.username.toLowerCase() === username.toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password, user.salt)) {
    throw new Error("Usuario o contrasena incorrectos.");
  }
  return user;
}

function createAuthResponse(user) {
  return {
    token: createToken(user.username),
    user: publicUser(user),
  };
}

function publicUser(user) {
  return {
    username: user.username,
    collection: user.collection || {},
    openedPacks: Number(user.openedPacks) || 0,
  };
}

function normalizeUsername(value) {
  return String(value || "").trim().slice(0, 24);
}

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function createToken(username) {
  const payload = Buffer.from(JSON.stringify({ username })).toString("base64url");
  const signature = crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) {
    throw new Error("Sesion no valida.");
  }
  const expectedSignature = crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
  if (signature !== expectedSignature) {
    throw new Error("Sesion no valida.");
  }
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return normalizeUsername(parsed.username);
}

function getAuthToken(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function requireUser(request) {
  const username = verifyToken(getAuthToken(request));
  const user = readUsers().find((item) => item.username === username);
  if (!user) {
    throw new Error("Sesion no valida.");
  }
  return user;
}

function getOptionalUser(request) {
  try {
    return requireUser(request);
  } catch {
    return null;
  }
}

function updateUser(username, updater) {
  const users = readUsers();
  const index = users.findIndex((user) => user.username === username);
  if (index === -1) {
    throw new Error("Usuario no encontrado.");
  }
  users[index] = updater(users[index]);
  writeUsers(users);
  return users[index];
}

function addCardsToUserCollection(username, cardIds) {
  return updateUser(username, (user) => {
    const collection = { ...(user.collection || {}) };
    for (const cardId of cardIds) {
      collection[cardId] = (Number(collection[cardId]) || 0) + 1;
    }
    return { ...user, collection };
  });
}

function openPackForUser(username) {
  const cards = readCards();
  if (!cards.length) {
    throw new Error("No hay cartas disponibles.");
  }
  const pulls = Array.from({ length: 5 }, () => weightedRandomCard(cards));
  const updatedUser = updateUser(username, (user) => {
    const collection = { ...(user.collection || {}) };
    for (const card of pulls) {
      collection[card.id] = (Number(collection[card.id]) || 0) + 1;
    }
    const recentPulls = [...pulls.map((card) => card.id), ...(user.recentPulls || [])].slice(0, 10);
    return {
      ...user,
      collection,
      openedPacks: (Number(user.openedPacks) || 0) + 1,
      recentPulls,
    };
  });

  return {
    pulls,
    collection: updatedUser.collection || {},
    openedPacks: Number(updatedUser.openedPacks) || 0,
    recentPulls: resolveRecentPulls(updatedUser.recentPulls || []),
  };
}

function resolveRecentPulls(cardIds) {
  const cardsById = new Map(readCards().map((card) => [card.id, card]));
  return cardIds.map((cardId) => cardsById.get(cardId)).filter(Boolean);
}

function weightedRandomCard(cards) {
  const weights = {
    Comun: 58,
    Rara: 28,
    Epica: 11,
    Legendaria: 3,
  };
  const available = cards.flatMap((card) => Array(weights[card.rarity] || 10).fill(card));
  return available[Math.floor(Math.random() * available.length)];
}

function readRequestBody(request) {
  const contentType = request.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    return readMultipartBody(request, contentType);
  }

  return readJsonBody(request);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        request.destroy();
        reject(new Error("La imagen es demasiado grande."));
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
    request.on("error", reject);
  });
}

function readMultipartBody(request, contentType) {
  return new Promise((resolve, reject) => {
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      reject(new Error("Formulario invalido."));
      return;
    }

    const chunks = [];
    let totalLength = 0;
    request.on("data", (chunk) => {
      chunks.push(chunk);
      totalLength += chunk.length;
      if (totalLength > 12 * 1024 * 1024) {
        request.destroy();
        reject(new Error("La imagen es demasiado grande."));
      }
    });
    request.on("end", () => {
      try {
        resolve(parseMultipart(Buffer.concat(chunks), boundaryMatch[1]));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function parseMultipart(buffer, boundary) {
  const parts = buffer.toString("binary").split(`--${boundary}`);
  const payload = {};

  for (const part of parts) {
    if (!part || part === "--\r\n" || part === "--") {
      continue;
    }

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      continue;
    }

    const rawHeaders = part.slice(0, headerEnd);
    let body = part.slice(headerEnd + 4);
    body = body.replace(/\r\n$/, "");
    const nameMatch = rawHeaders.match(/name="([^"]+)"/);
    if (!nameMatch) {
      continue;
    }

    const fieldName = nameMatch[1];
    const fileNameMatch = rawHeaders.match(/filename="([^"]*)"/);
    const typeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);

    if (fileNameMatch && fileNameMatch[1]) {
      payload[fieldName] = {
        buffer: Buffer.from(body, "binary"),
        mimeType: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
      };
    } else {
      payload[fieldName] = Buffer.from(body, "binary").toString("utf8");
    }
  }

  return payload;
}

function createCard(payload) {
  const id = createId();
  return {
    id,
    name: cleanText(payload.name, 28) || "Nueva Carta",
    type: "",
    rarity: normalizeRarity(payload.rarity),
    image: saveImage(id, payload.image),
    description: cleanText(payload.description, 130),
    flavor: cleanText(payload.flavor, 120),
    author: cleanText(payload.author, 28) || "Creador anonimo",
  };
}

function saveImage(id, imageData) {
  if (!imageData) {
    return "";
  }

  if (imageData.buffer && imageData.mimeType) {
    return saveImageBuffer(id, imageData.buffer, imageData.mimeType);
  }

  if (typeof imageData === "string" && !imageData.startsWith("data:image/")) {
    return imageData;
  }

  const match = String(imageData).match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de imagen no soportado.");
  }

  const extensionByMime = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const filename = `${id}.${extensionByMime[match[1]]}`;
  fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(match[2], "base64"));
  return `assets/uploads/${filename}`;
}

function saveImageBuffer(id, buffer, mimeType) {
  const extensionByMime = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const extension = extensionByMime[mimeType];
  if (!extension) {
    throw new Error("Formato de imagen no soportado.");
  }

  const filename = `${id}.${extension}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return `assets/uploads/${filename}`;
}

function serveAsset(urlPath, response) {
  const relativePath = decodeURIComponent(urlPath.replace(/^\/assets\//, ""));
  const filePath = path.normalize(path.join(assetsDir, relativePath));

  if (!filePath.startsWith(assetsDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  });
}

function normalizeRarity(rarity) {
  const allowed = ["Comun", "Rara", "Epica", "Legendaria"];
  return allowed.includes(rarity) ? rarity : "Comun";
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

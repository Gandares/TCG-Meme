const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || (process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1");
const projectRoot = path.resolve(__dirname, "..");
const dataDir = resolveStoragePath(process.env.DATA_DIR, path.join(projectRoot, "data"));
const assetsDir = path.join(projectRoot, "assets");
const uploadsDir = resolveStoragePath(process.env.UPLOADS_DIR, path.join(assetsDir, "uploads"));
const cardsFile = path.join(dataDir, "card.json");
const expansionsFile = path.join(dataDir, "expansions.json");
const legacyCardsFile = path.join(dataDir, "cards.json");
const usersFile = path.join(dataDir, "users.json");
const tokenSecret = "tcg-meme-local-dev-secret";
const currencyMax = 500;
const currencyIntervalMs = 10_000;
const packCost = 100;
const joinCodeLength = 6;
const joinCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const defaultExpansion = {
  id: "prueba",
  name: "Mágicas psiquiátricas",
  packImage: "assets/pack-tavern.png",
  cardBackImage: "assets/card-back-fantasy.png",
};

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

  if ((requestUrl.pathname === "/" || requestUrl.pathname === "/health" || requestUrl.pathname === "/api/health") && request.method === "GET") {
    sendJson(response, {
      status: "ok",
      service: "tcg-meme-backend",
    });
    return;
  }

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

  if (requestUrl.pathname === "/api/expansions" && request.method === "GET") {
    sendJson(response, readExpansions().map(publicExpansion));
    return;
  }

  if (requestUrl.pathname === "/api/expansions/join" && request.method === "POST") {
    try {
      const user = requireUser(request);
      const payload = await readJsonBody(request);
      sendJson(response, joinExpansionByCode(user.username, payload.code));
    } catch (error) {
      sendJson(response, { error: error.message || "No se pudo unir la expansion." }, 400);
    }
    return;
  }

  if (requestUrl.pathname === "/api/cards" && request.method === "POST") {
    try {
      const user = requireUser(request);
      const payload = await readRequestBody(request);
      const card = createCard(payload, user);
      const cards = readCards();
      cards.unshift(card);
      writeCards(cards);
      sendJson(response, card, 201);
    } catch (error) {
      sendJson(response, { error: error.message || "No se pudo guardar la carta." }, 400);
    }
    return;
  }

  if (requestUrl.pathname === "/api/collection" && request.method === "GET") {
    try {
      const user = requireUser(request);
      const refreshedUser = refreshUserCurrency(user.username);
      sendJson(response, {
        collectionId: refreshedUser.collectionId,
        collection: refreshedUser.collection || {},
        collectionItems: refreshedUser.collectionItems || [],
        joinedExpansionIds: refreshedUser.joinedExpansionIds || [],
        openedPacks: Number(refreshedUser.openedPacks) || 0,
        recentPulls: resolveRecentPulls(refreshedUser.recentPulls || []),
        currency: publicCurrency(refreshedUser),
        packCost,
      });
    } catch (error) {
      sendJson(response, { error: error.message }, 401);
    }
    return;
  }

  if (requestUrl.pathname === "/api/packs/open" && request.method === "POST") {
    try {
      const user = requireUser(request);
      const payload = await readJsonBody(request);
      const pulls = openPackForUser(user.username, payload.expansionId);
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

function resolveStoragePath(envPath, fallbackPath) {
  return envPath ? path.resolve(envPath) : fallbackPath;
}

function ensureStorage() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(cardsFile)) {
    const legacyCards = fs.existsSync(legacyCardsFile) ? readCardsFromFile(legacyCardsFile) : [];
    fs.writeFileSync(cardsFile, `${JSON.stringify(legacyCards, null, 2)}\n`, "utf8");
  }
  if (!fs.existsSync(expansionsFile)) {
    writeExpansions([createDefaultExpansion()]);
  }
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, "[]\n", "utf8");
  }
  migrateCardsToDefaultExpansion();
  migrateExpansionsToUniqueIds();
  migrateExpansionJoinCodes();
  migrateAlternativeImages();
  migrateCardIdsToUniqueExpansionFormat();
  migrateUsersToUniqueCollections();
}

function readCards() {
  return attachExpansions(readCardsFromFile(cardsFile).map(normalizeCardExpansion));
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
  fs.writeFileSync(cardsFile, `${JSON.stringify(cards.map(serializeCard), null, 2)}\n`, "utf8");
}

function serializeCard(card) {
  const { expansion, ...serializableCard } = normalizeCardExpansion(card);
  return serializableCard;
}

function readExpansions() {
  try {
    const content = fs.readFileSync(expansionsFile, "utf8").trim();
    if (!content) {
      return [defaultExpansion];
    }
    const expansions = JSON.parse(content);
    return Array.isArray(expansions) && expansions.length ? expansions.map(normalizeExpansion) : [defaultExpansion];
  } catch {
    return [defaultExpansion];
  }
}

function writeExpansions(expansions) {
  fs.writeFileSync(expansionsFile, `${JSON.stringify(expansions.map(normalizeExpansion), null, 2)}\n`, "utf8");
}

function createDefaultExpansion() {
  return {
    ...defaultExpansion,
    id: createUniqueEntityId("expansion"),
    joinCode: createUniqueJoinCode(new Set()),
  };
}

function normalizeExpansion(expansion) {
  return {
    id: cleanEntityId(expansion?.id) || defaultExpansion.id,
    name: cleanText(expansion?.name, 40) || defaultExpansion.name,
    packImage: cleanText(expansion?.packImage, 160) || defaultExpansion.packImage,
    cardBackImage: cleanText(expansion?.cardBackImage, 160) || defaultExpansion.cardBackImage,
    joinCode: cleanJoinCode(expansion?.joinCode),
  };
}

function publicExpansion(expansion) {
  const normalizedExpansion = normalizeExpansion(expansion);
  return {
    id: normalizedExpansion.id,
    name: normalizedExpansion.name,
    packImage: normalizedExpansion.packImage,
    cardBackImage: normalizedExpansion.cardBackImage,
  };
}

function normalizeCardExpansion(card) {
  return {
    ...card,
    expansionId: cleanEntityId(card.expansionId) || defaultExpansion.id,
  };
}

function attachExpansions(cards) {
  const expansionsById = new Map(readExpansions().map((expansion) => [expansion.id, expansion]));
  return cards.map((card) => ({
    ...card,
    expansion: expansionsById.get(card.expansionId) || defaultExpansion,
  }));
}

function migrateCardsToDefaultExpansion() {
  const cards = readCardsFromFile(cardsFile);
  const needsMigration = cards.some((card) => !card.expansionId);
  if (needsMigration) {
    writeCards(cards.map(normalizeCardExpansion));
  }
}

function migrateExpansionsToUniqueIds() {
  const expansions = readExpansions();
  const usedIds = new Set();
  const expansionIdMap = new Map();
  let changed = false;
  const migratedExpansions = expansions.map((expansion) => {
    const currentId = cleanEntityId(expansion.id);
    let nextId = currentId;
    if (!isGeneratedEntityId(currentId, "expansion") || usedIds.has(currentId)) {
      nextId = createUniqueEntityId("expansion");
      changed = true;
    }
    usedIds.add(nextId);

    if (nextId !== currentId) {
      expansionIdMap.set(currentId, nextId);
    }

    return {
      ...expansion,
      id: nextId,
    };
  });

  if (!changed && !expansionIdMap.size) {
    return;
  }

  writeExpansions(migratedExpansions);
  migrateCardExpansionReferences(expansionIdMap);
}

function migrateCardExpansionReferences(expansionIdMap) {
  if (!expansionIdMap.size) {
    return;
  }

  const cards = readCardsFromFile(cardsFile);
  let changed = false;
  const migratedCards = cards.map((card) => {
    const nextExpansionId = expansionIdMap.get(card.expansionId) || card.expansionId;
    if (nextExpansionId !== card.expansionId) {
      changed = true;
      return { ...card, expansionId: nextExpansionId };
    }

    return card;
  });

  if (changed) {
    writeCards(migratedCards);
  }
}

function migrateExpansionJoinCodes() {
  const usedCodes = new Set();
  let changed = false;
  const expansions = readExpansions().map((expansion) => {
    let joinCode = cleanJoinCode(expansion.joinCode);
    if (!joinCode || usedCodes.has(joinCode)) {
      joinCode = createUniqueJoinCode(usedCodes);
      changed = true;
    }
    usedCodes.add(joinCode);
    if (joinCode !== expansion.joinCode) {
      changed = true;
    }
    return { ...expansion, joinCode };
  });

  if (changed) {
    writeExpansions(expansions);
  }
}

function migrateCardIdsToUniqueExpansionFormat() {
  const expansionsById = new Map(readExpansions().map((expansion) => [expansion.id, expansion]));
  const usedUids = new Set();
  const usedIds = new Set();
  const idMap = new Map();
  const cards = readCardsFromFile(cardsFile).map(normalizeCardExpansion);
  const migratedCards = cards.map((card) => {
    const expansion = expansionsById.get(card.expansionId) || defaultExpansion;
    let uid = cleanEntityId(card.uid) || extractCardUidFromId(card.id, expansion.id) || createUniqueEntityId("card");
    if (usedUids.has(uid)) {
      uid = createUniqueEntityId("card");
    }
    usedUids.add(uid);

    let expectedId = createCardId(expansion, uid);
    while (usedIds.has(expectedId)) {
      uid = createUniqueEntityId("card");
      expectedId = createCardId(expansion, uid);
    }
    usedIds.add(expectedId);

    if (card.id === expectedId) {
      return { ...card, uid };
    }

    idMap.set(card.id, expectedId);
    return { ...card, id: expectedId, uid };
  });

  const changed = idMap.size || migratedCards.some((card, index) => card.uid !== cards[index].uid);
  if (!changed) {
    return;
  }

  writeCards(migratedCards);
  if (idMap.size) {
    migrateUserCardReferences(idMap);
  }
}

function migrateAlternativeImages() {
  const cards = readCardsFromFile(cardsFile).map(normalizeCardExpansion);
  const needsMigration = cards.some((card) => !card.alternativeImage);
  if (needsMigration) {
    writeCards(cards.map((card) => ({ ...card, alternativeImage: card.alternativeImage || card.image })));
  }
}

function migrateUsersToUniqueCollections() {
  const users = readUsers();
  const usedCollectionIds = new Set();
  const usedCollectionItemIds = new Set();
  const expansionIds = readExpansions().map((expansion) => expansion.id);
  let changed = false;
  const migratedUsers = users.map((user) => {
    const userWithJoinedExpansions = Array.isArray(user.joinedExpansionIds)
      ? user
      : { ...user, joinedExpansionIds: expansionIds };
    const migratedUser = normalizeUserCollectionEntities(userWithJoinedExpansions, usedCollectionIds, usedCollectionItemIds);
    if (
      migratedUser.collectionId !== user.collectionId ||
      JSON.stringify(migratedUser.joinedExpansionIds || []) !== JSON.stringify(user.joinedExpansionIds || []) ||
      JSON.stringify(migratedUser.collection || {}) !== JSON.stringify(user.collection || {}) ||
      JSON.stringify(migratedUser.collectionItems || []) !== JSON.stringify(user.collectionItems || [])
    ) {
      changed = true;
    }

    return migratedUser;
  });

  if (changed) {
    writeUsers(migratedUsers);
  }
}

function migrateUserCardReferences(idMap) {
  const users = readUsers();
  let changed = false;
  const migratedUsers = users.map((user) => {
    const collection = {};
    for (const [key, value] of Object.entries(user.collection || {})) {
      const { cardId, variant } = parseCollectionKey(key);
      const nextCardId = idMap.get(cardId) || cardId;
      const nextKey = collectionKey(nextCardId, variant);
      collection[nextKey] = (Number(collection[nextKey]) || 0) + (Number(value) || 0);
      if (nextKey !== key) {
        changed = true;
      }
    }

    const recentPulls = (user.recentPulls || []).map((entry) => {
      const cardId = typeof entry === "string" ? entry : entry?.id;
      const nextCardId = idMap.get(cardId) || cardId;
      if (nextCardId !== cardId) {
        changed = true;
      }
      return typeof entry === "string" ? nextCardId : { ...entry, id: nextCardId };
    });

    return { ...user, collection, recentPulls };
  });

  if (changed) {
    writeUsers(migratedUsers.map((user) => normalizeUserCollectionEntities(user)));
  }
}

function normalizeUserCollectionEntities(user, usedCollectionIds = new Set(), usedCollectionItemIds = new Set()) {
  const baseCollection = Object.keys(user.collection || {}).length ? user.collection : collectionItemsToMap(user.collectionItems || []);
  const collection = normalizeCollectionMap(baseCollection);
  const validExpansionIds = new Set(readExpansions().map((expansion) => expansion.id));
  const joinedExpansionIds = [...new Set((user.joinedExpansionIds || []).map(cleanEntityId))]
    .filter((expansionId) => validExpansionIds.has(expansionId));
  return {
    ...user,
    collectionId: ensureUniqueEntityId(user.collectionId, "collection", usedCollectionIds),
    joinedExpansionIds,
    collection,
    collectionItems: createCollectionItems(collection, user.collectionItems || [], usedCollectionItemIds),
  };
}

function normalizeCollectionMap(collection) {
  return Object.entries(collection || {}).reduce((normalizedCollection, [key, value]) => {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    if (count > 0) {
      const { cardId, variant } = parseCollectionKey(key);
      normalizedCollection[collectionKey(cardId, variant)] = count;
    }
    return normalizedCollection;
  }, {});
}

function collectionItemsToMap(collectionItems) {
  return (collectionItems || []).reduce((collection, item) => {
    const cardId = cleanText(item?.cardId, 140);
    const variant = normalizeVariant(item?.variant);
    const count = Math.max(0, Math.floor(Number(item?.count) || 0));
    if (cardId && count > 0) {
      collection[collectionKey(cardId, variant)] = (Number(collection[collectionKey(cardId, variant)]) || 0) + count;
    }
    return collection;
  }, {});
}

function createCollectionItems(collection, existingItems = [], usedItemIds = new Set()) {
  const existingItemsByKey = new Map(
    (existingItems || []).map((item) => [collectionKey(item?.cardId, item?.variant), item]),
  );

  return Object.entries(normalizeCollectionMap(collection)).map(([key, count]) => {
    const { cardId, variant } = parseCollectionKey(key);
    const existingItem = existingItemsByKey.get(key) || {};
    return {
      id: ensureUniqueEntityId(existingItem.id, "collection-item", usedItemIds),
      cardId,
      variant,
      count,
    };
  });
}

function ensureUniqueEntityId(value, prefix, usedIds = new Set()) {
  const id = cleanEntityId(value);
  if (id && !usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }

  const nextId = createUniqueEntityId(prefix);
  usedIds.add(nextId);
  return nextId;
}

function createUniqueEntityId(prefix) {
  const safePrefix = cleanSlug(prefix) || "entity";
  return `${safePrefix}_${crypto.randomUUID()}`;
}

function isGeneratedEntityId(value, prefix) {
  return cleanEntityId(value).startsWith(`${cleanSlug(prefix)}_`);
}

function cleanEntityId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
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
    collectionId: createUniqueEntityId("collection"),
    joinedExpansionIds: [],
    collection: {},
    collectionItems: [],
    openedPacks: 0,
    recentPulls: [],
    currency: 0,
    currencyUpdatedAt: Date.now(),
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
  const normalizedUser = normalizeUserCollectionEntities(user);
  return {
    username: normalizedUser.username,
    collectionId: normalizedUser.collectionId,
    collection: normalizedUser.collection,
    collectionItems: normalizedUser.collectionItems,
    joinedExpansionIds: normalizedUser.joinedExpansionIds || [],
    openedPacks: Number(normalizedUser.openedPacks) || 0,
    currency: publicCurrency(normalizedUser),
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

function updateUser(username, updater) {
  const users = readUsers();
  const index = users.findIndex((user) => user.username === username);
  if (index === -1) {
    throw new Error("Usuario no encontrado.");
  }
  users[index] = normalizeUserCollectionEntities(updater(normalizeUserCollectionEntities(users[index])));
  writeUsers(users);
  return users[index];
}

function refreshUserCurrency(username) {
  return updateUser(username, (user) => {
    const currencyState = applyCurrencyRegen(user);
    return {
      ...user,
      currency: currencyState.currency,
      currencyUpdatedAt: currencyState.updatedAt,
    };
  });
}

function openPackForUser(username, expansionId = defaultExpansion.id) {
  const expansion = findExpansion(expansionId);
  const currentUser = normalizeUserCollectionEntities(readUsers().find((user) => user.username === username) || {});
  if (!userHasExpansion(currentUser, expansion.id)) {
    throw new Error("No te has unido a esta expansion.");
  }
  const cards = readCards().filter((card) => card.expansionId === expansion.id);
  if (!cards.length) {
    throw new Error("No hay cartas disponibles en esta expansion.");
  }
  const pulls = Array.from({ length: 5 }, () => weightedRandomCard(cards));
  const updatedUser = updateUser(username, (user) => {
    const currencyState = applyCurrencyRegen(user);
    if (currencyState.currency < packCost) {
      throw new Error(`Necesitas ${packCost} monedas para abrir un sobre.`);
    }
    const collection = { ...(user.collection || {}) };
    for (const card of pulls) {
      const key = collectionKey(card.id, card.variant);
      collection[key] = (Number(collection[key]) || 0) + 1;
    }
    const collectionItems = createCollectionItems(collection, user.collectionItems || []);
    const recentPulls = [
      ...pulls.map((card) => ({ id: card.id, variant: card.variant || "normal" })),
      ...(user.recentPulls || []),
    ].slice(0, 10);
    return {
      ...user,
      collection,
      collectionItems,
      openedPacks: (Number(user.openedPacks) || 0) + 1,
      recentPulls,
      currency: currencyState.currency - packCost,
      currencyUpdatedAt: currencyState.updatedAt,
    };
  });

  return {
    pulls,
    collectionId: updatedUser.collectionId,
    collection: updatedUser.collection || {},
    collectionItems: updatedUser.collectionItems || [],
    openedPacks: Number(updatedUser.openedPacks) || 0,
    recentPulls: resolveRecentPulls(updatedUser.recentPulls || []),
    currency: publicCurrency(updatedUser),
    packCost,
    expansion: publicExpansion(expansion),
  };
}

function findExpansion(expansionId) {
  const normalizedId = cleanEntityId(expansionId) || defaultExpansion.id;
  const expansion = readExpansions().find((item) => item.id === normalizedId);
  if (!expansion) {
    throw new Error("Expansion no encontrada.");
  }
  return expansion;
}

function joinExpansionByCode(username, rawCode) {
  const code = cleanJoinCode(rawCode);
  if (!code) {
    throw new Error("Introduce un codigo de union valido.");
  }

  const expansion = readExpansions().find((item) => item.joinCode === code);
  if (!expansion) {
    throw new Error("Codigo de union no encontrado.");
  }

  const currentUser = normalizeUserCollectionEntities(readUsers().find((user) => user.username === username) || {});
  const alreadyJoined = userHasExpansion(currentUser, expansion.id);
  const updatedUser = updateUser(username, (user) => ({
    ...user,
    joinedExpansionIds: [...new Set([...(user.joinedExpansionIds || []), expansion.id])],
  }));

  return {
    expansion: publicExpansion(expansion),
    joinedExpansionIds: updatedUser.joinedExpansionIds || [],
    alreadyJoined,
    user: publicUser(updatedUser),
  };
}

function userHasExpansion(user, expansionId) {
  return (user.joinedExpansionIds || []).includes(expansionId);
}

function publicCurrency(user) {
  const currencyState = applyCurrencyRegen(user);
  return currencyState.currency;
}

function applyCurrencyRegen(user) {
  const now = Date.now();
  const currentCurrency = clampCurrency(user.currency);
  const updatedAt = Number(user.currencyUpdatedAt) || now;
  if (currentCurrency >= currencyMax) {
    return { currency: currentCurrency, updatedAt: now };
  }

  const earned = Math.max(0, Math.floor((now - updatedAt) / currencyIntervalMs));
  if (!earned) {
    return { currency: currentCurrency, updatedAt };
  }

  const nextCurrency = clampCurrency(currentCurrency + earned);
  const nextUpdatedAt = nextCurrency >= currencyMax ? now : updatedAt + earned * currencyIntervalMs;
  return { currency: nextCurrency, updatedAt: nextUpdatedAt };
}

function clampCurrency(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function resolveRecentPulls(cardIds) {
  const cardsById = new Map(readCards().map((card) => [card.id, card]));
  return cardIds
    .map((entry) => {
      const cardId = typeof entry === "string" ? entry : entry?.id;
      const variant = typeof entry === "string" ? "normal" : entry?.variant || "normal";
      const card = cardsById.get(cardId);
      return card ? withCardVariant(card, variant) : null;
    })
    .filter(Boolean);
}

function weightedRandomCard(cards) {
  const weights = {
    Comun: 58,
    Rara: 28,
    Epica: 11,
    Legendaria: 3,
  };
  const candidates = cards.flatMap((card) => {
    return [withCardVariant(card, "normal"), withCardVariant(card, "holo"), withCardVariant(card, "alternative")];
  });
  const available = candidates.flatMap((card) => Array(weights[card.displayRarity] || 10).fill(card));
  return available[Math.floor(Math.random() * available.length)];
}

function collectionKey(cardId, variant = "normal") {
  if (variant === "holo") {
    return `${cardId}:holo`;
  }

  return variant === "alternative" ? `${cardId}:alternative` : `${cardId}:normal`;
}

function parseCollectionKey(key) {
  if (String(key).endsWith(":alternative")) {
    return { cardId: String(key).slice(0, -12), variant: "alternative" };
  }

  if (String(key).endsWith(":holo")) {
    return { cardId: String(key).slice(0, -5), variant: "holo" };
  }

  if (String(key).endsWith(":normal")) {
    return { cardId: String(key).slice(0, -7), variant: "normal" };
  }

  return { cardId: String(key), variant: "normal" };
}

function withCardVariant(card, variant = "normal") {
  const normalizedVariant = ["normal", "holo", "alternative"].includes(variant) ? variant : "normal";
  return {
    ...card,
    variant: normalizedVariant,
    displayRarity: effectiveRarity(card.rarity, normalizedVariant),
  };
}

function effectiveRarity(rarity, variant = "normal") {
  if (variant === "alternative") {
    return advanceRarity(rarity, 2);
  }

  return variant === "holo" ? advanceRarity(rarity, 1) : rarity;
}

function advanceRarity(rarity, steps = 1) {
  const rarities = ["Comun", "Rara", "Epica", "Legendaria"];
  const index = rarities.indexOf(rarity);
  return index >= 0 ? rarities[Math.min(rarities.length - 1, index + steps)] : rarity || "Comun";
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

function createCard(payload, user) {
  const name = cleanText(payload.name, 28);
  const description = cleanText(payload.description, 130);
  const expansion = findExpansion(payload.expansionId || defaultExpansion.id);
  if (!userHasExpansion(normalizeUserCollectionEntities(user), expansion.id)) {
    throw new Error("No te has unido a esta expansion.");
  }
  if (!name) {
    throw new Error("El titulo es obligatorio.");
  }
  if (!payload.image) {
    throw new Error("La imagen es obligatoria.");
  }
  if (!payload.alternativeImage) {
    throw new Error("La imagen alternativa es obligatoria.");
  }
  if (!description) {
    throw new Error("La descripcion es obligatoria.");
  }
  if (cardNameExistsInExpansion(name, expansion.id)) {
    throw new Error("Ya existe una carta con ese nombre en esta expansion.");
  }

  const uid = createUniqueEntityId("card");
  const id = createCardId(expansion, uid);
  if (!id) {
    throw new Error("No se pudo generar el id de la carta.");
  }

  return {
    id,
    uid,
    name,
    type: "",
    rarity: normalizeRarity(payload.rarity),
    expansionId: expansion.id,
    expansion,
    image: saveImage(id, payload.image),
    alternativeImage: saveImage(id, payload.alternativeImage, "alternative"),
    description,
    flavor: cleanText(payload.flavor, 120),
    author: cleanText(user?.username, 28) || "Creador anonimo",
  };
}

function cardNameExistsInExpansion(name, expansionId) {
  const normalizedName = normalizeNameKey(name);
  return readCardsFromFile(cardsFile)
    .map(normalizeCardExpansion)
    .some((card) => card.expansionId === expansionId && normalizeNameKey(card.name) === normalizedName);
}

function saveImage(id, imageData, suffix = "") {
  if (!imageData) {
    return "";
  }

  if (imageData.buffer && imageData.mimeType) {
    return saveImageBuffer(id, imageData.buffer, imageData.mimeType, suffix);
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
  const filename = `${imageFilenameBase(id, suffix)}.${extensionByMime[match[1]]}`;
  fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(match[2], "base64"));
  return `assets/uploads/${filename}`;
}

function saveImageBuffer(id, buffer, mimeType, suffix = "") {
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

  const filename = `${imageFilenameBase(id, suffix)}.${extension}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return `assets/uploads/${filename}`;
}

function imageFilenameBase(id, suffix = "") {
  return suffix ? `${id}-${cleanSlug(suffix)}` : id;
}

function serveAsset(urlPath, response) {
  const relativePath = decodeURIComponent(urlPath.replace(/^\/assets\//, ""));
  const source =
    relativePath === "uploads" || relativePath.startsWith("uploads/")
      ? {
          baseDir: uploadsDir,
          relativePath: relativePath.replace(/^uploads\/?/, ""),
        }
      : {
          baseDir: assetsDir,
          relativePath,
        };
  const filePath = path.normalize(path.join(source.baseDir, source.relativePath));

  if (!isPathInside(filePath, source.baseDir)) {
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

function isPathInside(filePath, baseDir) {
  const relativePath = path.relative(baseDir, filePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function normalizeRarity(rarity) {
  const allowed = ["Comun", "Rara", "Epica", "Legendaria"];
  return allowed.includes(rarity) ? rarity : "Comun";
}

function normalizeVariant(variant) {
  const allowed = ["normal", "holo", "alternative"];
  return allowed.includes(variant) ? variant : "normal";
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function createCardId(expansion, cardUid) {
  const expansionId = cleanEntityId(expansion?.id);
  const normalizedCardUid = cleanEntityId(cardUid);
  return expansionId && normalizedCardUid ? `${expansionId}-${normalizedCardUid}` : "";
}

function extractCardUidFromId(cardId, expansionId) {
  const prefix = `${cleanEntityId(expansionId)}-`;
  const id = String(cardId || "");
  if (!id.startsWith(prefix)) {
    return "";
  }

  const uid = cleanEntityId(id.slice(prefix.length));
  return uid.startsWith("card_") ? uid : "";
}

function cleanJoinCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, joinCodeLength);
}

function createUniqueJoinCode(usedCodes) {
  let code = "";
  do {
    code = Array.from({ length: joinCodeLength }, () => joinCodeAlphabet[crypto.randomInt(joinCodeAlphabet.length)]).join("");
  } while (usedCodes.has(code));
  return code;
}

function normalizeNameKey(value) {
  return cleanSlug(value);
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

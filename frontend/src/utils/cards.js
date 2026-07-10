export const rarityWeights = {
  Comun: 58,
  Rara: 28,
  Epica: 11,
  Legendaria: 3,
};

export const rarityOrder = {
  Comun: 0,
  Rara: 1,
  Epica: 2,
  Legendaria: 3,
};

export const raritySteps = ["Comun", "Rara", "Epica", "Legendaria"];
export const cardVariants = ["normal", "holo"];

export function rarityClass(rarity) {
  return `rarity-${String(rarity || "Comun").toLowerCase()}`;
}

export function nextRarity(rarity) {
  const index = raritySteps.indexOf(rarity);
  return index >= 0 && index < raritySteps.length - 1 ? raritySteps[index + 1] : null;
}

export function effectiveRarity(card, variant = "normal") {
  return variant === "holo" ? nextRarity(card.rarity) || card.rarity : card.rarity;
}

export function withCardVariant(card, variant = "normal") {
  const normalizedVariant = variant === "holo" && nextRarity(card.rarity) ? "holo" : "normal";
  return {
    ...card,
    variant: normalizedVariant,
    displayRarity: effectiveRarity(card, normalizedVariant),
  };
}

export function variantLabel(variant) {
  return variant === "holo" ? "Holo" : "Normal";
}

export function collectionKey(cardId, variant = "normal") {
  return variant === "holo" ? `${cardId}:holo` : `${cardId}:normal`;
}

export function getCollectionCount(collection, cardId, variant = "normal") {
  if (variant === "normal") {
    return (Number(collection[collectionKey(cardId, "normal")]) || 0) + (Number(collection[cardId]) || 0);
  }

  return Number(collection[collectionKey(cardId, "holo")]) || 0;
}

export function getOwnedVariantCount(collection, cardId) {
  return getCollectionCount(collection, cardId, "normal") + getCollectionCount(collection, cardId, "holo");
}

export function compareByRarity(firstCard, secondCard) {
  const firstRarity = rarityOrder[firstCard.rarity] ?? 0;
  const secondRarity = rarityOrder[secondCard.rarity] ?? 0;

  if (firstRarity !== secondRarity) {
    return firstRarity - secondRarity;
  }

  return String(firstCard.name || "").localeCompare(String(secondCard.name || ""));
}

export function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function weightedRandomCard(cards) {
  const available = cards.flatMap((card) => Array(rarityWeights[card.rarity] || 10).fill(card));
  return available[Math.floor(Math.random() * available.length)];
}

export function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", reject);
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("error", reject);
      image.addEventListener("load", () => {
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = width;
        canvas.height = height;
        context.fillStyle = "#111315";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      });
      image.src = String(reader.result || "");
    });
    reader.readAsDataURL(file);
  });
}

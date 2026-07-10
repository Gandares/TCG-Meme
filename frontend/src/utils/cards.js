export const rarityWeights = {
  Comun: 58,
  Rara: 28,
  Epica: 11,
  Legendaria: 3,
};

export function rarityClass(rarity) {
  return `rarity-${String(rarity || "Comun").toLowerCase()}`;
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

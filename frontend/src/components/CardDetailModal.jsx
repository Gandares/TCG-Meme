import { useEffect, useMemo, useState } from "react";
import { assetUrl } from "../api/cards";
import { Card } from "./Card";
import { cardVariants, effectiveRarity, getCollectionCount, rarityClass, variantLabel, withCardVariant } from "../utils/cards";

function safeFileName(value) {
  return String(value || "carta")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "carta";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("La carta no tiene imagen."));
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("No se pudo cargar la imagen de la carta.")), { once: true });
    image.src = src;
  });
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawCoverImage(context, image, x, y, width, height) {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  const drawHeight = imageRatio > targetRatio ? height : width / imageRatio;
  const drawWidth = imageRatio > targetRatio ? height * imageRatio : width;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let line = "";
  let lines = 0;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = word;
      if (lines >= maxLines) {
        return y;
      }
    } else {
      line = nextLine;
    }
  }

  if (line && lines < maxLines) {
    context.fillText(line, x, y);
    y += lineHeight;
  }

  return y;
}

function drawHoloEffect(context, width, height) {
  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.3;

  const sweep = context.createLinearGradient(0, 0, width, height);
  sweep.addColorStop(0, "rgba(255, 255, 255, 0)");
  sweep.addColorStop(0.18, "rgba(102, 218, 255, 0.34)");
  sweep.addColorStop(0.36, "rgba(255, 121, 219, 0.3)");
  sweep.addColorStop(0.54, "rgba(255, 231, 112, 0.28)");
  sweep.addColorStop(0.72, "rgba(118, 255, 184, 0.28)");
  sweep.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = sweep;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.16;
  context.rotate(-0.52);
  for (let index = -height; index < width * 1.5; index += 46) {
    const band = context.createLinearGradient(index, 0, index + 130, 0);
    band.addColorStop(0, "rgba(255, 255, 255, 0)");
    band.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
    band.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = band;
    context.fillRect(index, -height, 18, height * 3);
  }

  context.restore();
}

async function renderCardPng(card, variant) {
  const width = 750;
  const height = 1050;
  const padding = 34;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const imagePath = variant === "alternative" ? card.alternativeImage || card.image : card.image;
  const image = await loadImage(assetUrl(imagePath));

  if (!context) {
    throw new Error("No se pudo preparar la carta.");
  }

  canvas.width = width;
  canvas.height = height;

  roundedRect(context, 0, 0, width, height, 22);
  context.clip();
  context.fillStyle = "#111315";
  context.fillRect(0, 0, width, height);
  drawCoverImage(context, image, 0, 0, width, height);

  if (variant === "holo" || variant === "alternative") {
    drawHoloEffect(context, width, height);
  }

  const vignette = context.createRadialGradient(width / 2, height / 2, 140, width / 2, height / 2, 680);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.58)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  if (variant !== "alternative") {
    context.fillStyle = "rgba(8, 10, 12, 0.56)";
    roundedRect(context, padding, padding, width - padding * 2, 96, 12);
    context.fill();

    context.fillStyle = "#fff7e5";
    context.font = "800 42px Inter, Arial, sans-serif";
    drawWrappedText(context, card.name, padding + 24, padding + 48, width - padding * 2 - 48, 40, 2);

    context.fillStyle = "rgba(8, 10, 12, 0.5)";
    roundedRect(context, padding, 704, width - padding * 2, 228, 12);
    context.fill();

    context.fillStyle = "#f4efe3";
    context.font = "500 25px Inter, Arial, sans-serif";
    let cursorY = drawWrappedText(context, card.description || "Sin descripcion.", padding + 24, 752, width - padding * 2 - 48, 32, 4);

    context.fillStyle = "rgba(255, 247, 229, 0.78)";
    context.font = "italic 23px Georgia, serif";
    drawWrappedText(context, card.flavor || "", padding + 24, cursorY + 18, width - padding * 2 - 48, 30, 3);

    context.fillStyle = "rgba(8, 10, 12, 0.58)";
    roundedRect(context, padding, 956, width - padding * 2, 58, 12);
    context.fill();
    context.fillStyle = "#fff7e5";
    context.font = "800 24px Inter, Arial, sans-serif";
    context.fillText(card.author || "Creador anonimo", padding + 24, 993);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo crear el PNG."))), "image/png");
  });
}

export function CardDetailModal({ card, count, collection, variant = "normal", onClose }) {
  const defaultVariant = cardVariants.includes(variant) ? variant : "normal";
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const availableVariants = useMemo(() => {
    if (!collection) {
      return [defaultVariant];
    }

    return cardVariants.filter((item) => {
      return getCollectionCount(collection, card.id, item) > 0;
    });
  }, [card.id, card.rarity, collection, defaultVariant]);
  const displayVariant = availableVariants.includes(selectedVariant) ? selectedVariant : availableVariants[0] || defaultVariant;
  const displayCard = withCardVariant(card, displayVariant);
  const isHolographic = displayVariant === "holo" || displayVariant === "alternative";
  const displayCount = collection ? getCollectionCount(collection, card.id, displayVariant) : count;

  useEffect(() => {
    setSelectedVariant(defaultVariant);
  }, [defaultVariant, card.id]);

  async function handleDownloadCard() {
    setIsDownloading(true);
    setDownloadError("");

    try {
      const blob = await renderCardPng(displayCard, displayVariant);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFileName(displayCard.name)}-${displayVariant}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setDownloadError(error.message || "No se pudo descargar la carta.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`card-detail ${rarityClass(effectiveRarity(card, displayVariant))} ${isHolographic ? "detail-holo" : ""} ${displayVariant === "alternative" ? "detail-alternative" : ""} ${availableVariants.length > 1 ? "has-variants" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cardDetailTitle"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="detail-close" type="button" aria-label="Cerrar detalle" onClick={onClose}>
          x
        </button>

        <div className="detail-card-preview">
          <Card card={displayCard} />
        </div>

        <div className="detail-content">
          <div className="detail-heading">
            <div>
              <h2 id="cardDetailTitle">{card.name}</h2>
              <p className={`detail-rarity ${rarityClass(displayCard.displayRarity)}`}>
                {displayCard.displayRarity}{displayVariant !== "normal" ? ` ${variantLabel(displayVariant)}` : ""}
              </p>
            </div>
            <strong>x{displayCount || 0}</strong>
          </div>

          {availableVariants.length > 1 ? (
            <div className="variant-toggle detail-variant-toggle" role="group" aria-label="Version de carta">
              {availableVariants.map((item) => (
                <button
                  className={`filter-button ${displayVariant === item ? "active" : ""}`}
                  type="button"
                  key={item}
                  onClick={() => setSelectedVariant(item)}
                >
                  {variantLabel(item)}
                </button>
              ))}
            </div>
          ) : null}

          <button className="primary-button detail-download-button" type="button" onClick={handleDownloadCard} disabled={isDownloading}>
            {isDownloading ? "Preparando..." : "Descargar carta"}
          </button>
          {downloadError ? <p className="detail-download-error">{downloadError}</p> : null}

          <section className="detail-expansion-panel" aria-label="Expansión de la carta">
            <span>Expansión</span>
            <strong>{card.expansion?.name || "Sin expansion"}</strong>
          </section>

        </div>
      </section>
    </div>
  );
}

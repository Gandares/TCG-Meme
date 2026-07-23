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
  const drawWidth = imageRatio > targetRatio ? height * imageRatio : width;
  const drawHeight = imageRatio > targetRatio ? height : width / imageRatio;
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
  context.globalAlpha = 0.5;

  const rainbow = context.createLinearGradient(0, 0, 0, height);
  rainbow.addColorStop(0, "rgba(255, 119, 115, 0.28)");
  rainbow.addColorStop(0.17, "rgba(255, 237, 95, 0.32)");
  rainbow.addColorStop(0.34, "rgba(168, 255, 95, 0.28)");
  rainbow.addColorStop(0.5, "rgba(131, 255, 247, 0.34)");
  rainbow.addColorStop(0.67, "rgba(120, 148, 255, 0.3)");
  rainbow.addColorStop(0.84, "rgba(216, 117, 255, 0.32)");
  rainbow.addColorStop(1, "rgba(255, 119, 115, 0.24)");
  context.fillStyle = rainbow;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.28;
  context.translate(width / 2, height / 2);
  context.rotate((133 * Math.PI) / 180);
  context.translate(-width / 2, -height / 2);

  for (let x = -height; x < width + height; x += 46) {
    const band = context.createLinearGradient(x, 0, x + 34, 0);
    band.addColorStop(0, "rgba(14, 21, 46, 0)");
    band.addColorStop(0.35, "rgba(255, 255, 255, 0.34)");
    band.addColorStop(0.5, "rgba(131, 255, 247, 0.28)");
    band.addColorStop(0.65, "rgba(255, 237, 95, 0.24)");
    band.addColorStop(1, "rgba(14, 21, 46, 0)");
    context.fillStyle = band;
    context.fillRect(x, -height, 18, height * 3);
  }

  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.12;
  context.fillStyle = "rgba(255, 255, 255, 0.5)";
  for (let y = 24; y < height; y += 80) {
    for (let x = 20; x < width; x += 80) {
      context.beginPath();
      context.arc(x + ((Math.floor(y / 80) % 2) * 26), y, 2.4, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo crear el PNG."))), "image/png");
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(new Error("No se pudo preparar la descarga.")), { once: true });
    reader.readAsDataURL(blob);
  });
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
    throw new Error("No se pudo preparar la descarga.");
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

  const vignette = context.createRadialGradient(width / 2, height / 2, 120, width / 2, height / 2, 690);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.56)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  if (variant !== "alternative") {
    context.fillStyle = "rgba(8, 10, 12, 0.48)";
    roundedRect(context, padding, padding, width - padding * 2, 96, 12);
    context.fill();

    context.fillStyle = "#fff7e5";
    context.font = "800 42px Inter, Arial, sans-serif";
    drawWrappedText(context, card.name, padding + 24, padding + 48, width - padding * 2 - 48, 40, 2);

    context.fillStyle = "rgba(8, 10, 12, 0.42)";
    roundedRect(context, padding, 704, width - padding * 2, 228, 12);
    context.fill();

    context.fillStyle = "#f4efe3";
    context.font = "500 25px Inter, Arial, sans-serif";
    const cursorY = drawWrappedText(context, card.description || "Sin descripcion.", padding + 24, 752, width - padding * 2 - 48, 32, 4);

    context.fillStyle = "rgba(255, 247, 229, 0.78)";
    context.font = "italic 23px Georgia, serif";
    drawWrappedText(context, card.flavor || "", padding + 24, cursorY + 18, width - padding * 2 - 48, 30, 3);

    context.fillStyle = "rgba(8, 10, 12, 0.5)";
    roundedRect(context, padding, 956, width - padding * 2, 58, 12);
    context.fill();
    context.fillStyle = "#fff7e5";
    context.font = "800 24px Inter, Arial, sans-serif";
    context.fillText(card.author || "Creador anonimo", padding + 24, 993);
  }

  return canvasToBlob(canvas);
}

export function CardDetailModal({ card, count, collection, variant = "normal", onClose }) {
  const defaultVariant = cardVariants.includes(variant) ? variant : "normal";
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
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
  const downloadName = `${safeFileName(displayCard.name)}-${displayVariant}.png`;

  useEffect(() => {
    setSelectedVariant(defaultVariant);
  }, [defaultVariant, card.id]);

  useEffect(() => {
    let isCancelled = false;

    setIsPreparingDownload(true);
    setDownloadError("");
    setDownloadUrl("");

    renderCardPng(displayCard, displayVariant)
      .then(blobToDataUrl)
      .then((blob) => {
        if (isCancelled) {
          return;
        }

        setDownloadUrl(blob);
      })
      .catch((error) => {
        if (!isCancelled) {
          setDownloadError(error.message || "No se pudo preparar la carta.");
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsPreparingDownload(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    card.alternativeImage,
    card.author,
    card.description,
    card.flavor,
    card.id,
    card.image,
    card.name,
    displayVariant,
  ]);

  async function handleDownloadClick(event) {
    if (!downloadUrl) {
      event.preventDefault();
      return;
    }

    if (!("showSaveFilePicker" in window)) {
      return;
    }

    event.preventDefault();
    setDownloadError("");

    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: downloadName,
        types: [
          {
            description: "Imagen PNG",
            accept: { "image/png": [".png"] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      const response = await fetch(downloadUrl);
      await writable.write(await response.blob());
      await writable.close();
    } catch (error) {
      if (error.name !== "AbortError") {
        setDownloadError(error.message || "No se pudo descargar la carta.");
      }
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

          <a
            className={`primary-button detail-download-button ${!downloadUrl ? "disabled" : ""}`}
            href={downloadUrl || "#"}
            download={downloadName}
            aria-disabled={!downloadUrl}
            onClick={handleDownloadClick}
          >
            {isPreparingDownload ? "Preparando..." : "Descargar carta"}
          </a>
          {downloadError ? <p className="detail-download-error">{downloadError}</p> : null}

          <section className="detail-expansion-panel" aria-label="Expansion de la carta">
            <span>Expansion</span>
            <strong>{card.expansion?.name || "Sin expansion"}</strong>
          </section>
        </div>
      </section>
    </div>
  );
}

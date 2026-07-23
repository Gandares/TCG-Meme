import { useEffect, useMemo, useRef, useState } from "react";
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

function readDocumentStyles() {
  return Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(new Error("No se pudo preparar una imagen de la carta.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function imageToDataUrl(src) {
  if (!src || src.startsWith("data:")) {
    return src;
  }

  const response = await fetch(src, { mode: "cors" });
  if (!response.ok) {
    throw new Error("No se pudo cargar una imagen de la carta.");
  }

  return blobToDataUrl(await response.blob());
}

async function inlineImages(root) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    image.setAttribute("src", await imageToDataUrl(image.currentSrc || image.src));
    image.removeAttribute("loading");
  }));
}

function svgTextToPngBlob(svgText, width, height, scale = 3) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    image.addEventListener("load", () => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("No se pudo preparar la descarga."));
        return;
      }

      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo crear el PNG."))), "image/png");
    }, { once: true });

    image.addEventListener("error", () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("No se pudo renderizar la carta descargable."));
    }, { once: true });

    image.src = svgUrl;
  });
}

async function renderCardPng(cardNode) {
  if (!cardNode) {
    throw new Error("No se pudo encontrar la carta para descargar.");
  }

  const card = cardNode.querySelector(".tcg-card");

  if (!card) {
    throw new Error("No se pudo encontrar la carta para descargar.");
  }

  const bounds = card.getBoundingClientRect();
  const width = Math.ceil(bounds.width);
  const height = Math.ceil(bounds.height);
  const clone = card.cloneNode(true);

  clone.style.setProperty("--tilt-x", "0deg");
  clone.style.setProperty("--tilt-y", "0deg");
  clone.style.setProperty("--glare-x", "50%");
  clone.style.setProperty("--glare-y", "50%");
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.minHeight = `${height}px`;
  clone.style.margin = "0";
  clone.style.transform = "none";

  await inlineImages(clone);

  const css = `${readDocumentStyles()}
    .download-card-root {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: transparent;
    }

    .download-card-root .tcg-card {
      width: ${width}px !important;
      height: ${height}px !important;
      min-height: ${height}px !important;
      margin: 0 !important;
      transform: none !important;
      border-color: transparent !important;
      box-shadow: none !important;
    }

    .download-card-root .tcg-card::after {
      opacity: 0 !important;
    }
  `;

  const svgText = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" class="download-card-root">
          <style>${css.replaceAll("</style", "<\\/style")}</style>
          ${clone.outerHTML}
        </div>
      </foreignObject>
    </svg>
  `;

  return svgTextToPngBlob(svgText, width, height);
}

export function CardDetailModal({ card, count, collection, variant = "normal", onClose }) {
  const defaultVariant = cardVariants.includes(variant) ? variant : "normal";
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const cardPreviewRef = useRef(null);
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
      const blob = await renderCardPng(cardPreviewRef.current);
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

        <div className="detail-card-preview" ref={cardPreviewRef}>
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

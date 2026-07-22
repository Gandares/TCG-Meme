import { useEffect, useMemo, useState } from "react";
import { assetUrl } from "../api/cards";
import { cardVariants, effectiveRarity, getCollectionCount, initials, rarityClass, variantLabel, withCardVariant } from "../utils/cards";

export function CardDetailModal({ card, count, collection, variant = "normal", onClose }) {
  const defaultVariant = cardVariants.includes(variant) ? variant : "normal";
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant);
  const [isPressingArt, setIsPressingArt] = useState(false);
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
  const image = assetUrl(displayVariant === "alternative" ? displayCard.alternativeImage || displayCard.image : displayCard.image);
  const displayCount = collection ? getCollectionCount(collection, card.id, displayVariant) : count;

  useEffect(() => {
    setSelectedVariant(defaultVariant);
  }, [defaultVariant, card.id]);

  function handleTilt(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const tiltX = (y - 0.5) * -14;
    const tiltY = (x - 0.5) * 14;

    event.currentTarget.style.setProperty("--tilt-x", `${tiltX}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${tiltY}deg`);
    event.currentTarget.style.setProperty("--glare-x", `${x * 100}%`);
    event.currentTarget.style.setProperty("--glare-y", `${y * 100}%`);
  }

  function resetTilt(event) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
    event.currentTarget.style.setProperty("--glare-x", "50%");
    event.currentTarget.style.setProperty("--glare-y", "50%");
  }

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsPressingArt(true);
    handleTilt(event);
  }

  function handlePointerUp(event) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsPressingArt(false);
    resetTilt(event);
  }

  function handlePointerLeave(event) {
    setIsPressingArt(false);
    resetTilt(event);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`card-detail ${rarityClass(effectiveRarity(card, displayVariant))} ${isHolographic ? "detail-holo" : ""} ${displayVariant === "alternative" ? "detail-alternative" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cardDetailTitle"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="detail-close" type="button" aria-label="Cerrar detalle" onClick={onClose}>
          x
        </button>

        <div
          className={`detail-art tilt-card ${isHolographic ? "card-holo" : ""} ${isPressingArt ? "is-pressing" : ""}`}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={handlePointerDown}
          onPointerMove={handleTilt}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerLeave}
          onPointerLeave={handlePointerLeave}
        >
          {image ? <img src={image} alt={displayCard.name} draggable="false" /> : <span>{initials(displayCard.name)}</span>}
          {isHolographic ? <div className="holo-layer" /> : null}
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

          <dl className="detail-list">
            <div>
              <dt>Descripcion</dt>
              <dd>{card.description || "Sin descripcion."}</dd>
            </div>
            <div>
              <dt>Flavour text</dt>
              <dd>{card.flavor || "Sin flavour text."}</dd>
            </div>
            <div>
              <dt>Creador</dt>
              <dd>{card.author || "Creador anonimo"}</dd>
            </div>
            <div>
              <dt>Expansion</dt>
              <dd>{card.expansion?.name || "Sin expansion"}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

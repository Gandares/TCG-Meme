import { useEffect, useState } from "react";
import { Card } from "./Card";
import { CardDetailModal } from "./CardDetailModal";
import { assetUrl } from "../api/cards";
import { withCardVariant } from "../utils/cards";

export function PackOpening({
  cards,
  expansions = [],
  selectedExpansionId = "",
  onExpansionChange,
  user,
  stats,
  currency = 0,
  packCost = 100,
  pulls,
  recentPulls = [],
  onOpenPack,
  onDismissReveal,
  onLogout,
}) {
  const [isOpening, setIsOpening] = useState(false);
  const [isRevealVisible, setIsRevealVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const hasCards = cards.length > 0;
  const canAfford = currency >= packCost;
  const canOpen = hasCards && canAfford;
  const selectedExpansion = expansions.find((expansion) => expansion.id === selectedExpansionId) || expansions[0];
  const canChangeExpansion = expansions.length > 1;
  const packImage = assetUrl(selectedExpansion?.packImage);
  const coinImage = assetUrl("assets/arcane-coin.png");

  useEffect(() => {
    if (pulls.length) {
      setIsRevealVisible(true);
    }
  }, [pulls]);

  useEffect(() => {
    if (!isRevealVisible || selectedCard) {
      return undefined;
    }

    function dismissReveal() {
      setIsRevealVisible(false);
      setSelectedCard(null);
      onDismissReveal?.();
    }

    window.addEventListener("click", dismissReveal);
    window.addEventListener("keydown", dismissReveal);

    return () => {
      window.removeEventListener("click", dismissReveal);
      window.removeEventListener("keydown", dismissReveal);
    };
  }, [isRevealVisible, selectedCard]);

  useEffect(() => {
    if (!selectedCard) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setSelectedCard(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCard]);

  async function handlePackClick() {
    if (!canOpen || isOpening) {
      return;
    }

    setIsOpening(true);
    window.setTimeout(async () => {
      try {
        await onOpenPack();
      } finally {
        setIsOpening(false);
      }
    }, 880);
  }

  function handleExpansionStep(direction) {
    if (!canChangeExpansion || !selectedExpansion?.id) {
      return;
    }

    const currentIndex = Math.max(0, expansions.findIndex((expansion) => expansion.id === selectedExpansion.id));
    const nextIndex = (currentIndex + direction + expansions.length) % expansions.length;
    onExpansionChange?.(expansions[nextIndex].id);
  }

  function countInCurrentPack(cardId, variant = "normal") {
    return pulls.filter((card) => card.id === cardId && (card.variant || "normal") === variant).length || 1;
  }

  return (
    <section className="view active" aria-labelledby="packsTitle">
      <div className="view-header">
        <div>
          <h2 id="packsTitle">Apertura de sobre</h2>
          <p>El sobre reparte 5 cartas de la expansión actual.</p>
        </div>
        <div className="user-panel header-user-panel">
          <div>
            <strong>{user?.username}</strong>
            <div className="currency-pill" aria-label={`${stats?.currency || 0} monedas`}>
              <img src={coinImage} alt="" />
              <span>{stats?.currency || 0}</span>
            </div>
          </div>
          <button className="ghost-button" type="button" onClick={onLogout}>Salir</button>
        </div>
      </div>

      <div className="pack-stage">
        <div className="pack-display">
          <button
            className="pack-arrow"
            type="button"
            aria-label="Expansión anterior"
            disabled={!canChangeExpansion || isOpening}
            onClick={() => handleExpansionStep(-1)}
          >
            ‹
          </button>
          <button
            className={`pack-art${isOpening ? " opening" : ""}`}
            type="button"
            aria-label="Abrir sobre"
            disabled={!canOpen || isOpening}
            onClick={handlePackClick}
          >
            <span className="pack-seal pack-seal-top" />
            <span className="pack-image" style={packImage ? { backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.22)), url("${packImage}")` } : undefined} />
            <span className="pack-rim" />
            <span className="pack-shine" />
            <span className="pack-count">5 cartas</span>
            <span className="pack-burst" aria-hidden="true" />
            <span className="pack-shards" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} style={{ "--shard-index": index }} />
              ))}
            </span>
            <span className="pack-seal pack-seal-bottom" />
          </button>
          <button
            className="pack-arrow"
            type="button"
            aria-label="Expansión siguiente"
            disabled={!canChangeExpansion || isOpening}
            onClick={() => handleExpansionStep(1)}
          >
            ›
          </button>
        </div>
        <div className="pack-copy">
          <span className="pack-expansion-name">{selectedExpansion?.name || "Sin expansión"}</span>
          <h3>{isOpening ? "Abriendo sobre..." : "Toca el sobre"}</h3>
          <div className="pack-price" aria-label={`Coste ${packCost} monedas`}>
            <img src={coinImage} alt="" />
            <strong>{packCost}</strong>
          </div>
          <p>
            {!hasCards
              ? "Crea al menos una carta en esta expansión para empezar."
              : canAfford
                ? "Haz click sobre el sobre para revelar 5 cartas."
                : `Necesitas ${packCost} monedas para abrir un sobre.`}
          </p>
        </div>
      </div>

      <section className="recent-pulls" aria-label="Ultimas cartas obtenidas">
        <h3>Ultimas cartas</h3>
        {recentPulls.length ? (
          <div className="recent-pulls-track" aria-live="polite">
            {recentPulls.map((card, index) => (
              <div className="recent-pull-card" key={`${card.id}-${card.variant || "normal"}-${index}`}>
                <Card card={card} />
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">Abre un sobre para ver aqui tus ultimas cartas.</p>
        )}
      </section>

      {isRevealVisible ? (
        <div className="pack-reveal-overlay" role="dialog" aria-modal="true" aria-label="Cartas abiertas">
          <div className="pack-reveal-grid" aria-live="polite">
            {pulls.map((card, index) => {
              const displayCard = withCardVariant(card, card.variant || "normal");
              return (
              <div className="deal-card reveal-card" style={{ animationDelay: `${index * 90}ms` }} key={`${card.id}-${displayCard.variant}-${index}`}>
                <button
                  className="card-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedCard(displayCard);
                  }}
                >
                  <Card card={displayCard} />
                </button>
              </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {selectedCard ? (
        <CardDetailModal
          card={selectedCard}
          variant={selectedCard.variant || "normal"}
          count={countInCurrentPack(selectedCard.id, selectedCard.variant || "normal")}
          onClose={() => setSelectedCard(null)}
        />
      ) : null}
    </section>
  );
}

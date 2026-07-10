import { useEffect, useState } from "react";
import { Card } from "./Card";
import { CardDetailModal } from "./CardDetailModal";

export function PackOpening({ cards, pulls, recentPulls = [], onOpenPack, onDismissReveal }) {
  const [isOpening, setIsOpening] = useState(false);
  const [isRevealVisible, setIsRevealVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const canOpen = cards.length > 0;

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
    }, 760);
  }

  function countInCurrentPack(cardId) {
    return pulls.filter((card) => card.id === cardId).length || 1;
  }

  return (
    <section className="view active" aria-labelledby="packsTitle">
      <div className="view-header">
        <div>
          <h2 id="packsTitle">Apertura de sobre</h2>
          <p>El sobre usa las cartas que hayas creado y reparte 5 al azar.</p>
        </div>
      </div>

      <div className="pack-stage">
        <button
          className={`pack-art${isOpening ? " opening" : ""}`}
          type="button"
          aria-label="Abrir sobre"
          disabled={!canOpen || isOpening}
          onClick={handlePackClick}
        >
          <span className="pack-flap" />
          <span className="pack-rim" />
          <span className="pack-title">MEME PACK</span>
          <span className="pack-shine" />
          <span className="pack-count">5 cartas</span>
        </button>
        <div className="pack-copy">
          <h3>{isOpening ? "Abriendo sobre..." : "Toca el sobre"}</h3>
          <p>{canOpen ? "Haz click sobre el sobre para revelar 5 cartas." : "Crea al menos una carta para empezar."}</p>
        </div>
      </div>

      <section className="recent-pulls" aria-label="Ultimas cartas obtenidas">
        <h3>Ultimas cartas</h3>
        {recentPulls.length ? (
          <div className="recent-pulls-track" aria-live="polite">
            {recentPulls.map((card, index) => (
              <div className="recent-pull-card" key={`${card.id}-${index}`}>
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
            {pulls.map((card, index) => (
              <div className="deal-card reveal-card" style={{ animationDelay: `${index * 90}ms` }} key={`${card.id}-${index}`}>
                <button
                  className="card-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedCard(card);
                  }}
                >
                  <Card card={card} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {selectedCard ? (
        <CardDetailModal card={selectedCard} count={countInCurrentPack(selectedCard.id)} onClose={() => setSelectedCard(null)} />
      ) : null}
    </section>
  );
}

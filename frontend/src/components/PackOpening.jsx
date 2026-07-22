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
  onJoinExpansion,
}) {
  const [isOpening, setIsOpening] = useState(false);
  const [isRevealVisible, setIsRevealVisible] = useState(false);
  const [revealedCards, setRevealedCards] = useState(() => new Set());
  const [selectedCard, setSelectedCard] = useState(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const hasCards = cards.length > 0;
  const canAfford = currency >= packCost;
  const canOpen = hasCards && canAfford;
  const selectedExpansion = expansions.find((expansion) => expansion.id === selectedExpansionId) || expansions[0];
  const canChangeExpansion = expansions.length > 1;
  const packImage = assetUrl(selectedExpansion?.packImage);
  const coinImage = assetUrl("assets/arcane-coin.png");
  const allCardsRevealed = pulls.length > 0 && revealedCards.size >= pulls.length;

  useEffect(() => {
    if (pulls.length && !isOpening) {
      setIsRevealVisible(true);
    }
  }, [isOpening, pulls]);

  useEffect(() => {
    setRevealedCards(new Set());
  }, [pulls]);

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
    const startedAt = Date.now();
    try {
      await onOpenPack();
    } finally {
      const remainingAnimationMs = Math.max(0, 880 - (Date.now() - startedAt));
      window.setTimeout(() => {
        setIsOpening(false);
      }, remainingAnimationMs);
    }
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

  function revealCard(index) {
    setRevealedCards((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }

  function revealAllCards() {
    setRevealedCards(new Set(pulls.map((_, index) => index)));
  }

  function dismissReveal() {
    if (!allCardsRevealed) {
      return;
    }

    setIsRevealVisible(false);
    setSelectedCard(null);
    onDismissReveal?.();
  }

  async function handleJoinSubmit(event) {
    event.preventDefault();
    const code = joinCode.trim();
    if (!code) {
      setJoinError("Introduce un codigo.");
      return;
    }

    setJoinError("");
    setJoinMessage("");
    setIsJoining(true);
    try {
      const result = await onJoinExpansion?.(code);
      setJoinCode("");
      setJoinMessage(result?.expansion?.name ? `Te uniste a ${result.expansion.name}.` : "Expansion anadida.");
    } catch (error) {
      setJoinError(error.message || "No se pudo unir la expansion.");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <section className="view active" aria-labelledby="packsTitle">
      <div className="view-header">
        <div>
          <h2 id="packsTitle">Apertura de sobre</h2>
          <p>El sobre reparte 5 cartas de la expansión actual.</p>
        </div>
        <div className={`user-panel header-user-panel ${isUserMenuOpen ? "open" : ""}`}>
          <button
            className="user-summary-button"
            type="button"
            aria-expanded={isUserMenuOpen}
            onClick={() => setIsUserMenuOpen((current) => !current)}
          >
            <strong>{user?.username}</strong>
            <div className="currency-pill" aria-label={`${stats?.currency || 0} monedas`}>
              <img src={coinImage} alt="" />
              <span>{stats?.currency || 0}</span>
            </div>
          </button>
          {isUserMenuOpen ? (
            <div className="user-menu">
              <form className="join-code-form" onSubmit={handleJoinSubmit}>
                <label htmlFor="joinCode">Codigo de union</label>
                <div>
                  <input
                    id="joinCode"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    maxLength="6"
                    placeholder="ABC123"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  />
                  <button className="primary-button" type="submit" disabled={isJoining}>
                    {isJoining ? "..." : "Unir"}
                  </button>
                </div>
                {joinError ? <span className="join-code-error">{joinError}</span> : null}
                {joinMessage ? <span className="join-code-success">{joinMessage}</span> : null}
              </form>
              <button className="ghost-button" type="button" onClick={onLogout}>Cerrar sesion</button>
            </div>
          ) : null}
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
        <div className={`pack-reveal-overlay ${allCardsRevealed ? "ready-to-close" : ""}`} role="dialog" aria-modal="true" aria-label="Cartas abiertas" onClick={dismissReveal}>
          <button
            className="skip-reveal-button"
            type="button"
            disabled={allCardsRevealed}
            onClick={(event) => {
              event.stopPropagation();
              revealAllCards();
            }}
          >
            Saltar
          </button>
          <div
            className="pack-reveal-grid"
            aria-live="polite"
            onClick={(event) => {
              if (!allCardsRevealed) {
                event.stopPropagation();
              }
            }}
          >
            {pulls.map((card, index) => {
              const displayCard = withCardVariant(card, card.variant || "normal");
              const isRevealed = revealedCards.has(index);
              const isLegendaryReveal = isRevealed && displayCard.displayRarity === "Legendaria";
              return (
              <div className="deal-card reveal-card" style={{ animationDelay: `${index * 90}ms` }} key={`${card.id}-${displayCard.variant}-${index}`}>
                <button
                  className={`reveal-flip-card ${isRevealed ? "revealed" : ""} ${isLegendaryReveal ? "legendary-reveal" : ""}`}
                  type="button"
                  aria-label={isRevealed ? `Ver detalle de ${displayCard.name}` : "Dar la vuelta a la carta"}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isRevealed) {
                      setSelectedCard(displayCard);
                      return;
                    }

                    revealCard(index);
                  }}
                >
                  <span className="reveal-flip-inner">
                    <span className="reveal-face reveal-back">
                      <Card card={displayCard} locked />
                    </span>
                    <span className="reveal-face reveal-front">
                      <Card card={displayCard} />
                    </span>
                  </span>
                  {isLegendaryReveal ? (
                    <span className="legendary-reveal-effect" aria-hidden="true">
                      {Array.from({ length: 10 }, (_, sparkIndex) => (
                        <span key={sparkIndex} style={{ "--spark-index": sparkIndex }} />
                      ))}
                    </span>
                  ) : null}
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

import { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { CardDetailModal } from "./CardDetailModal";
import { compareByRarity, getCollectionCount, getOwnedVariantCount, withCardVariant } from "../utils/cards";

const rarities = ["all", "Comun", "Rara", "Epica", "Legendaria"];

export function CollectionView({ cards, collection }) {
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("all");
  const [selectedCard, setSelectedCard] = useState(null);

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...cards]
      .sort(compareByRarity)
      .filter((card) => {
        const matchesRarity = rarity === "all" || card.rarity === rarity;
        const haystack = `${card.name} ${card.rarity}`.toLowerCase();
        return matchesRarity && haystack.includes(query);
      });
  }, [cards, rarity, search]);

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

  return (
    <section className="view active" aria-labelledby="collectionTitle">
      <div className="view-header">
        <div>
          <h2 id="collectionTitle">Coleccion</h2>
          <p>Consulta tus cartas desbloqueadas y descubre que rarezas te faltan.</p>
        </div>
        <input
          className="search-input"
          type="search"
          placeholder="Buscar carta..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="filters" role="group" aria-label="Filtros de rareza">
        {rarities.map((item) => (
          <button
            className={`filter-button ${rarity === item ? "active" : ""}`}
            type="button"
            key={item}
            onClick={() => setRarity(item)}
          >
            {item === "all" ? "Todas" : item}
          </button>
        ))}
      </div>

      <div className="card-grid">
        {filteredCards.length ? (
          filteredCards.map((card) => {
            const normalCount = getCollectionCount(collection, card.id, "normal");
            const holoCount = getCollectionCount(collection, card.id, "holo");
            const ownedCount = normalCount + holoCount;
            const previewVariant = normalCount > 0 ? "normal" : holoCount > 0 ? "holo" : "normal";
            const isLocked = ownedCount <= 0;

            return (
              <button
                className={`card-button${isLocked ? " locked" : ""}`}
                type="button"
                key={card.id}
                disabled={isLocked}
                onClick={() => setSelectedCard(card)}
              >
                <Card card={withCardVariant(card, previewVariant)} count={ownedCount} locked={isLocked} />
              </button>
            );
          })
        ) : (
          <div className="empty-state">Todavia no hay cartas que coincidan.</div>
        )}
      </div>
      {selectedCard ? (
        <CardDetailModal
          card={selectedCard}
          count={getOwnedVariantCount(collection, selectedCard.id)}
          collection={collection}
          onClose={() => setSelectedCard(null)}
        />
      ) : null}
    </section>
  );
}

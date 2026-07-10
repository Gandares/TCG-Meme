import { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { CardDetailModal } from "./CardDetailModal";
import { compareByRarity } from "../utils/cards";

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
            const count = Number(collection[card.id]) || 0;
            const isLocked = count <= 0;

            return (
              <button
                className={`card-button${isLocked ? " locked" : ""}`}
                type="button"
                key={card.id}
                disabled={isLocked}
                onClick={() => setSelectedCard(card)}
              >
                <Card card={card} count={count} locked={isLocked} />
              </button>
            );
          })
        ) : (
          <div className="empty-state">Todavia no hay cartas que coincidan.</div>
        )}
      </div>
      {selectedCard ? <CardDetailModal card={selectedCard} count={collection[selectedCard.id]} onClose={() => setSelectedCard(null)} /> : null}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { CardDetailModal } from "./CardDetailModal";
import { cardVariants, compareByRarity, getCollectionCount, getOwnedVariantCount, withCardVariant } from "../utils/cards";

const rarities = ["all", "Comun", "Rara", "Epica", "Legendaria"];
const sellValuesByRarity = {
  Comun: 5,
  Rara: 10,
  Epica: 20,
  Legendaria: 50,
};

export function CollectionView({ cards, collection, expansions = [], onSellDuplicates }) {
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState("all");
  const [expansionId, setExpansionId] = useState("all");
  const [selectedCard, setSelectedCard] = useState(null);
  const [sellMessage, setSellMessage] = useState("");
  const [sellError, setSellError] = useState("");
  const [isSelling, setIsSelling] = useState(false);

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    const expansionsById = new Map(expansions.map((expansion) => [expansion.id, expansion]));
    return [...cards]
      .sort(compareByRarity)
      .filter((card) => {
        const matchesRarity = rarity === "all" || card.rarity === rarity;
        const matchesExpansion = expansionId === "all" || card.expansionId === expansionId;
        const expansionName = expansionsById.get(card.expansionId)?.name || "";
        const haystack = `${card.name} ${card.rarity} ${expansionName}`.toLowerCase();
        return matchesRarity && matchesExpansion && haystack.includes(query);
      });
  }, [cards, expansionId, expansions, rarity, search]);

  const duplicateSummary = useMemo(() => {
    return cards.reduce(
      (summary, card) => {
        for (const variant of cardVariants) {
          const count = getCollectionCount(collection, card.id, variant);
          const duplicates = Math.max(0, count - 1);
          if (duplicates > 0) {
            const displayRarity = withCardVariant(card, variant).displayRarity;
            summary.count += duplicates;
            summary.value += duplicates * (sellValuesByRarity[displayRarity] || 0);
          }
        }
        return summary;
      },
      { count: 0, value: 0 },
    );
  }, [cards, collection]);

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

  async function handleSellDuplicates() {
    if (!duplicateSummary.count || isSelling) {
      return;
    }

    setSellMessage("");
    setSellError("");
    setIsSelling(true);
    try {
      const result = await onSellDuplicates?.();
      setSellMessage(`Vendidas ${result?.soldCount || 0} repetidas por ${result?.earned || 0} monedas.`);
    } catch (error) {
      setSellError(error.message || "No se pudieron vender las repetidas.");
    } finally {
      setIsSelling(false);
    }
  }

  return (
    <section className="view active" aria-labelledby="collectionTitle">
      <div className="view-header">
        <div>
          <h2 id="collectionTitle">Coleccion</h2>
          <p>Consulta tus cartas desbloqueadas y descubre que rarezas te faltan.</p>
        </div>
        <div className="collection-actions">
          <input
            className="search-input"
            type="search"
            placeholder="Buscar carta..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="primary-button" type="button" disabled={!duplicateSummary.count || isSelling} onClick={handleSellDuplicates}>
            {isSelling ? "Vendiendo..." : "Vender sobrante"}
          </button>
          {duplicateSummary.count ? <small>{duplicateSummary.count} repetidas · {duplicateSummary.value} monedas</small> : <small>Sin sobrantes</small>}
        </div>
      </div>
      {sellMessage ? <div className="form-success" role="status">{sellMessage}</div> : null}
      {sellError ? <div className="form-error" role="alert">{sellError}</div> : null}

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

      <div className="filters" role="group" aria-label="Filtros de expansion">
        <button
          className={`filter-button ${expansionId === "all" ? "active" : ""}`}
          type="button"
          onClick={() => setExpansionId("all")}
        >
          Todas las expansiones
        </button>
        {expansions.map((expansion) => (
          <button
            className={`filter-button ${expansionId === expansion.id ? "active" : ""}`}
            type="button"
            key={expansion.id}
            onClick={() => setExpansionId(expansion.id)}
          >
            {expansion.name}
          </button>
        ))}
      </div>

      <div className="card-grid">
        {filteredCards.length ? (
          filteredCards.map((card) => {
            const ownedCount = getOwnedVariantCount(collection, card.id);
            const previewVariant = cardVariants.find((variant) => getCollectionCount(collection, card.id, variant) > 0) || "normal";
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

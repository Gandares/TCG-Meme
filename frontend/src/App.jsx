import { useEffect, useMemo, useState } from "react";
import { clearAuth, createCard, fetchCards, fetchCollection, fetchExpansions, joinExpansion, loadAuth, openPack, saveAuth, sellDuplicateCards } from "./api/cards";
import { AuthView } from "./components/AuthView";
import { CardCreator } from "./components/CardCreator";
import { CollectionView } from "./components/CollectionView";
import { PackOpening } from "./components/PackOpening";
import { Sidebar } from "./components/Sidebar";

export default function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const [activeView, setActiveView] = useState("packs");
  const [cards, setCards] = useState([]);
  const [expansions, setExpansions] = useState([]);
  const [joinedExpansionIds, setJoinedExpansionIds] = useState([]);
  const [selectedExpansionId, setSelectedExpansionId] = useState("");
  const [collection, setCollection] = useState({});
  const [pulls, setPulls] = useState([]);
  const [recentPulls, setRecentPulls] = useState([]);
  const [openedPacks, setOpenedPacks] = useState(0);
  const [currency, setCurrency] = useState(0);
  const [packCost, setPackCost] = useState(100);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth?.token) {
      return;
    }

    let isMounted = true;
    Promise.all([fetchCards(), fetchExpansions(), fetchCollection(auth.token)])
      .then(([serverCards, serverExpansions, userCollection]) => {
        if (isMounted) {
          setCards(serverCards);
          setExpansions(serverExpansions);
          setJoinedExpansionIds(userCollection.joinedExpansionIds || []);
          setSelectedExpansionId((currentExpansionId) => {
            const joinedIds = userCollection.joinedExpansionIds || [];
            const visibleExpansions = serverExpansions.filter((expansion) => joinedIds.includes(expansion.id));
            if (visibleExpansions.some((expansion) => expansion.id === currentExpansionId)) {
              return currentExpansionId;
            }

            return visibleExpansions[0]?.id || "";
          });
          setCollection(userCollection.collection || {});
          setOpenedPacks(Number(userCollection.openedPacks) || 0);
          setRecentPulls(userCollection.recentPulls || []);
          setCurrency(Number(userCollection.currency) || 0);
          setPackCost(Number(userCollection.packCost) || 100);
        }
      })
      .catch(() => {
        if (isMounted) {
          handleLogout();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [auth?.token]);

  useEffect(() => {
    if (!auth?.token) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrency((currentCurrency) => {
        if (currentCurrency >= 500) {
          return currentCurrency;
        }

        return Math.min(500, currentCurrency + 1);
      });
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [auth?.token]);

  const stats = useMemo(
    () => ({
      totalCards: cards.length,
      ownedCards: Object.values(collection).reduce((sum, count) => sum + (Number(count) || 0), 0),
      openedPacks,
      currency,
    }),
    [cards, collection, currency, openedPacks],
  );

  function handleAuthenticated(nextAuth) {
    saveAuth(nextAuth);
    setAuth(nextAuth);
  }

  function handleLogout() {
    clearAuth();
    setAuth(null);
    setCards([]);
    setExpansions([]);
    setJoinedExpansionIds([]);
    setSelectedExpansionId("");
    setCollection({});
    setPulls([]);
    setRecentPulls([]);
    setOpenedPacks(0);
    setCurrency(0);
    setPackCost(100);
    setActiveView("packs");
  }

  async function handleOpenPack() {
    const expansionCards = cards.filter((card) => card.expansionId === selectedExpansionId);
    if (!expansionCards.length) {
      setActiveView("creator");
      return;
    }

    if (currency < packCost) {
      setError(`Necesitas ${packCost} monedas para abrir un sobre.`);
      return;
    }

    setError("");
    try {
      const pack = await openPack(auth.token, selectedExpansionId);
      const nextPulls = pack.pulls || [];
      setPulls(nextPulls);
      setRecentPulls(pack.recentPulls || []);
      setCollection(pack.collection || {});
      setOpenedPacks(Number(pack.openedPacks) || 0);
      setCurrency(Number(pack.currency) || 0);
      setPackCost(Number(pack.packCost) || packCost);
      return pack;
    } catch (packError) {
      setError(packError.message || "No se pudo abrir el sobre.");
    }
  }

  async function handleCreateCard(card) {
    const savedCard = await createCard(card, auth.token);
    setCards((currentCards) => [savedCard, ...currentCards]);
    setActiveView("packs");
  }

  async function handleSellDuplicates() {
    const result = await sellDuplicateCards(auth.token);
    setCollection(result.collection || {});
    setCurrency(Number(result.currency) || 0);
    return result;
  }

  async function handleJoinExpansion(code) {
    const result = await joinExpansion(auth.token, code);
    const nextJoinedIds = result.joinedExpansionIds || result.user?.joinedExpansionIds || [];
    setJoinedExpansionIds(nextJoinedIds);
    if (result.user) {
      const nextAuth = { ...auth, user: result.user };
      saveAuth(nextAuth);
      setAuth(nextAuth);
    }
    if (result.expansion?.id) {
      setSelectedExpansionId(result.expansion.id);
    }
    return result;
  }

  if (!auth?.token) {
    return <AuthView onAuthenticated={handleAuthenticated} />;
  }

  const visibleExpansions = expansions.filter((expansion) => joinedExpansionIds.includes(expansion.id));
  const visibleExpansionIds = new Set(visibleExpansions.map((expansion) => expansion.id));
  const visibleCards = cards.filter((card) => visibleExpansionIds.has(card.expansionId));
  const canCreateCards = visibleExpansions.length > 0;
  const currentView = activeView === "creator" && !canCreateCards ? "packs" : activeView;

  return (
    <div className="app-shell">
      <Sidebar activeView={currentView} stats={stats} onViewChange={setActiveView} canCreateCards={canCreateCards} />
      <main className="main-content">
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        {currentView === "packs" ? (
          <PackOpening
            cards={visibleCards.filter((card) => card.expansionId === selectedExpansionId)}
            expansions={visibleExpansions}
            selectedExpansionId={selectedExpansionId}
            onExpansionChange={setSelectedExpansionId}
            user={auth.user}
            stats={stats}
            currency={currency}
            packCost={packCost}
            pulls={pulls}
            recentPulls={recentPulls}
            onOpenPack={handleOpenPack}
            onDismissReveal={() => setPulls([])}
            onLogout={handleLogout}
            onJoinExpansion={handleJoinExpansion}
          />
        ) : null}
        {currentView === "collection" ? <CollectionView cards={visibleCards} collection={collection} expansions={visibleExpansions} onSellDuplicates={handleSellDuplicates} /> : null}
        {currentView === "creator" ? <CardCreator user={auth.user} expansions={visibleExpansions} selectedExpansionId={selectedExpansionId} onCreateCard={handleCreateCard} /> : null}
      </main>
    </div>
  );
}

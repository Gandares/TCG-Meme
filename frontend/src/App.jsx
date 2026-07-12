import { useEffect, useMemo, useState } from "react";
import { clearAuth, createCard, fetchCards, fetchCollection, fetchExpansions, loadAuth, openPack, saveAuth } from "./api/cards";
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
          setSelectedExpansionId((currentExpansionId) => {
            if (serverExpansions.some((expansion) => expansion.id === currentExpansionId)) {
              return currentExpansionId;
            }

            return serverExpansions[0]?.id || "";
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
    } catch (packError) {
      setError(packError.message || "No se pudo abrir el sobre.");
    }
  }

  async function handleCreateCard(card) {
    const savedCard = await createCard(card, auth.token);
    setCards((currentCards) => [savedCard, ...currentCards]);
    setActiveView("packs");
  }

  if (!auth?.token) {
    return <AuthView onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} stats={stats} onViewChange={setActiveView} />
      <main className="main-content">
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        {activeView === "packs" ? (
          <PackOpening
            cards={cards.filter((card) => card.expansionId === selectedExpansionId)}
            expansions={expansions}
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
          />
        ) : null}
        {activeView === "collection" ? <CollectionView cards={cards} collection={collection} expansions={expansions} /> : null}
        {activeView === "creator" ? <CardCreator user={auth.user} expansions={expansions} selectedExpansionId={selectedExpansionId} onCreateCard={handleCreateCard} /> : null}
      </main>
    </div>
  );
}

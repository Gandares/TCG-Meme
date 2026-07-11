import { useEffect, useMemo, useState } from "react";
import { clearAuth, createCard, fetchCards, fetchCollection, loadAuth, openPack, saveAuth } from "./api/cards";
import { AuthView } from "./components/AuthView";
import { CardCreator } from "./components/CardCreator";
import { CollectionView } from "./components/CollectionView";
import { PackOpening } from "./components/PackOpening";
import { Sidebar } from "./components/Sidebar";

export default function App() {
  const [auth, setAuth] = useState(() => loadAuth());
  const [activeView, setActiveView] = useState("packs");
  const [cards, setCards] = useState([]);
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
    Promise.all([fetchCards(), fetchCollection(auth.token)])
      .then(([serverCards, userCollection]) => {
        if (isMounted) {
          setCards(serverCards);
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
    setCollection({});
    setPulls([]);
    setRecentPulls([]);
    setOpenedPacks(0);
    setCurrency(0);
    setPackCost(100);
    setActiveView("packs");
  }

  async function handleOpenPack() {
    if (!cards.length) {
      setActiveView("creator");
      return;
    }

    if (currency < packCost) {
      setError(`Necesitas ${packCost} monedas para abrir un sobre.`);
      return;
    }

    setError("");
    try {
      const pack = await openPack(auth.token);
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
      <Sidebar activeView={activeView} stats={stats} user={auth.user} onLogout={handleLogout} onViewChange={setActiveView} />
      <main className="main-content">
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        {activeView === "packs" ? (
          <PackOpening
            cards={cards}
            currency={currency}
            packCost={packCost}
            pulls={pulls}
            recentPulls={recentPulls}
            onOpenPack={handleOpenPack}
            onDismissReveal={() => setPulls([])}
          />
        ) : null}
        {activeView === "collection" ? <CollectionView cards={cards} collection={collection} /> : null}
        {activeView === "creator" ? <CardCreator user={auth.user} onCreateCard={handleCreateCard} /> : null}
      </main>
    </div>
  );
}

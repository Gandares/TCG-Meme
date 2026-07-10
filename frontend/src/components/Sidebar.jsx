export function Sidebar({ activeView, stats, user, onLogout, onViewChange }) {
  const tabs = [
    ["packs", "PK", "Sobres"],
    ["collection", "CL", "Coleccion"],
    ["creator", "+", "Crear carta"],
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">TCG</div>
        <div>
          <h1>TCG Meme</h1>
          <p>Crea cartas, abre sobres, completa tu coleccion.</p>
        </div>
      </div>

      <div className="user-panel">
        <strong>{user.username}</strong>
        <button className="ghost-button" type="button" onClick={onLogout}>Salir</button>
      </div>

      <nav className="tabs" aria-label="Secciones">
        {tabs.map(([view, icon, label]) => (
          <button
            className={`tab-button ${activeView === view ? "active" : ""}`}
            type="button"
            aria-pressed={activeView === view}
            key={view}
            onClick={() => onViewChange(view)}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      <section className="stats-panel" aria-label="Resumen">
        <div>
          <span>{stats.totalCards}</span>
          <small>Cartas creadas</small>
        </div>
        <div>
          <span>{stats.ownedCards}</span>
          <small>En coleccion</small>
        </div>
        <div>
          <span>{stats.openedPacks}</span>
          <small>Sobres abiertos</small>
        </div>
      </section>
    </aside>
  );
}

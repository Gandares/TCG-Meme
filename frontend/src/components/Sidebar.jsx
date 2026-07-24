export function Sidebar({ activeView, stats, onViewChange, canCreateCards = true }) {
  const tabs = [
    ["packs", "pack", "Sobres"],
    ["collection", "collection", "Coleccion"],
    canCreateCards ? ["creator", "create", "Crear carta"] : null,
    canCreateCards ? ["editor", "edit", "Editar cartas"] : null,
  ].filter(Boolean);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <img src="/arcane-icon.png" alt="" />
        </div>
        <div>
          <h1>TCG Meme</h1>
          <p>Crea cartas, abre sobres, completa tu coleccion.</p>
        </div>
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
            <TabIcon name={icon} />
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

function TabIcon({ name }) {
  const icons = {
    pack: (
      <>
        <path d="M7 3h10l2 4v14H5V7l2-4Z" />
        <path d="M5 7h14" />
        <path d="M8 11h8" />
        <path d="M8 15h8" />
      </>
    ),
    collection: (
      <>
        <path d="M7 5h10v14H7z" />
        <path d="M4 8h3v11" />
        <path d="M17 8h3v11" />
      </>
    ),
    create: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
        <path d="M6 6h4" />
        <path d="M14 18h4" />
      </>
    ),
    edit: (
      <>
        <path d="M5 19l4.5-1 8.7-8.7a2.1 2.1 0 0 0-3-3L6.5 15 5 19Z" />
        <path d="M13.8 7.2l3 3" />
      </>
    ),
  };

  return (
    <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        {icons[name]}
      </g>
    </svg>
  );
}

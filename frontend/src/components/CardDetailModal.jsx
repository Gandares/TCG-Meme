import { assetUrl } from "../api/cards";
import { initials, rarityClass } from "../utils/cards";

export function CardDetailModal({ card, count, onClose }) {
  const image = assetUrl(card.image);

  function handleTilt(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const tiltX = (y - 0.5) * -14;
    const tiltY = (x - 0.5) * 14;

    event.currentTarget.style.setProperty("--tilt-x", `${tiltX}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${tiltY}deg`);
    event.currentTarget.style.setProperty("--glare-x", `${x * 100}%`);
    event.currentTarget.style.setProperty("--glare-y", `${y * 100}%`);
  }

  function resetTilt(event) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
    event.currentTarget.style.setProperty("--glare-x", "50%");
    event.currentTarget.style.setProperty("--glare-y", "50%");
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`card-detail ${rarityClass(card.rarity)}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cardDetailTitle"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="detail-close" type="button" aria-label="Cerrar detalle" onClick={onClose}>
          x
        </button>

        <div className="detail-art tilt-card" onPointerMove={handleTilt} onPointerLeave={resetTilt}>
          {image ? <img src={image} alt={card.name} /> : <span>{initials(card.name)}</span>}
        </div>

        <div className="detail-content">
          <div className="detail-heading">
            <div>
              <h2 id="cardDetailTitle">{card.name}</h2>
              <p className={`detail-rarity ${rarityClass(card.rarity)}`}>{card.rarity}</p>
            </div>
            <strong>x{count || 0}</strong>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Descripcion</dt>
              <dd>{card.description || "Sin descripcion."}</dd>
            </div>
            <div>
              <dt>Flavour text</dt>
              <dd>{card.flavor || "Sin flavour text."}</dd>
            </div>
            <div>
              <dt>Creador</dt>
              <dd>{card.author || "Creador anonimo"}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

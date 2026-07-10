import { assetUrl } from "../api/cards";
import { initials, rarityClass } from "../utils/cards";

export function Card({ card, count, locked = false }) {
  const image = assetUrl(card.image);

  function handleTilt(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const tiltX = (y - 0.5) * -10;
    const tiltY = (x - 0.5) * 10;

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

  if (locked) {
    return (
      <article className={`tcg-card card-locked tilt-card ${rarityClass(card.rarity)}`} onPointerMove={handleTilt} onPointerLeave={resetTilt}>
        <div className="card-back-pattern" />
        <div className="card-back-mark">?</div>
        <div className="card-back-copy">
          <strong>Carta bloqueada</strong>
          <span>No desbloqueada</span>
        </div>
      </article>
    );
  }

  return (
    <article className={`tcg-card tilt-card ${rarityClass(card.rarity)}`} onPointerMove={handleTilt} onPointerLeave={resetTilt}>
      <div className="card-art">
        {image ? <img src={image} alt={card.name} loading="lazy" /> : initials(card.name)}
      </div>
      <div className="card-vignette" />
      <div className="card-topline">
        <strong>{card.name}</strong>
      </div>
      <div className="card-body">
        <p>{card.description || "Sin descripcion."}</p>
        {card.flavor ? <em>{card.flavor}</em> : null}
      </div>
      <div className="card-footer">
        <span>{card.author || "Creador anonimo"}</span>
        {count ? <span>x{count}</span> : null}
      </div>
    </article>
  );
}

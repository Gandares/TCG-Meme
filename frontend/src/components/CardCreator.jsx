import { useMemo, useState } from "react";
import { Card } from "./Card";
import { nextRarity, resizeImageFile, withCardVariant } from "../utils/cards";

const emptyForm = {
  name: "",
  rarity: "Comun",
  image: "",
  imageFile: null,
  description: "",
  flavor: "",
  author: "",
};

export function CardCreator({ onCreateCard }) {
  const [form, setForm] = useState(emptyForm);
  const [previewVariant, setPreviewVariant] = useState("normal");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canPreviewHolo = Boolean(nextRarity(form.rarity));

  const previewCard = useMemo(() => {
    const variant = previewVariant === "holo" && nextRarity(form.rarity) ? "holo" : "normal";
    return withCardVariant(
      {
      id: "preview",
      name: form.name || "Nueva Carta",
      type: "",
      rarity: form.rarity,
      image: form.image,
      description: form.description || "Descripcion de la carta.",
      flavor: form.flavor || "\"Aqui iria una frase con personalidad.\"",
      author: form.author || "Creador anonimo",
      },
      variant,
    );
  }, [form, previewVariant]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    const preview = file ? await resizeImageFile(file) : "";
    setForm((current) => ({ ...current, image: preview, imageFile: file || null }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      await onCreateCard({
        name: form.name.trim(),
        type: "",
        rarity: form.rarity,
        imageFile: form.imageFile,
        description: form.description.trim(),
        flavor: form.flavor.trim(),
        author: form.author.trim(),
      });
      event.currentTarget.reset();
      setForm(emptyForm);
      setPreviewVariant("normal");
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar la carta.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="view active" aria-labelledby="creatorTitle">
      <div className="view-header">
        <div>
          <h2 id="creatorTitle">Crear carta</h2>
          <p>Define las cartas que podran aparecer en los sobres.</p>
        </div>
      </div>

      <div className="creator-layout">
        <form className="editor-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input type="text" maxLength="28" placeholder="Ej. Caballero del WiFi" required value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          </label>
          <label>
            Rareza
            <select value={form.rarity} onChange={(event) => updateField("rarity", event.target.value)}>
              <option>Comun</option>
              <option>Rara</option>
              <option>Epica</option>
              <option>Legendaria</option>
            </select>
          </label>
          <label>
            Imagen
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} />
          </label>
          <label>
            Descripcion
            <textarea maxLength="130" rows="4" placeholder="Texto o efecto de la carta" value={form.description} onChange={(event) => updateField("description", event.target.value)} />
          </label>
          <label>
            Flavour text
            <textarea maxLength="120" rows="3" placeholder="Una frase narrativa o graciosa" value={form.flavor} onChange={(event) => updateField("flavor", event.target.value)} />
          </label>
          <label>
            Creada por
            <input type="text" maxLength="28" placeholder="Tu nombre o alias" value={form.author} onChange={(event) => updateField("author", event.target.value)} />
          </label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar carta"}</button>
          </div>
        </form>

        <div className="preview-panel">
          <h3>Vista previa</h3>
          <div className="variant-toggle" role="group" aria-label="Version de vista previa">
            <button className={`filter-button ${previewVariant === "normal" || !canPreviewHolo ? "active" : ""}`} type="button" onClick={() => setPreviewVariant("normal")}>
              Normal
            </button>
            <button
              className={`filter-button ${previewVariant === "holo" && canPreviewHolo ? "active" : ""}`}
              type="button"
              disabled={!canPreviewHolo}
              onClick={() => setPreviewVariant("holo")}
            >
              Holo
            </button>
          </div>
          <div id="previewCard">
            <Card card={previewCard} />
          </div>
        </div>
      </div>
    </section>
  );
}

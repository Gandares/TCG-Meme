import { useEffect, useMemo, useState } from "react";
import { assetUrl } from "../api/cards";
import { resizeImageFile, withCardVariant } from "../utils/cards";
import { Card } from "./Card";
import { CustomSelect } from "./CustomSelect";

export function CardEditor({ user, cards = [], expansions = [], onUpdateCard }) {
  const editableCards = useMemo(
    () => cards.filter((card) => String(card.author || "").toLowerCase() === String(user?.username || "").toLowerCase()),
    [cards, user?.username],
  );
  const [selectedCardId, setSelectedCardId] = useState(editableCards[0]?.id || "");
  const [form, setForm] = useState(createForm(editableCards[0]));
  const [previewVariant, setPreviewVariant] = useState("normal");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedCard = editableCards.find((card) => card.id === selectedCardId) || editableCards[0] || null;
  const selectedExpansion = expansions.find((expansion) => expansion.id === selectedCard?.expansionId) || selectedCard?.expansion;

  useEffect(() => {
    if (!editableCards.length) {
      setSelectedCardId("");
      return;
    }

    if (!editableCards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(editableCards[0].id);
    }
  }, [editableCards, selectedCardId]);

  useEffect(() => {
    setForm(createForm(selectedCard));
    setPreviewVariant("normal");
    setError("");
    setSuccess("");
  }, [selectedCard?.id]);

  const previewCard = useMemo(() => {
    if (!selectedCard) {
      return null;
    }

    return withCardVariant(
      {
        ...selectedCard,
        name: form.name || selectedCard.name,
        image: form.image || selectedCard.image,
        alternativeImage: form.alternativeImage || selectedCard.alternativeImage || selectedCard.image,
        description: form.description || selectedCard.description,
        flavor: form.flavor,
        expansion: selectedExpansion,
      },
      previewVariant,
    );
  }, [form, previewVariant, selectedCard, selectedExpansion]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    const preview = file ? await resizeImageFile(file) : selectedCard?.image || "";
    setForm((current) => ({ ...current, image: preview, imageFile: file || null }));
  }

  async function handleAlternativeImageChange(event) {
    const file = event.target.files?.[0];
    const preview = file ? await resizeImageFile(file) : selectedCard?.alternativeImage || selectedCard?.image || "";
    setForm((current) => ({ ...current, alternativeImage: preview, alternativeImageFile: file || null }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedCard || isSaving) {
      return;
    }

    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("El titulo es obligatorio.");
      return;
    }

    if (!form.description.trim()) {
      setError("La descripcion es obligatoria.");
      return;
    }

    setIsSaving(true);
    try {
      const savedCard = await onUpdateCard(selectedCard.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        flavor: form.flavor.trim(),
        imageFile: form.imageFile,
        alternativeImageFile: form.alternativeImageFile,
      });
      event.currentTarget.reset();
      setForm(createForm(savedCard));
      setSuccess("Carta actualizada.");
    } catch (saveError) {
      setError(saveError.message || "No se pudo actualizar la carta.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="view active" aria-labelledby="editorTitle">
      <div className="view-header">
        <div>
          <h2 id="editorTitle">Editar cartas</h2>
          <p>Modifica solo las cartas creadas por tu usuario.</p>
        </div>
      </div>

      {!editableCards.length ? (
        <div className="empty-state">Todavia no tienes cartas creadas para editar.</div>
      ) : (
        <div className="creator-layout">
          <form className="editor-form" onSubmit={handleSubmit}>
            <label>
              Carta
              <CustomSelect
                label="Carta"
                options={editableCards.map((card) => ({ value: card.id, label: card.name }))}
                value={selectedCard?.id || ""}
                onChange={setSelectedCardId}
              />
            </label>
            <label>
              Nombre *
              <input type="text" maxLength="28" placeholder="Nombre de la carta" required value={form.name} onChange={(event) => updateField("name", event.target.value)} />
            </label>
            <label>
              Rareza
              <input type="text" value={selectedCard?.rarity || ""} readOnly />
            </label>
            <label>
              Expansion
              <input type="text" value={selectedExpansion?.name || ""} readOnly />
            </label>
            <label>
              Imagen
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} />
              <span className="selected-file-name">{form.imageFile?.name || "Se conserva la imagen actual"}</span>
            </label>
            <label>
              Imagen alternativa
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAlternativeImageChange} />
              <span className="selected-file-name">{form.alternativeImageFile?.name || "Se conserva la imagen alternativa actual"}</span>
            </label>
            <label>
              Descripcion *
              <textarea maxLength="110" rows="4" placeholder="Texto o efecto de la carta" required value={form.description} onChange={(event) => updateField("description", event.target.value)} />
            </label>
            <label>
              Texto "flavour"
              <textarea maxLength="90" rows="3" placeholder="Una frase narrativa o graciosa" value={form.flavor} onChange={(event) => updateField("flavor", event.target.value)} />
            </label>
            <label>
              Creada por
              <input type="text" value={selectedCard?.author || ""} readOnly />
            </label>
            {error ? <div className="form-error" role="alert">{error}</div> : null}
            {success ? <div className="form-success" role="status">{success}</div> : null}
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar cambios"}</button>
            </div>
          </form>

          <div className="preview-panel">
            <h3>Vista previa</h3>
            <div className="variant-toggle" role="group" aria-label="Version de vista previa">
              <button className={`filter-button ${previewVariant === "normal" ? "active" : ""}`} type="button" onClick={() => setPreviewVariant("normal")}>
                Normal
              </button>
              <button className={`filter-button ${previewVariant === "holo" ? "active" : ""}`} type="button" onClick={() => setPreviewVariant("holo")}>
                Holo
              </button>
              <button className={`filter-button ${previewVariant === "alternative" ? "active" : ""}`} type="button" onClick={() => setPreviewVariant("alternative")}>
                Alternativa
              </button>
            </div>
            <div id="previewCard">
              {previewCard ? <Card card={previewCard} /> : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function createForm(card) {
  return {
    name: card?.name || "",
    image: card?.image ? assetUrl(card.image) : "",
    imageFile: null,
    alternativeImage: card?.alternativeImage ? assetUrl(card.alternativeImage) : assetUrl(card?.image || ""),
    alternativeImageFile: null,
    description: card?.description || "",
    flavor: card?.flavor || "",
  };
}

import { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { CustomSelect } from "./CustomSelect";
import { resizeImageFile, withCardVariant } from "../utils/cards";

const emptyForm = {
  name: "",
  rarity: "Comun",
  image: "",
  imageFile: null,
  alternativeImage: "",
  alternativeImageFile: null,
  description: "",
  flavor: "",
};

const rarityOptions = ["Comun", "Rara", "Epica", "Legendaria"].map((rarity) => ({
  value: rarity,
  label: rarity,
}));

export function CardCreator({ user, expansions = [], selectedExpansionId = "", onCreateCard }) {
  const [form, setForm] = useState({ ...emptyForm, expansionId: selectedExpansionId });
  const [previewVariant, setPreviewVariant] = useState("normal");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const creatorName = user?.username || "";
  const currentExpansionId = form.expansionId || selectedExpansionId || expansions[0]?.id || "";
  const currentExpansion = expansions.find((expansion) => expansion.id === currentExpansionId) || expansions[0];

  useEffect(() => {
    if (!form.expansionId && selectedExpansionId) {
      setForm((current) => ({ ...current, expansionId: selectedExpansionId }));
    }
  }, [form.expansionId, selectedExpansionId]);

  const previewCard = useMemo(() => {
    const variant = previewVariant === "holo" || previewVariant === "alternative" ? previewVariant : "normal";
    return withCardVariant(
      {
        id: "preview",
        name: form.name || "Nueva Carta",
        type: "",
        rarity: form.rarity,
        image: form.image,
        alternativeImage: form.alternativeImage || form.image,
        description: form.description || "Descripción de la carta.",
        flavor: form.flavor || "\"comentario\"",
        author: creatorName || "Creador anonimo",
        expansionId: currentExpansionId,
        expansion: currentExpansion,
      },
      variant,
    );
  }, [creatorName, currentExpansion, currentExpansionId, form, previewVariant]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    const preview = file ? await resizeImageFile(file) : "";
    setForm((current) => ({ ...current, image: preview, imageFile: file || null }));
  }

  async function handleAlternativeImageChange(event) {
    const file = event.target.files?.[0];
    const preview = file ? await resizeImageFile(file) : "";
    setForm((current) => ({ ...current, alternativeImage: preview, alternativeImageFile: file || null }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.imageFile) {
      setError("La imagen es obligatoria.");
      return;
    }

    if (!form.alternativeImageFile) {
      setError("La imagen alternativa es obligatoria.");
      return;
    }

    if (!form.description.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }

    setIsSaving(true);

    try {
      await onCreateCard({
        name: form.name.trim(),
        type: "",
        rarity: form.rarity,
        imageFile: form.imageFile,
        alternativeImageFile: form.alternativeImageFile,
        expansionId: currentExpansionId,
        description: form.description.trim(),
        flavor: form.flavor.trim(),
        author: creatorName,
      });
      event.currentTarget.reset();
      setForm({ ...emptyForm, expansionId: currentExpansionId });
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

      {!expansions.length ? (
        <div className="empty-state">Introduce un codigo de union desde tu usuario para crear cartas en una expansion.</div>
      ) : null}

      <div className="creator-layout">
        <form className="editor-form" onSubmit={handleSubmit} aria-disabled={!expansions.length}>
          <label>
            Nombre *
            <input type="text" maxLength="28" placeholder="Nombre de la carta" required value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          </label>
          <label>
            Rareza *
            <CustomSelect label="Rareza" options={rarityOptions} value={form.rarity} onChange={(value) => updateField("rarity", value)} />
          </label>
          <label>
            Expansión *
            <CustomSelect
              label="Expansión"
              options={expansions.map((expansion) => ({ value: expansion.id, label: expansion.name }))}
              value={currentExpansionId}
              onChange={(value) => updateField("expansionId", value)}
            />
          </label>
          <label>
            Imagen *
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" required onChange={handleImageChange} />
          </label>
          <label>
            Imagen alternativa *
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" required onChange={handleAlternativeImageChange} />
          </label>
          <label>
            Descripción *
            <textarea maxLength="130" rows="4" placeholder="Texto o efecto de la carta" required value={form.description} onChange={(event) => updateField("description", event.target.value)} />
          </label>
          <label>
            Texto "flavour"
            <textarea maxLength="120" rows="3" placeholder="Una frase narrativa o graciosa" value={form.flavor} onChange={(event) => updateField("flavor", event.target.value)} />
          </label>
          <label>
            Creada por *
            <input type="text" value={creatorName} readOnly />
          </label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isSaving || !expansions.length}>{isSaving ? "Guardando..." : "Guardar carta"}</button>
          </div>
        </form>

        <div className="preview-panel">
          <h3>Vista previa</h3>
          <div className="variant-toggle" role="group" aria-label="Version de vista previa">
            <button className={`filter-button ${previewVariant === "normal" ? "active" : ""}`} type="button" onClick={() => setPreviewVariant("normal")}>
              Normal
            </button>
            <button
              className={`filter-button ${previewVariant === "holo" ? "active" : ""}`}
              type="button"
              onClick={() => setPreviewVariant("holo")}
            >
              Holo
            </button>
            <button
              className={`filter-button ${previewVariant === "alternative" ? "active" : ""}`}
              type="button"
              onClick={() => setPreviewVariant("alternative")}
            >
              Alternativa
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatTags, parseTags, suggestTags } from "@/lib/tags";

type CategoryOption = { id: number; slug: string; label: string };

/**
 * Champ « tags » avec suggestions automatiques.
 *
 * Les suggestions se recalculent à chaque saisie à partir de la catégorie (le
 * `<select name="categoryId">` du formulaire, ou une catégorie fixe), de la
 * commune et de la description du même formulaire. Un clic ajoute le mot ;
 * champ laissé vide = les suggestions sont appliquées à l'enregistrement
 * (`autoTags` côté serveur), l'adhérent garde donc toujours la main.
 *
 * Le champ est volontairement **non contrôlé** : l'écouteur natif posé sur le
 * formulaire provoque un rendu React au milieu de l'événement de saisie, et un
 * champ contrôlé y perdrait la frappe en cours.
 */
export function TagsField({
  name = "tags",
  defaultValue = "",
  placeholder = "Levain naturel, Produits locaux, Fait maison",
  categories,
  fixedCategory,
}: {
  name?: string;
  defaultValue?: string | null;
  placeholder?: string;
  /** Formulaire staff : catégories sélectionnables (le select s'appelle `categoryId`). */
  categories?: CategoryOption[];
  /** Espace adhérent : catégorie non modifiable. */
  fixedCategory?: { slug: string | null; label: string | null } | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<string[]>(() => parseTags(defaultValue));
  const [context, setContext] = useState({ categoryId: "", city: "", description: "" });

  // Lit les autres champs du formulaire et se tient à jour à chaque frappe.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const read = () => {
      const data = new FormData(form);
      setContext({
        categoryId: String(data.get("categoryId") ?? ""),
        city: String(data.get("city") ?? ""),
        description: String(data.get("description") ?? ""),
      });
      setCurrent(parseTags(inputRef.current?.value));
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, []);

  const suggestions = useMemo(() => {
    const category = fixedCategory ?? categories?.find((c) => String(c.id) === context.categoryId) ?? null;
    const all = suggestTags({
      categorySlug: category?.slug,
      categoryLabel: category?.label,
      city: context.city,
      description: context.description,
    });
    const have = new Set(current.map((t) => t.toLowerCase()));
    return all.filter((t) => !have.has(t.toLowerCase()));
  }, [fixedCategory, categories, context, current]);

  function setTags(tags: string[]) {
    const input = inputRef.current;
    if (!input) return;
    input.value = formatTags(tags);
    setCurrent(parseTags(input.value));
  }

  return (
    <div>
      <input
        ref={inputRef}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="field"
        placeholder={placeholder}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <div className="tag-suggestions" aria-label="Suggestions de tags">
          <span className="tag-suggestions__label">Suggestions :</span>
          {suggestions.map((tag) => (
            <button key={tag} type="button" className="tag-suggestion" onClick={() => setTags([...current, tag])} title={`Ajouter « ${tag} »`}>
              + {tag}
            </button>
          ))}
          <button type="button" className="tag-suggestion tag-suggestion--all" onClick={() => setTags([...current, ...suggestions])}>
            Tout ajouter
          </button>
        </div>
      )}
      <p className="field-hint">
        Mots-clés que vos clients recherchent : produits, services, marques, quartier. Laissez vide pour que les
        suggestions soient appliquées automatiquement à l&apos;enregistrement. Ils s&apos;affichent sur votre fiche et
        sont transmis aux moteurs de recherche.
      </p>
    </div>
  );
}

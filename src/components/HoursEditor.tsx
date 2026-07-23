"use client";

import { useMemo, useState } from "react";
import {
  editorSchedule,
  serializeMemberHours,
  type DaySchedule,
  type HoursSlot,
} from "@/lib/member-profile";

function emptySlot(): HoursSlot {
  return { start: "09:00", end: "18:00" };
}

export function HoursEditor({ defaultValue }: { defaultValue?: string | null }) {
  const initialDays = useMemo(() => editorSchedule(defaultValue), [defaultValue]);
  const [days, setDays] = useState<DaySchedule[]>(initialDays);
  const [touched, setTouched] = useState(Boolean(defaultValue?.trim()));

  function updateDay(index: number, update: (day: DaySchedule) => DaySchedule) {
    setTouched(true);
    setDays((current) => current.map((day, dayIndex) => (dayIndex === index ? update(day) : day)));
  }

  function setOpen(index: number, open: boolean) {
    updateDay(index, (day) => ({
      ...day,
      closed: !open,
      slots: open ? (day.slots.length > 0 ? day.slots : [emptySlot()]) : [],
    }));
  }

  function updateSlot(index: number, slotIndex: number, key: keyof HoursSlot, value: string) {
    updateDay(index, (day) => ({
      ...day,
      slots: day.slots.map((slot, currentSlot) =>
        currentSlot === slotIndex ? { ...slot, [key]: value } : slot
      ),
    }));
  }

  function addSlot(index: number) {
    updateDay(index, (day) => ({
      ...day,
      closed: false,
      slots: [...day.slots, { start: "14:00", end: "18:00" }].slice(0, 2),
    }));
  }

  function removeSlot(index: number, slotIndex: number) {
    updateDay(index, (day) => {
      const slots = day.slots.filter((_, currentSlot) => currentSlot !== slotIndex);
      return { ...day, closed: slots.length === 0, slots };
    });
  }

  const serialized = touched ? serializeMemberHours(days) : defaultValue ?? "";

  return (
    <fieldset className="hours-editor">
      <legend className="field-label">Horaires d&apos;ouverture</legend>
      <p className="hours-editor__hint">
        Activez jours ouverts. Ajoutez seconde plage pour coupure déjeuner.
      </p>
      <input type="hidden" name="hours" value={serialized} />

      <div className="hours-editor__days">
        {days.map((day, index) => {
          const open = !day.closed;
          return (
            <div className={`hours-editor__day${open ? " is-open" : ""}`} key={day.key}>
              <div className="hours-editor__day-head">
                <strong>{day.label}</strong>
                <label className="hours-editor__toggle">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(event) => setOpen(index, event.target.checked)}
                  />
                  <span>{open ? "Ouvert" : "Fermé"}</span>
                </label>
              </div>

              {open && (
                <div className="hours-editor__slots">
                  {day.slots.map((slot, slotIndex) => (
                    <div className="hours-editor__slot" key={`${day.key}-${slotIndex}`}>
                      <label>
                        <span>De</span>
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(event) =>
                            updateSlot(index, slotIndex, "start", event.target.value)
                          }
                          aria-label={`${day.label}, ouverture ${slotIndex + 1}`}
                        />
                      </label>
                      <label>
                        <span>À</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(event) =>
                            updateSlot(index, slotIndex, "end", event.target.value)
                          }
                          aria-label={`${day.label}, fermeture ${slotIndex + 1}`}
                        />
                      </label>
                      {day.slots.length > 1 && (
                        <button
                          type="button"
                          className="hours-editor__remove"
                          onClick={() => removeSlot(index, slotIndex)}
                          aria-label={`Supprimer plage ${slotIndex + 1} du ${day.label.toLowerCase()}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {day.slots.length < 2 && (
                    <button
                      type="button"
                      className="hours-editor__add"
                      onClick={() => addSlot(index)}
                    >
                      + Ajouter une seconde plage
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveMeetingRegistration,
  type MeetingRegistrationState,
} from "@/app/backend/actions";

type Participant = {
  name: string;
  imageConsent: boolean;
  status?: string;
};

const INITIAL_STATE: MeetingRegistrationState = { status: "idle", message: "" };

export function MeetingRegistrationForm({
  meetingId,
  defaultName,
  existing,
  maxPerAccount,
  remaining,
}: {
  meetingId: number;
  defaultName: string;
  existing: Participant[];
  maxPerAccount: number;
  remaining: number;
}) {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>(
    existing.length > 0 ? existing : [{ name: defaultName, imageConsent: false }],
  );
  const [state, formAction, pending] = useActionState(saveMeetingRegistration, INITIAL_STATE);
  const maxAllowed = Math.max(existing.length, Math.min(maxPerAccount, existing.length + remaining));
  const registered = existing.length > 0;

  useEffect(() => {
    if (state.status !== "success") return;
    if (state.registrationCount === 0) {
      setParticipants([{ name: defaultName, imageConsent: false }]);
    }
    router.refresh();
  }, [defaultName, router, state]);

  return (
    <form action={formAction} style={{ display: "grid", gap: 18 }}>
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="participantCount" value={participants.length} />

      <div style={{ background: "#f6f2e8", border: "1px solid #e6dcc6", borderRadius: 8, padding: "13px 15px", color: "#6c6150", fontSize: 13.5, lineHeight: 1.6 }}>
        Maximum {maxPerAccount} participant{maxPerAccount > 1 ? "s" : ""} par compte membre.
        {registered && (
          <span style={{ display: "block", color: "#9a6638", fontWeight: 800, marginTop: 3 }}>
            {existing.every((participant) => participant.status === "confirmed")
              ? "Inscription confirmée"
              : "Inscription en attente de validation"}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {participants.map((participant, index) => (
          <div key={index} style={{ border: "1px solid #e6dcc6", borderRadius: 8, padding: 16, background: "#fff" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor={`participant-${index}`}>
                  Participant {index + 1} - nom et prénom
                </label>
                <input
                  id={`participant-${index}`}
                  name={`participantName-${index}`}
                  className="field"
                  required
                  maxLength={200}
                  value={participant.name}
                  onChange={(event) =>
                    setParticipants((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
              {participants.length > 1 && (
                <button
                  type="button"
                  aria-label={`Retirer le participant ${index + 1}`}
                  title="Retirer"
                  onClick={() => setParticipants((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  style={{ width: 42, height: 42, border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", borderRadius: 8, cursor: "pointer", fontSize: 20 }}
                >
                  ×
                </button>
              )}
            </div>
            <label style={{ display: "flex", gap: 9, alignItems: "start", color: "#6c6150", fontSize: 12.5, lineHeight: 1.5, marginTop: 11 }}>
              <input
                type="checkbox"
                name={`imageConsent-${index}`}
                checked={participant.imageConsent}
                onChange={() =>
                  setParticipants((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, imageConsent: !item.imageConsent } : item,
                    ),
                  )
                }
                style={{ marginTop: 3 }}
              />
              Cette personne autorise la publication de son image sur les supports de Plein R.
            </label>
          </div>
        ))}
      </div>

      {participants.length < maxAllowed && (
        <button
          type="button"
          onClick={() => setParticipants((current) => [...current, { name: "", imageConsent: false }])}
          style={{ justifySelf: "start", border: "none", background: "transparent", color: "#9a6638", fontWeight: 800, cursor: "pointer", padding: 0 }}
        >
          + Ajouter un participant
        </button>
      )}

      <label style={{ display: "flex", gap: 9, alignItems: "start", color: "#6c6150", fontSize: 12.5, lineHeight: 1.55 }}>
        <input type="checkbox" name="attestation" required style={{ marginTop: 3 }} />
        J'atteste avoir informé chaque personne inscrite que des photos peuvent être prises et avoir recueilli son accord ou son refus ci-dessus.
      </label>

      {state.message && (
        <div
          role="status"
          style={{
            background: state.status === "success" ? "#e6f4ec" : "#fbe9e6",
            border: `1px solid ${state.status === "success" ? "#b9dfc8" : "#f0c4bb"}`,
            color: state.status === "success" ? "#1f6f4a" : "#b53a25",
            borderRadius: 8,
            padding: "11px 14px",
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending || maxAllowed < 1}
          style={{ border: "none", background: "#13324F", color: "#fff", borderRadius: 8, padding: "13px 20px", fontWeight: 800, cursor: pending ? "default" : "pointer", opacity: pending ? 0.65 : 1 }}
        >
          {pending ? "Enregistrement..." : registered ? "Modifier mon inscription" : "Enregistrer mon inscription"}
        </button>
        {registered && (
          <button
            type="submit"
            name="intent"
            value="cancel"
            formNoValidate
            disabled={pending}
            style={{ border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", borderRadius: 8, padding: "12px 18px", fontWeight: 800, cursor: pending ? "default" : "pointer" }}
          >
            Annuler mon inscription
          </button>
        )}
      </div>
    </form>
  );
}

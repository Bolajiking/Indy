"use client";

import { useEffect } from "react";
import type { DashboardDeal } from "@/lib/api";

export function DealDetail({
  deal,
  onClose,
  onEdit,
}: {
  deal: DashboardDeal;
  onClose: () => void;
  onEdit: () => void;
}) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="modal-scrim" role="presentation" onMouseDown={onClose}>
      <article
        className="gcard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ width: "min(680px, 92vw)", padding: 24 }}
      >
        <h2 id="deal-detail-title">{deal.brand_name}</h2>
        <p>{deal.next_action ?? "No next action set."}</p>
        {deal.deadline_at && (
          <p>
            <strong>Deadline:</strong>{" "}
            {new Date(deal.deadline_at).toLocaleDateString()}
          </p>
        )}
        {deal.source_url && (
          <p>
            <strong>Source:</strong>{" "}
            <a href={deal.source_url} target="_blank" rel="noreferrer">
              {deal.source_url}
            </a>
          </p>
        )}
        {deal.source_confidence != null && (
          <p>
            <strong>Source confidence:</strong> {deal.source_confidence}%
          </p>
        )}
        {(deal.source_evidence?.length ?? 0) > 0 && (
          <section>
            <h3>Evidence</h3>
            <pre>{JSON.stringify(deal.source_evidence, null, 2)}</pre>
          </section>
        )}
        {(deal.deliverables?.length ?? 0) > 0 && (
          <section>
            <h3>Deliverables</h3>
            <pre>{JSON.stringify(deal.deliverables, null, 2)}</pre>
          </section>
        )}
        {deal.agent_provenance &&
          Object.keys(deal.agent_provenance).length > 0 && (
            <section>
              <h3>Agent provenance</h3>
              <pre>{JSON.stringify(deal.agent_provenance, null, 2)}</pre>
            </section>
          )}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="dark-pill dark-pill--solid" onClick={onEdit}>
            Edit
          </button>
          <button className="dark-pill" onClick={onClose}>
            Close
          </button>
        </div>
      </article>
    </div>
  );
}

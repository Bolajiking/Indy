import type { DashboardDeal, DashboardDealMutationInput } from "./api";

export function makeOptimisticDeal(
  input: DashboardDealMutationInput & { brandName: string },
  id = `optimistic-${Date.now()}`,
): DashboardDeal {
  const now = new Date().toISOString();
  return {
    id,
    brand_name: input.brandName,
    brand_contact_email: input.brandContactEmail ?? null,
    brand_contact_name: input.brandContactName ?? null,
    brand_domain: null,
    stage: "discovered",
    fit_score: input.fitScore ?? null,
    estimated_value_cents: input.estimatedValueCents ?? null,
    actual_value_cents: null,
    source_url: null,
    source_type: null,
    source_confidence: null,
    source_evidence: [],
    deliverables: [],
    deadline_at: input.deadlineAt ?? null,
    follow_up_at: input.followUpAt ?? null,
    probability: input.probability ?? null,
    next_action: input.nextAction ?? null,
    agent_provenance: {},
    archived_at: null,
    pitch_text: null,
    pitch_sent_at: null,
    response_text: null,
    responded_at: null,
    contract_notes: null,
    notes: input.notes ?? null,
    metadata: {},
    created_at: now,
    updated_at: now,
  };
}

export function replaceOptimisticDeal(
  deals: DashboardDeal[],
  temporaryId: string,
  saved?: DashboardDeal,
): DashboardDeal[] {
  return saved
    ? deals.map((deal) => (deal.id === temporaryId ? saved : deal))
    : deals.filter((deal) => deal.id !== temporaryId);
}

export function applyOptimisticDealEdit(
  deal: DashboardDeal,
  input: DashboardDealMutationInput,
): DashboardDeal {
  const mapped = {
    brandName: "brand_name",
    brandContactEmail: "brand_contact_email",
    brandContactName: "brand_contact_name",
    estimatedValueCents: "estimated_value_cents",
    deadlineAt: "deadline_at",
    followUpAt: "follow_up_at",
    fitScore: "fit_score",
    probability: "probability",
    nextAction: "next_action",
    notes: "notes",
    archivedAt: "archived_at",
  } as const;
  const changes: Record<string, unknown> = {};
  for (const [inputKey, dealKey] of Object.entries(mapped)) {
    const value = input[inputKey as keyof DashboardDealMutationInput];
    if (value !== undefined) changes[dealKey] = value;
  }
  return { ...deal, ...changes, updated_at: new Date().toISOString() };
}

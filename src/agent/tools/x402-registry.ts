/**
 * x402 Service Registry
 *
 * Discovers paid API services on the Tempo Network / agentcash bazaar by capability
 * category. Agents call `findService(capability)` to get a payable endpoint URL,
 * then use mppFetch (from ToolContext) to pay and call it.
 *
 * This is the bridge between Indyfren's payment infrastructure and the open x402
 * service marketplace — enabling the agent to autonomously expand its tool set at
 * runtime without hardcoded endpoints.
 *
 * Design:
 *   - Static fallback map of known services (always available, no network needed)
 *   - Optional live discovery from agentcash bazaar (if AGENTCASH_BAZAAR_URL is set)
 *   - Results cached for TTL to avoid repeated discovery calls
 */

import pino from "pino";

const log = pino({ name: "agent:x402-registry" });

export interface ServiceEntry {
  /** Capability category, e.g. "brand_enrichment", "browser", "email_verification" */
  capability: string;
  /** Human-readable name */
  name: string;
  /** The x402-protected endpoint URL */
  url: string;
  /** Estimated max cost per call in cents */
  estimatedCostCents: number;
  /** Brief description of what the service does */
  description: string;
  /** Source: "static" = hardcoded fallback, "bazaar" = discovered from registry */
  source: "static" | "bazaar";
}

// Static registry of known x402 services — always available as fallback.
// Add new services here as they come online on Tempo Network.
const STATIC_REGISTRY: ServiceEntry[] = [
  {
    capability: "brand_enrichment",
    name: "StableEnrich",
    url: "https://stableenrich.com/api/v1/enrich",
    estimatedCostCents: 200,
    description: "Enrich company/brand data: employees, revenue, domain, contacts",
    source: "static",
  },
  {
    capability: "browser",
    name: "Browserbase",
    url: "https://connect.browserbase.com",
    estimatedCostCents: 50,
    description: "Headless browser for web scraping and automation",
    source: "static",
  },
  {
    capability: "web_search",
    name: "Brave Search",
    url: "https://api.search.brave.com/res/v1/web/search",
    estimatedCostCents: 1,
    description: "Web search with privacy-preserving results",
    source: "static",
  },
  {
    capability: "email_verification",
    name: "Hunter.io Verify",
    url: "https://api.hunter.io/v2/email-verifier",
    estimatedCostCents: 10,
    description: "Verify email address deliverability",
    source: "static",
  },
  {
    capability: "contract_analysis",
    name: "Klarity AI",
    url: "https://api.klarity.ai/v1/analyze",
    estimatedCostCents: 500,
    description: "Legal contract analysis and risk extraction",
    source: "static",
  },
  {
    capability: "social_analytics",
    name: "Modash API",
    url: "https://api.modash.io/v1",
    estimatedCostCents: 300,
    description: "Creator/influencer analytics across Instagram, TikTok, YouTube",
    source: "static",
  },
];

interface CacheEntry {
  services: ServiceEntry[];
  expiresAt: number;
}

const discoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Find the best available service for a given capability.
 * Returns the static fallback if live discovery is unavailable or fails.
 */
export async function findService(capability: string): Promise<ServiceEntry | null> {
  // Check cache first
  const cached = discoveryCache.get(capability);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.services[0] ?? null;
  }

  // Try live discovery if bazaar URL is configured
  const bazaarUrl = process.env.AGENTCASH_BAZAAR_URL;
  if (bazaarUrl) {
    try {
      const discovered = await discoverFromBazaar(bazaarUrl, capability);
      if (discovered.length > 0) {
        discoveryCache.set(capability, { services: discovered, expiresAt: Date.now() + CACHE_TTL_MS });
        return discovered[0];
      }
    } catch (err: any) {
      log.warn({ capability, error: err.message }, "Live service discovery failed — falling back to static registry");
    }
  }

  // Fall back to static registry
  const staticMatch = STATIC_REGISTRY.find((s) => s.capability === capability);
  if (staticMatch) {
    return staticMatch;
  }

  log.warn({ capability }, "No service found for capability");
  return null;
}

/**
 * List all known services for a capability (static + discovered).
 */
export async function listServices(capability?: string): Promise<ServiceEntry[]> {
  const staticServices = capability
    ? STATIC_REGISTRY.filter((s) => s.capability === capability)
    : STATIC_REGISTRY;

  return staticServices;
}

/**
 * Discover services from the agentcash bazaar or Tempo marketplace.
 * Returns an empty array if the bazaar is unreachable.
 */
async function discoverFromBazaar(bazaarUrl: string, capability: string): Promise<ServiceEntry[]> {
  const response = await fetch(`${bazaarUrl}/v1/services?capability=${encodeURIComponent(capability)}`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) {
    throw new Error(`Bazaar returned ${response.status}`);
  }

  const data = await response.json() as { services?: Array<{
    capability: string;
    name: string;
    endpoint: string;
    max_price_cents: number;
    description: string;
  }> };

  return (data.services ?? []).map((s) => ({
    capability: s.capability,
    name: s.name,
    url: s.endpoint,
    estimatedCostCents: s.max_price_cents,
    description: s.description,
    source: "bazaar" as const,
  }));
}

/**
 * Register a new service at runtime (e.g. discovered via MCP, OAuth flow, etc.)
 */
export function registerService(entry: ServiceEntry): void {
  STATIC_REGISTRY.push(entry);
  // Invalidate cache for this capability
  discoveryCache.delete(entry.capability);
  log.info({ service: entry.name, capability: entry.capability }, "Service registered");
}

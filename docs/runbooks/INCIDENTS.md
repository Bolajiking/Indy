# Incident Response Runbook

Owner: on-call incident commander. Security incidents also assign a security lead; database recovery assigns a database operator.

## Severity

- SEV-0: confirmed cross-tenant access, exposed production secrets, wallet/key compromise, unauthorized payment, or destructive data loss. Disable the affected path immediately and page security and product owners.
- SEV-1: duplicate external writes, broad auth failure, sustained production outage, database unavailability, uncontrolled queue growth, or payment settlement inconsistency.
- SEV-2: degraded provider, transport, or non-critical workflow with a safe workaround.

## First 15 minutes

1. Start a UTC incident timeline and name the incident commander.
2. Record affected release SHA, request IDs, deployment IDs, metrics, queue counts, and provider status without copying message bodies, tokens, emails, or wallet secrets.
3. Contain: disable the affected feature flag/transport, stop promotion, or rollback. For ambiguous webhook/payment outcomes, do not replay.
4. Preserve redacted logs and database evidence. Rotate exposed credentials using [SECRET_ROTATION.md](./SECRET_ROTATION.md).
5. Communicate impact and next update time through the owner-approved public support channel.

## Scenario controls

- Cross-tenant/security: disable API traffic, preserve request IDs, rotate credentials, audit creator predicates and access logs.
- Duplicate write/webhook: pause workers, retain `outcome_unknown` records for reconciliation, never bulk retry them.
- Wallet/payment: disable paid calls, compare `payment_attempts`, transaction receipts, provider state, and on-chain state before refund/retry decisions.
- Provider outage: disable only the provider integration, keep core dashboard/API available, and watch recovery metrics.
- Database: fail readiness, stop writes, use point-in-time recovery or a verified backup.
- Queue: fail readiness when workers cannot consume; use [QUEUE_RECOVERY.md](./QUEUE_RECOVERY.md) only after Redis is stable.

Close only after impact stops, data is reconciled, smoke checks pass, evidence is stored, affected users are notified when required, and a follow-up owner/date is assigned.

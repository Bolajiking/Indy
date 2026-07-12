# Queue Recovery Runbook

Owner: backend on-call. Security or payment incidents require incident-commander approval before replay.

1. Confirm `/health/ready` failure cause, Redis health, worker logs, queue depth, and the affected release.
2. Stop deploys and fix Redis/worker connectivity first.
3. Preview eligible terminal jobs:

```bash
npm run jobs:retry-failed -- --dry-run --max 100
npm run jobs:retry-failed -- --dry-run --type account-deletion --max 100
npm run jobs:retry-failed -- --dry-run --type webhook-delivery --max 100
```

4. Reconcile webhook records. `processed` and `outcome_unknown` events are never replayed. The command only accepts terminal webhook failures explicitly recorded before provider invocation.
5. Execute the narrowest approved replay:

```bash
npm run jobs:retry-failed -- --type account-deletion --max 25
npm run jobs:retry-failed -- --type webhook-delivery --max 25
```

6. Verify queue depth decreases, workers remain ready, account deletion receipts reach terminal state, and provider event IDs do not produce duplicate effects.

There is no bulk rollback for an external effect. Stop replay immediately on ambiguity and escalate using [INCIDENTS.md](./INCIDENTS.md). Capture command options/results, queue counts before/after, request/job IDs, operator, approval, and UTC timestamps.

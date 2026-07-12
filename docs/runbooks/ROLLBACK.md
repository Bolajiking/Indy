# Rollback Runbook

Owner: release commander. The incident commander may order an immediate rollback. Database rollback requires a database operator and is never automatic.

## Application rollback

Use a previously verified commit rather than reversing schema changes in place.

```bash
git fetch origin
git switch --detach "$LAST_KNOWN_GOOD_SHA"
npm ci
npm ci --prefix dashboard
npm run verify
railway up --service backend --detach
vercel rollback "$LAST_KNOWN_GOOD_DASHBOARD_URL" --yes
```

Run the health and auth commands from [DEPLOY.md](./DEPLOY.md). If the new database schema is backward compatible, leave it in place. If it is not, disable traffic and restore using [BACKUP_RESTORE.md](./BACKUP_RESTORE.md); never hand-edit production rows during rollback.

Capture the bad and restored deployment IDs, commit SHAs, first/last impact timestamps, smoke output, migration ledger, and the decision owner. Rollback is complete only when readiness and the affected user flow are green and queue depth is stable.

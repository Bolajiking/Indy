# Account deletion and vendor residuals

Indyfren account deletion revokes Composio and native OAuth connections, asks
Privy to permanently delete the associated Privy user, and then deletes the
creator record so creator-owned database rows cascade away. Cleanup is durable,
idempotent, and retried from a server-side lifecycle record.

Privy documents that deleting a user does not delete their embedded wallets.
Those wallets are disassociated, soft-deleted, and archived. Indyfren's
policy-backed agent wallet is created without user ownership, and the current
Privy server SDK exposes no wallet-delete method. The wallet may therefore
remain at the vendor, and the public wallet address and its immutable on-chain
history remain visible. Deletion receipts retain only residual categories and
the public address; Privy user and agent-wallet identifiers are scrubbed when
cleanup completes.

References: [Privy delete-user API](https://docs.privy.io/api-reference/users/delete)
and [Privy deleting users](https://docs.privy.io/user-management/users/managing-users/deleting-users).

The deletion response returns a random, 24-hour lifecycle receipt once. Only
its SHA-256 hash is stored. The dashboard uses the raw receipt to poll a public
status endpoint that never accepts or returns a creator identifier. The receipt
also authorizes retry of a failed deterministic cleanup job. It is cleared when
cleanup completes, then creator-scoped browser state is purged and the Privy
session is ended. If cleanup pauses, Settings shows retry and support actions.

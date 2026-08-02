# Token Activity Show Complete Rename Design

## Goal

Replace every active project, package, product, IPC, preload, database, application, documentation, and test identifier derived from `token-show` or `Token Show` with the more accurate `token-activity-show` or `Token Activity Show` identity.

## Canonical Identity

- Repository and package name: `token-activity-show`
- Product and window title: `Token Activity Show`
- macOS application ID: `com.tokenactivityshow.app`
- SQLite filename: `token-activity-show.sqlite`
- IPC channel prefix: `token-activity-show:`
- Preload bridge: `window.tokenActivityShow`
- Type name where applicable: `TokenActivityShowApplication`

## Migration Policy

This is a clean break. Do not retain aliases for `window.tokenShow`, `token-show:*`, `com.tokenshow.app`, or `token-show.sqlite`. Do not migrate the existing development database or old Electron user-data directory. The project has no established real-source data, so compatibility code would add permanent complexity without preserving valuable user state.

## Scope

Update:

- `package.json` and `pnpm-lock.yaml`
- Electron builder metadata and HTML title
- database path and IPC constants
- context bridge declaration, implementation, renderer accessor, and tests
- visible application copy
- test temporary paths and project-name fixtures where they represent this product
- README, specifications, plans, and repository-maintained documentation
- any relevant type or symbol names containing `TokenShow`

Historical Git commits are not rewritten. The local checkout directory `/Users/lijiajun/Projects/token-show` is outside repository content and will not be renamed by this implementation because changing the active working directory would disrupt the current session. The GitHub repository is already named `token-activity-show`.

## Verification

- Search tracked repository content case-insensitively for `token-show`, `Token Show`, `tokenshow`, `tokenShow`, and `TokenShow`; no active occurrences may remain.
- Allow no old compatibility aliases.
- Run typecheck, lint, full tests, and production build.
- Launch Electron and verify the new product title and functional preload bridge.
- Commit the rename separately before visual refinement.

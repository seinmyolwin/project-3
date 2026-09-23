# PRODUCTION RELEASE CHECKLIST - Shwe Thiri Spa & KTV ERP (v1.0.0)

This checklist confirms the production readiness, packaging integrity, data safety, and zero-install offline capabilities of the release package.

- [x] **Canonical Package Manager**: All builds, lint checks, and testing suites execute exclusively via `npm` (`npm run build`, `npm run lint`, `npm test`, `npm run package`).
- [x] **Canonical Version (v1.0.0)**: `package.json`, `metadata.json`, `src/types/index.ts`, `src/server/config.ts`, and release manifests explicitly locked to v1.0.0.
- [x] **Native EXE generated**: `release/ShweThiriERP.exe` (or `release/KaraokePS5CommerceHub.exe`) successfully built via `npm run package`.
- [x] **EXE verified**: PE headers, size (>50MB), and embedded SEA blob verified.
- [x] **Runtime dependencies verified**: Bundled zero-install Windows runtime (`release/bin/node.exe`) ensures standalone execution without external Node.js prerequisite.
- [x] **SQLite WASM verified**: `sql-wasm.wasm` embedded and verified in `release/dist/` and `release/bin/`.
- [x] **APP_DATA_DIR separated**: Business database, backups, and logs isolated in persistent data directory separate from immutable binaries.
- [x] **Backup works**: Automated backup snapshot generation verified.
- [x] **Restore works**: Database restoration from backup snapshot verified.
- [x] **Restart persistence works**: 100% data preservation across graceful restarts.
- [x] **Crash recovery works**: ACID rollback durability verified.
- [x] **Idempotency works**: Operation ID and primary key constraints prevent duplicate transactions.
- [x] **LAN works**: Multi-device WebSocket event synchronization verified.
- [x] **Firewall documented**: Detailed firewall instructions provided in `FIREWALL_SETUP.md`.
- [x] **Autostart tested/documented**: Windows batch scripts for autostart setup and removal provided (`setup-windows-autostart.bat`, `remove-windows-autostart.bat`).
- [x] **Update tested**: Binary upgrade data preservation verified.
- [x] **Migration tested**: Schema migration executed successfully on initial boot and upgrades.
- [x] **Uninstall safety documented**: Portable release ensures APP_DATA_DIR remains intact if binaries are removed.
- [x] **No secrets**: Zero production secrets or API keys embedded in release artifacts.
- [x] **No development artifacts**: Source files, test suites, and git metadata excluded from release package.
- [x] **Final regression passed**: All test suites (`npm test`), linter checks (`npm run lint`), and builds (`npm run build`) passed successfully.

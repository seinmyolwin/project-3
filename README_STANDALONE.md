# Shwe Thiri Spa & KTV ERP — Standalone Local Shop Deployment

## Architecture
```
                         SHOP WI-FI ROUTER (No Internet Required)
                                    |
            +-----------------------+-----------------------+
            |                                               |
   PRIMARY SHOP HOST                               SECONDARY LAN CLIENTS
   (Windows PC / POS Station)                      (Cashier Tablet, Mobile, Laptop)
   - Runs ShweThiriERP.exe                         - Opens http://<HOST_IP>:3000
   - Authoritative ACID SQLite DB                  - Real-time WebSocket updates
   - Full Static SPA Frontend                      - Dexie Offline Fallback
   - Automated Local Backups
```

---

## 1. Quick Start on Windows Host Machine (Zero Prerequisites)

1. **Zero Software Prerequisites:** End users do **NOT** need to install Node.js or any external software to run the standalone executable.
2. **Developers / Admins:** Use standard `npm` commands (`npm run dev`, `npm run build`, `npm run test`, `npm run package`).
3. **Launch Options:**
   - **Option A (Direct Executable):** Double-click `ShweThiriERP.exe` (or `KaraokePS5CommerceHub.exe`).
   - **Option B (Launcher Script):** Double-click `start-shop-hub.bat` (automatically launches the browser).
4. The server starts immediately and opens `http://localhost:3000` in your default web browser.
5. **Connecting Secondary LAN Devices (Tablets / Phones):**
   - Note the host PC's local IP address printed in the console (e.g., `http://192.168.1.50:3000`).
   - Open that URL in any browser on devices connected to the shop's Wi-Fi network.
   - Pair devices via the POS pairing code screen.

---

## 2. Directory Structure & Complete Data Isolation

```
[Application Directory]
├── ShweThiriERP.exe           <-- Standalone Single Executable Application (Zero-Install)
├── start-shop-hub.bat         <-- Windows launcher with auto-browser launch
├── bin/                       <-- Bundled fallback runtime & WASM assets
│   ├── node.exe
│   └── sql-wasm.wasm
├── dist/                      <-- Static frontend bundle & server assets
│   ├── index.html
│   ├── assets/
│   ├── server.cjs
│   └── sql-wasm.wasm
├── FIREWALL_SETUP.md          <-- 1-step PowerShell command to allow shop LAN access
└── data/                      <-- MUTABLE PERSISTENT BUSINESS DATA (NEVER OVERWRITTEN)
    ├── karaoke_ps5_server_db.sqlite  <-- Primary ACID SQLite Database
    ├── backups/                       <-- Automated & manual point-in-time database backups
    ├── logs/                          <-- Audit trails & startup health logs
    └── config/                        <-- Shop-specific device pairing state
```

---

## 3. Safe Application Update Procedure

When upgrading to a new software release:
1. Stop the application (press `Ctrl + C` in the console window or close the launcher).
2. Replace `ShweThiriERP.exe`, `dist/`, and `bin/` with the new release files.
3. **DO NOT delete or touch the `data/` folder.**
4. Launch `ShweThiriERP.exe` or `start-shop-hub.bat`.
   - Database migrations run automatically and idempotently on startup.
   - All past orders, rooms, tables, financial transactions, and inventory remain 100% intact.

---

## 4. Disaster Recovery & Backup Safety

* **Automatic Point-in-Time Backups:** Database backups are stored automatically in `data/backups/`.
* **External USB Archival:** Simply copy the `data/` folder to an external USB flash drive or external hard drive at the end of the day.
* **Restore:** Placing any valid `.sqlite` backup into `data/karaoke_ps5_server_db.sqlite` restores the complete business state.

---

## 5. 100% Offline & Zero-Cloud Guarantee

* Operates with **zero internet connection**.
* Zero external APIs, zero third-party telemetry, zero cloud dependencies.
* All financial transactions and stock movements are written directly with ACID atomicity to the local disk.


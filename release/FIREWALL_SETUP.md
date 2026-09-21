# Windows Firewall Configuration Guide for Local Shop LAN

## Overview
**Karaoke & PS5 Commerce Hub** operates 100% offline within your shop's Local Area Network (LAN).
To allow secondary cashier tablets, manager phones, and front-desk devices on your Wi-Fi network to connect to the host computer, you must permit inbound traffic on port **3000** in Windows Defender Firewall.

---

## 1-Step Automated Command (Run as Administrator in PowerShell)

Open **PowerShell as Administrator** on the Windows host computer and run:

```powershell
New-NetFirewallRule -DisplayName "Karaoke PS5 Hub LAN Server (Port 3000)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
```

---

## Manual Setup via Windows Security UI

1. Open **Windows Security** or **Control Panel** -> **Windows Defender Firewall**.
2. Click **Advanced settings** on the left panel.
3. Select **Inbound Rules** -> click **New Rule...** on the right panel.
4. Rule Type: Select **Port** -> click **Next**.
5. Protocol and Ports:
   - Select **TCP**
   - Select **Specific local ports** and type `3000` -> click **Next**.
6. Action: Select **Allow the connection** -> click **Next**.
7. Profile: Check **Private** (recommended for shop Wi-Fi / LAN routers) -> click **Next**.
8. Name: Enter `Karaoke PS5 Hub Local LAN` -> click **Finish**.

---

## Security Boundary Notice
* The firewall rule ONLY opens TCP port 3000 for local private network subnet devices.
* Never expose this port to the public Internet or port-forward on your WAN router.
* All device connections still require device pairing, user login, and token authentication.

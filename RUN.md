# How to run the app

## Simulator and phone (Expo Go) together

Use one dev server for both:

1. Start once:
   ```bash
   npm start
   ```
2. **iOS Simulator:** In the terminal, press **`i`** to open the app in the simulator.
3. **Phone (Expo Go):** Put your phone on the **same Wi‑Fi** as your Mac and scan the QR code with Expo Go.

Same Metro server; simulator and phone both connect to it. If the simulator ever gets “network connection was lost”, try `npm run start:simulator` and press **`i`** (that mode is simulator-only).

---

## Simulator only (if phone isn’t needed)

```bash
npm run start:simulator
```
Then press **`i`**. Uses localhost so the simulator connects reliably.

---

## Phone only, not on same Wi‑Fi (tunnel)

```bash
npm run start:tunnel
```
Scan the tunnel QR code in Expo Go. Use when your phone can’t reach your Mac’s Wi‑Fi (e.g. different network). If you see “failed to start tunnel”, check https://status.ngrok.com/ or use `npm start` with the phone on the same Wi‑Fi.

---

**Summary**

| What you’re using              | Command              | Then |
|--------------------------------|----------------------|------|
| **Simulator + phone (same Wi‑Fi)** | `npm start`          | Press **i** for simulator, scan QR for phone |
| Simulator only                 | `npm run start:simulator` | Press **i** |
| Phone only (any network)       | `npm run start:tunnel`    | Scan QR in Expo Go |

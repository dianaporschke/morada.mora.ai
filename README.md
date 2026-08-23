# MORADA MORA AI

Diese Version verbindet den MORA-Chat mit der OpenAI Responses API über eine Vercel Serverless Function.

## Vercel einrichten

1. Dieses Projekt als Vercel-Projekt deployen.
2. In Vercel unter Project Settings → Environment Variables:
   - `OPENAI_API_KEY` = dein OpenAI API Key
   - optional `OPENAI_MODEL` = `gpt-5.6`
3. Neu deployen.
4. Danach die Vercel-URL in Safari öffnen und MORA testen.

Wichtig: Den API-Key niemals in `index.html` eintragen.

## Dateien

- `index.html` – MORADA Web-App
- `api/chat.js` – sicherer Server-Endpunkt für MORA
- `vercel.json` – Vercel-Konfiguration

Version 1 hat noch keinen Zugriff auf echte Kundendaten. MORA beantwortet allgemeine Fragen intelligent, erfindet aber keine Portal-Daten.

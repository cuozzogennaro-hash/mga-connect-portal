# MGA Connect — Piano di implementazione

Applicazione B2B per M.G.A. Alimentari Cuozzo S.r.l.: landing pubblica + portale ordini con 3 ruoli, stampa termica, promozioni, OCR scontrini, DDT PDF e contabilità.

## Stack e infrastruttura
- **Frontend**: TanStack Start + React + Tailwind (design elegante, food/ingrosso — palette caldi neutri + accent istituzionale, tipografia serif+sans).
- **Backend**: Lovable Cloud (Supabase) — Auth, Database, Storage, Server Functions.
- **AI/OCR**: Lovable AI Gateway (Gemini vision) per l'analisi scontrini.
- **PDF DDT**: generazione lato server (pdf-lib) — bolla intestata MGA.

## Fase 1 — Landing pubblica (/)
Hero, Chi siamo, Servizi B2B, Footer con dati societari.
CTA: "Accedi a MGA Connect" → `/auth`, "Diventa Cliente B2B" → `/registrazione`.

## Fase 2 — Auth, ruoli, seed admin
- Tabella `profiles` (id, ragione_sociale, partita_iva, referente, telefono, indirizzo_consegna, nome).
- Tabella `user_roles` con enum `app_role` ('cliente_b2b','operatore_preparazione','admin') + funzione `has_role` security definer.
- `/auth` login unificato con redirect per ruolo.
- `/registrazione` pubblica: crea SOLO `cliente_b2b` (ruolo assegnato server-side, non dal client).
- Seed admin: `admin@mgaalimentari.it` / `AdminPassword123!` creato via migration/edge on first boot.
- Layout `_authenticated` con gate; sotto-gate per ruolo (`/cliente`, `/operatore`, `/admin`).

## Fase 3 — Area Cliente B2B (`/cliente`)
- **Promozioni**: griglia (foto, titolo, descrizione, prezzo promo, validità).
- **Nuovo Ordine**: righe dinamiche (qta / descrizione / note) + data ritiro + note; INVIA → stato `nuovo`.
- **I miei Ordini**: storico con stato e dettaglio.

## Fase 4 — Area Operatore (`/operatore`)
- UI grande, tablet-first.
- Lista realtime ordini `nuovo` (Supabase Realtime).
- Pulsante "Carica Foto Scontrino": input `capture="environment"` → Storage `scontrini/` → stato `scontrinato`.

## Fase 5 — Area Admin (`/admin`)
Sidebar con:
- **Utenti**: form crea `operatore_preparazione`/`admin` (server fn con `supabaseAdmin.auth.admin.createUser` dopo verifica ruolo admin).
- **Promozioni**: CRUD con upload foto su Storage.
- **Ordini & OCR**: lista `scontrinati`; bottone "Analizza scontrino" → server fn Lovable AI (Gemini) che ritorna JSON `{ totale, iva, voci[] }` salvato su `ordini.ocr_data`.
- **Bolle DDT**: da ordine+OCR genera PDF (pdf-lib) intestato MGA, numerazione progressiva, salva in tabella `bolle` + Storage.
- **Contabilità cliente**: per P.IVA — storico bolle, totale dovuto, stato pagamento (in_attesa/pagato), toggle admin.

## Stampa termica automatica
Al passaggio ordine → `nuovo`, trigger DB `pg_net` chiama endpoint pubblico `/api/public/print-order` che formatta il ticket. **Nota**: la stampante termica fisica richiede un agent locale (bridge) sul PC della sala preparazione — il portale espone l'endpoint/ticket in formato ESC-POS o HTML stampabile; fornirò istruzioni per il collegamento (WebUSB o print server locale). Confermare se va bene un endpoint + pagina stampabile auto-print, oppure integrazione con servizio specifico.

## Dettagli tecnici (per chi legge il codice)
- Tabelle: `profiles`, `user_roles`, `promozioni`, `ordini`, `ordini_righe`, `bolle`, `bolle_righe`, `pagamenti`.
- RLS: cliente vede solo i propri ordini/bolle; operatore vede ordini `nuovo`/`scontrinato`; admin tutto (via `has_role`).
- GRANT espliciti su ogni tabella (authenticated + service_role).
- Storage buckets: `promozioni` (pubblico), `scontrini` (privato), `bolle` (privato).
- Server functions in `src/lib/*.functions.ts`; admin ops (crea utente, OCR, PDF) protette da `requireSupabaseAuth` + verifica ruolo admin prima di caricare `supabaseAdmin`.
- Realtime abilitato su `ordini`.

## Domande prima di partire
1. **Stampa termica**: modello stampante e come è collegata (USB al PC, rete Wi-Fi, stampante cloud tipo Star CloudPRNT)? Serve per scegliere il metodo di invio.
2. Preferenze cromatiche/branding oltre a "elegante e pulito"? Logo disponibile?

Se vuoi procedo con Fase 1+2 subito (landing + auth + ruoli + seed admin) e per la stampa termica per ora esporrò una pagina di stampa auto-print (compatibile con qualsiasi stampante termica associata come default sul dispositivo della sala).
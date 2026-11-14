# Fiammetta Codari — Portfolio

Sito statico (HTML/CSS/JS, nessuna build) per il portfolio di Fiammetta Codari.

- `index.html` — landing con galleria a scorrimento, categorie, chi sono, contatti
- `opere.html` — tutte le opere con filtri per **tema** e **tecnica** (`?tema=fantasy&tecnica=schizzo`)
- `atelier-lto4o48o/` — pannello di modifica (PIN + token GitHub), indirizzo non pubblicizzato
- `data/works.json`, `data/config.json` — contenuti e categorie
- `images/` — immagini delle opere

## Pannello admin

Aprire `/atelier-lto4o48o/`. Al primo accesso si crea un PIN. Dalla scheda **Collegamento GitHub** si incolla un
fine-grained token (Contents: read & write su questo repository), salvato solo nel browser.
«Pubblica» salva le modifiche con un commit su `main`, e il sito si aggiorna da solo.

## Pubblicazione

Funziona su qualsiasi hosting statico (Vercel, GitHub Pages, Netlify): nessuna configurazione di build,
la cartella radice è la root del sito.

## Anteprima in locale

```bash
python3 -m http.server 8000
```

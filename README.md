# Fiammetta Codari — Portfolio

Sito statico (HTML/CSS/JS) per il portfolio di Fiammetta Codari. A ogni pubblicazione Vercel esegue `node scripts/build.mjs`, che genera in `dist/` una pagina per ogni opera (`/opera/<id>/`), la sitemap con le immagini e l'elenco completo delle opere.

- `index.html` — landing con galleria a scorrimento, categorie, chi sono, contatti
- `opere.html` — tutte le opere con filtri per **tema** e **tecnica** (`?tema=fantasy&tecnica=schizzo`)
- `atelier-lto4o48o/` — pannello di modifica (PIN + token GitHub), indirizzo non pubblicizzato
- `privacy.html` — informativa privacy
- `scripts/build.mjs` — costruzione del sito (pagine opera, sitemap)
- `data/works.json`, `data/config.json` — contenuti e categorie
- `images/` — immagini delle opere

## Pannello admin

Aprire `/atelier-lto4o48o/`. Al primo accesso si crea un PIN. Dalla scheda **Collegamento GitHub** si incolla un
fine-grained token (Contents: read & write su questo repository), salvato solo nel browser.
«Pubblica» salva le modifiche con un commit su `main`, e il sito si aggiorna da solo.

## Pubblicazione

Su Vercel la configurazione è in `vercel.json` (comando di build e cartella `dist`). Il pannello pubblica tutte le modifiche in un solo commit, quindi un solo deploy per volta (il piano gratuito ha un limite giornaliero).

## Anteprima in locale

```bash
python3 -m http.server 8000
```

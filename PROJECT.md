# Memoria viva — riferimento tecnico per agenti

Documento di handoff per continuare lo sviluppo senza perdere contesto. Ultimo aggiornamento: giugno 2026.

---

## 1. Scopo del progetto

**memoria-viva** è una pagina web statica che mostra le lettere del titolo **«memoria viva»** (11 glifi SVG) con:

- caduta sequenziale all’apertura della pagina;
- fisica 2D (gravità, collisioni, impilamento libero);
- trascinamento mouse/touch dopo l’atterraggio;
- pulsante **Rigioca**;
- impostazioni centralizzate per designer (`memoria-config.js`).

Non c’è build system, framework frontend né backend: solo HTML + JS + CDN Matter.js.

---

## 2. Requisiti prodotto (decisioni utente)

| Aspetto | Scelta |
|--------|--------|
| Avvio animazione | Automatico all’apertura |
| Ordine caduta | Sequenza «memoria viva» (vedi `spawnOrder`) |
| Peso percepito | Leggero (rimbalzo moderato) |
| Posizione finale | Libera (fisica, non layout composito) |
| Interazione | Drag dopo il drop |
| Layout | Riquadro centrato (`#scene`), non full-screen |
| Configurazione | File dedicato, commenti in italiano |
| Replay | Pulsante `#replay-btn` |
| Mobile | Stesso comportamento del desktop |
| Accessibilità | `prefers-reduced-motion: reduce` → niente caduta, lettere già visibili nella zona centrale/bassa |
| Riferimenti visivi esterni | Nessuno vincolante |

---

## 3. Struttura repository

```
memoria-viva/
├── index.html              # Markup, stili inline, SVG lettere embedded
├── memoria-config.js       # UNICO file da modificare per tuning visivo/motion
├── memoria-physics.js      # Motore Matter.js + sync SVG (non toccare se non necessario)
├── Tavola disegno 12 figma.svg   # Export Figma di riferimento (non caricato a runtime)
├── PROJECT.md              # Questo documento
└── .gitattributes
```

**Runtime:** `index.html` carica in ordine (tutti `defer`):

1. `matter-js@0.20.0` (jsDelivr CDN)
2. `memoria-config.js` → espone `window.MEMORIA_CONFIG`
3. `memoria-physics.js` → IIFE che avvia tutto su `DOMContentLoaded`

---

## 4. Asset SVG e convenzione id

Ogni lettera è un `<path id="…">` dentro `#letters-svg` (`viewBox="0 0 845 600"`).

Gli **id devono corrispondere** a quelli in `spawnOrder`. Duplicati nella frase usano suffisso Figma:

| Lettera (ordine frase) | id path |
|------------------------|---------|
| m (memoria) | `m` |
| e | `e` |
| m | `m_2` |
| o | `o` |
| r | `r` |
| i (memoria) | `i` |
| a (memoria) | `a` |
| v | `v` |
| i (viva) | `i_2` |
| v | `v_2` |
| a (viva) | `a_2` |

**Workflow designer:** rinominare i layer/path in Figma, esportare SVG, aggiornare i path in `index.html` (o sostituire l’SVG inline) e allineare `spawnOrder` in config.

**Nota fill:** la root SVG ha `fill="none"`. Il fill delle lettere è impostato in JS (`path.setAttribute('fill', …)`) e in CSS (`.piece path`). Non affidarsi solo al CSS se si aggiungono path senza passare da `wrapPaths`.

---

## 5. Architettura runtime

```
┌─────────────────────────────────────────┐
│  #scene (overflow:hidden, aspect-ratio) │
│  ┌───────────────────────────────────┐  │
│  │  #letters-svg (viewBox 845×600)   │  │
│  │    <g class="piece" id="piece-m"> │  │
│  │      <path transform="translate(-cx,-cy)" />  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
         ▲ sync ogni frame (requestAnimationFrame)
         │
┌────────┴────────┐
│  Matter.js      │  corpi = Bodies.rectangle (bbox)
│  Engine+Runner  │  muri: pavimento + pareti L/R
│  MouseConstraint│  coordinate = unità viewBox
└─────────────────┘
```

### Pipeline init (`memoria-physics.js`)

1. `applyColors()` — CSS variables da config
2. `wrapPaths()` — per ogni id in `spawnOrder`: crea `<g class="piece">`, misura `getBBox()`, centra il path con `translate(-cx,-cy)`, `opacity: 0`
3. `createEngine()` + `createWalls()`
4. `setupMouse()` — coordinate mouse mappate con `svg.getScreenCTM().inverse()`
5. Dopo 2× `requestAnimationFrame`: `startSimulation()` → `scheduleDrops()` o `placeStill()`

### Sync visuale ↔ fisica

Dopo il wrapping, il **centro geometrico** del path è nell’origine del gruppo `<g>`.

Transform applicato al gruppo (unica fonte di verità):

```text
translate(body.position.x, body.position.y) rotate(deg)
```

**Non** aggiungere un secondo `translate(-cx, -cy)` sul gruppo: il path è già centrato. Questo errore ha causato in passato lettere ammassate in alto a sinistra.

### Corpi fisici

- Approssimazione: **rettangolo** = bounding box del path (`width`/`height` min 12px).
- Collisioni tra lettere e con i muri; nessun poligono concavo fedele al tracciato.
- Pavimento: `y = viewBox.height + 30` circa; pareti ai lati. **Nessun muro superiore** (evita blocchi in spawn).

### Spawn

- `spawnY`: `35–90` (dentro il riquadro visibile; `#scene` ha `overflow: hidden`)
- `spawnX`: margine 12% della larghezza viewBox
- Ritardo: `i * pausaTraLettere` ms per l’indice in `spawnOrder`
- Alla comparsa: `opacity: 1`, piccola velocità iniziale verso il basso

### Replay

`resetWorld()` rimuove i corpi, nasconde i pezzi (`opacity: 0`), cancella i timer; poi `startSimulation()` ripete la sequenza.

---

## 6. Configurazione (`window.MEMORIA_CONFIG`)

Definita in `memoria-config.js`. Campi principali:

| Chiave | Ruolo |
|--------|--------|
| `spawnOrder` | Array di id path; ordine di caduta |
| `colori.*` | Sfondo pagina, riquadro, bordo, fill lettere |
| `riquadro.larghezzaMassima` | CSS `max-width` di `#scene` |
| `riquadro.proporzione` | CSS `aspect-ratio` (es. `"845 / 600"`) |
| `movimento.gravita` | Asse Y Matter (default ~1.15) |
| `movimento.rimbalzo` | `restitution` (leggero ≈ 0.45–0.55) |
| `movimento.attrito` | `friction` |
| `movimento.pausaTraLettere` | ms tra un drop e il successivo |
| `movimento.rotazioneInizialeMax` | gradi casuali iniziali |
| `movimento.dispersioneOrizzontale` | in config ma **non usato** nel codice attuale di `spawnX` (solo margine 12%) — possibile estensione |
| `pulsanteRigioca.testo` | Label bottone |
| `rispettaPreferenzaMovimento` | Se true, legge `prefers-reduced-motion` |
| `viewBox.width/height` | Deve coincidere con `viewBox` dell’SVG (845×600) |

Per cambiare colori, tempi o ordine: **solo `memoria-config.js`**.

---

## 7. DOM e selettori stabili

| Elemento | id / classe | Uso |
|----------|-------------|-----|
| Contenitore scena | `#scene` | Mouse target, overflow clip |
| SVG | `#letters-svg` | viewBox, CTM per pointer |
| Lettera animata | `g.piece` | Creato a runtime; `data-letter-id` |
| Errore utente | `#status-msg` | Testo se Matter/config/path mancanti |
| Replay | `#replay-btn` | `click` → `replay()` |

---

## 8. Esecuzione e debug

### Come aprire

- **Consigliato:** Live Server (VS Code/Cursor) o qualsiasi static server locale.
- **Doppio clic su `index.html`:** può funzionare se il CDN Matter.js è raggiungibile; in caso di blocco script compare messaggio in `#status-msg`.

### Problemi già incontrati (non reintrodurre)

1. **Lettere in alto a sinistra / fuori schermo:** doppio offset nel `transform` del gruppo; spawn con `y` negativo + `overflow: hidden`.
2. **Niente visibile:** `visibility: hidden` senza reveal; `fill="none"` sulla root senza fill sui path; Matter.js non caricato.
3. **Python `http.server`:** non disponibile su tutte le macchine Windows dell’utente (exit 9009).

### Console

- `Path #id non trovato` → id SVG ≠ `spawnOrder`
- `MEMORIA_CONFIG non trovato` → ordine script o file mancante
- `Motore fisico non caricato` → CDN / rete / `file://`

---

## 9. Limitazioni note

- Collisioni rettangolari, non sulla forma reale della lettera.
- Nessun bundler: niente TypeScript, lint, test automatici.
- SVG duplicato: sorgente Figma in `Tavola disegno 12 figma.svg`, copia operativa inlined in `index.html` (vanno tenuti allineati manualmente).
- `dispersioneOrizzontale` in config non collegata al codice (documentare se si implementa).

---

## 10. Estensioni probabili (linee guida)

| Richiesta | Approccio suggerito |
|-----------|---------------------|
| Nuova lettera / frase | Aggiungere path + id; aggiornare `spawnOrder` e `viewBox` se cambia canvas |
| Collisioni più fedeli | Vertici da path → `Bodies.fromVertices` + `poly-decomp` (Matter) |
| Caduta dall’esterno alto | Aumentare `spawnY` negativo **solo** se si rimuove o alza il clip, oppure si anima l’ingresso in due fasi |
| Suono / haptic | Hook in `dropPiece` e `enddrag` |
| Integrazione in sito | Incapsulare `#scene` + script; evitare conflitti globali (`MEMORIA_CONFIG`, `Matter`) |
| Build pipeline | Opzionale: Vite per bundle; oggi non richiesto |

---

## 11. Stack tecnico

| Tecnologia | Versione / nota |
|------------|-----------------|
| HTML/CSS | Semantico, variabili CSS |
| JavaScript | ES5-style IIFE, no moduli |
| Matter.js | 0.20.0 via jsDelivr |
| SVG | 1.1, coordinate viewBox |

---

## 12. Checklist rapida per un agente

Prima di modificare:

- [ ] Gli id in `index.html` corrispondono a `spawnOrder`?
- [ ] `viewBox` SVG = `MEMORIA_CONFIG.viewBox`?
- [ ] Modifiche visive/timing solo in `memoria-config.js`?
- [ ] Dopo cambio transform, testare caduta + drag + Rigioca + reduced motion?
- [ ] Non reintrodurre `translate(-cx,-cy)` sul gruppo `.piece`?

Dopo export Figma:

- [ ] Path hanno id univoci (`m_2`, `i_2`, …)?
- [ ] Fill impostato (JS o attributo su path)?
- [ ] Verificare in browser con Live Server, non solo anteprima file.

---

## 13. Contatto con il contesto conversazione

Il committente è una **designer**: preferire spiegazioni su config e Figma, non su API Matter.js, salvo bug tecnici. Obiettivo estetico: lettere **leggere**, pile **casuali**, hero in **riquadro**, esperienza **identica su mobile**.

Per commit/PR: eseguire solo se richiesto esplicitamente dall’utente.

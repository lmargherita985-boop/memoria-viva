(function () {
  const cfg = window.MEMORIA_CONFIG;
  const scene = document.getElementById("scene");
  const svg = document.getElementById("letters-svg");
  const replayBtn = document.getElementById("replay-btn");
  const statusEl = document.getElementById("status-msg");

  function showError(msg) {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.hidden = false;
    }
    console.error(msg);
  }

  if (!cfg) {
    showError("Configurazione non trovata (memoria-config.js).");
    return;
  }

  if (typeof Matter === "undefined") {
    showError(
      "Motore fisico non caricato. Apri la pagina con Live Server o verifica la connessione."
    );
    return;
  }

  const {
    Engine,
    World,
    Bodies,
    Body,
    Runner,
    Mouse,
    MouseConstraint,
    Events,
  } = Matter;

  const VB = cfg.viewBox;
  const reducedMotion =
    cfg.rispettaPreferenzaMovimento !== false &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pieces = [];
  let engine;
  let runner;
  let mouseConstraint;
  let mouse;
  let spawnTimers = [];
  let rafId = null;
  let mouseReady = false;
  let simulationRunning = false;

  function applyColors() {
    document.documentElement.style.setProperty(
      "--page-bg",
      cfg.colori.sfondoPagina
    );
    document.documentElement.style.setProperty(
      "--frame-bg",
      cfg.colori.sfondoRiquadro
    );
    document.documentElement.style.setProperty(
      "--frame-border",
      cfg.colori.bordoRiquadro
    );
    document.documentElement.style.setProperty(
      "--letter-fill",
      cfg.colori.lettere
    );
    scene.style.maxWidth = cfg.riquadro.larghezzaMassima;
    scene.style.aspectRatio = cfg.riquadro.proporzione;
  }

  function clearSpawnTimers() {
    spawnTimers.forEach(clearTimeout);
    spawnTimers = [];
  }

  function svgPoint(clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }

  function setPieceVisible(piece, visible) {
    piece.g.setAttribute("opacity", visible ? "1" : "0");
    piece.g.style.pointerEvents = visible ? "auto" : "none";
  }

  function measurePiece(path) {
    const box = path.getBBox();
    const w = box.width || 1;
    const h = box.height || 1;
    return {
      cx: box.x + w / 2,
      cy: box.y + h / 2,
      width: Math.max(w, 12),
      height: Math.max(h, 12),
    };
  }

  function wrapPaths() {
    cfg.spawnOrder.forEach((id, index) => {
      const path = document.getElementById(id);
      if (!path) {
        console.warn(`Path #${id} non trovato.`);
        return;
      }

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.classList.add("piece");
      g.dataset.letterId = id;
      g.dataset.spawnIndex = String(index);
      path.parentNode.insertBefore(g, path);
      g.appendChild(path);
      path.removeAttribute("id");
      g.id = `piece-${id}`;

      path.setAttribute("fill", cfg.colori.lettere);

      const { cx, cy, width, height } = measurePiece(path);
      path.setAttribute("transform", `translate(${-cx}, ${-cy})`);
      setPieceVisible({ g }, false);

      pieces.push({
        g,
        path,
        id,
        width,
        height,
        body: null,
        spawned: false,
      });
    });

    if (pieces.length === 0) {
      showError("Nessuna lettera trovata. Controlla gli id nel SVG.");
    }
  }

  function createEngine() {
    engine = Engine.create({
      gravity: { x: 0, y: cfg.movimento.gravita },
    });
    runner = Runner.create();
  }

  function createWalls() {
    const t = 60;
    const w = VB.width;
    const h = VB.height;
    World.add(engine.world, [
      Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, { isStatic: true }),
      Bodies.rectangle(-t / 2, h / 2, t, h * 2, { isStatic: true }),
      Bodies.rectangle(w + t / 2, h / 2, t, h * 2, { isStatic: true }),
    ]);
  }

  function bodyOptions() {
    return {
      restitution: cfg.movimento.rimbalzo,
      friction: cfg.movimento.attrito,
      frictionAir: 0.02,
      density: 0.0012,
    };
  }

  function createBody(piece, x, y, angle) {
    const body = Bodies.rectangle(
      x,
      y,
      piece.width,
      piece.height,
      bodyOptions()
    );
    Body.setAngle(body, angle);
    piece.body = body;
    piece.spawned = true;
    World.add(engine.world, body);
    return body;
  }

  function syncPiece(piece) {
    const { g, body } = piece;
    if (!body) return;
    const deg = (body.angle * 180) / Math.PI;
    g.setAttribute(
      "transform",
      `translate(${body.position.x} ${body.position.y}) rotate(${deg})`
    );
  }

  function syncAll() {
    pieces.forEach(syncPiece);
    rafId = requestAnimationFrame(syncAll);
  }

  function spawnX() {
    const margin = VB.width * 0.12;
    return margin + Math.random() * (VB.width - margin * 2);
  }

  /** Partenza visibile nella parte alta del riquadro (non fuori dallo schermo) */
  function spawnY() {
    return 35 + Math.random() * 55;
  }

  function randomAngle() {
    const max = cfg.movimento.rotazioneInizialeMax ?? 18;
    return ((Math.random() * 2 - 1) * max * Math.PI) / 180;
  }

  function dropPiece(piece) {
    if (piece.body) {
      World.remove(engine.world, piece.body);
    }
    const x = spawnX();
    const y = spawnY();
    createBody(piece, x, y, randomAngle());
    setPieceVisible(piece, true);
    Body.setVelocity(piece.body, {
      x: (Math.random() - 0.5) * 1.5,
      y: 2,
    });
    syncPiece(piece);
  }

  function scheduleDrops() {
    clearSpawnTimers();
    const delay = cfg.movimento.pausaTraLettere ?? 280;
    pieces.forEach((piece, i) => {
      spawnTimers.push(setTimeout(() => dropPiece(piece), i * delay));
    });
  }

  function placeStill() {
    engine.gravity.y = 0;
    pieces.forEach((piece) => {
      const jitter = () => (Math.random() - 0.5) * 24;
      const x = VB.width * 0.15 + Math.random() * VB.width * 0.7 + jitter();
      const y = VB.height * 0.35 + Math.random() * VB.height * 0.45 + jitter();
      createBody(
        piece,
        x,
        y,
        ((Math.random() - 0.5) * 6 * Math.PI) / 180
      );
      setPieceVisible(piece, true);
      Body.setVelocity(piece.body, { x: 0, y: 0 });
      Body.setAngularVelocity(piece.body, 0);
      syncPiece(piece);
    });
  }

  function pointerToMouse(e) {
    const p = svgPoint(e.clientX, e.clientY);
    mouse.position.x = p.x;
    mouse.position.y = p.y;
  }

  function setupMouse() {
    if (mouseReady) return;
    mouse = Mouse.create(scene);
    mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.25,
        render: { visible: false },
      },
    });
    World.add(engine.world, mouseConstraint);

    scene.addEventListener("mousemove", pointerToMouse);
    scene.addEventListener("mousedown", pointerToMouse);
    scene.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches[0]) pointerToMouse(e.touches[0]);
      },
      { passive: true }
    );
    scene.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches[0]) pointerToMouse(e.touches[0]);
      },
      { passive: true }
    );

    Events.on(mouseConstraint, "startdrag", () => {
      scene.classList.add("is-dragging");
    });
    Events.on(mouseConstraint, "enddrag", () => {
      scene.classList.remove("is-dragging");
    });
    mouseReady = true;
  }

  function resetWorld() {
    clearSpawnTimers();
    engine.gravity.y = reducedMotion ? 0 : cfg.movimento.gravita;
    pieces.forEach((p) => {
      if (p.body) World.remove(engine.world, p.body);
      p.body = null;
      p.spawned = false;
      setPieceVisible(p, false);
      p.g.removeAttribute("transform");
    });
  }

  function startSimulation() {
    if (pieces.length === 0) return;

    if (reducedMotion) {
      placeStill();
    } else {
      scheduleDrops();
    }

    if (!simulationRunning) {
      Runner.run(runner, engine);
      simulationRunning = true;
    }
    if (!rafId) syncAll();

    if (statusEl) statusEl.hidden = true;
  }

  function replay() {
    resetWorld();
    startSimulation();
  }

  function init() {
    if (!scene || !svg || !replayBtn) {
      showError("Elementi pagina mancanti.");
      return;
    }

    applyColors();
    wrapPaths();
    if (pieces.length === 0) return;

    createEngine();
    createWalls();
    setupMouse();

    requestAnimationFrame(() => {
      requestAnimationFrame(startSimulation);
    });

    replayBtn.textContent = cfg.pulsanteRigioca?.testo ?? "Rigioca";
    replayBtn.addEventListener("click", replay);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

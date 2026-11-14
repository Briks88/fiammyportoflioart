/* Sito pubblico: legge data/config.json e data/works.json */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ICON = {
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  };

  let cfg, works;
  const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const fmtDate = (w) => [w.day, w.month ? MONTHS[w.month - 1] : "", w.year].filter(Boolean).join(" ");
  const isoDate = (w) => [w.year, w.month && String(w.month).padStart(2, "0"), w.month && w.day && String(w.day).padStart(2, "0")].filter(Boolean).join("-");
  const label = (list, id) => (list.find((x) => x.id === id) || {}).label || id;

  async function load() {
    const bust = "?v=" + Math.floor(Date.now() / 60000);
    const [c, w] = await Promise.all([
      fetch("data/config.json" + bust).then((r) => r.json()),
      fetch("data/works.json" + bust).then((r) => r.json()),
    ]);
    cfg = c; works = w.works || [];
  }

  function chrome(page) {
    document.title = page === "opere" ? "Opere — " + cfg.siteTitle : cfg.siteTitle + (cfg.artist ? " — " + cfg.artist : "");
    const home = page === "home";
    const link = (hash, txt) => `<a href="${home ? "" : "index.html"}#${hash}">${txt}</a>`;
    $("#header").innerHTML = `
      <div class="wrap">
        <a class="brand" href="index.html"><img src="images/logo.svg" alt="" width="34" height="34"><span>${esc(cfg.siteTitle)}</span></a>
        <button class="menu-btn" aria-label="Menu" aria-expanded="false">${ICON.menu}</button>
        <nav class="nav" aria-label="Principale">
          <a href="index.html" ${home ? 'aria-current="page"' : ""}>Home</a>
          <a href="opere.html" ${page === "opere" ? 'aria-current="page"' : ""}>Opere</a>
          ${link("chi-sono", "Chi sono")}
          ${link("contatti", "Contatti")}
        </nav>
      </div>`;
    const btn = $(".menu-btn"), nav = $(".nav");
    btn.onclick = () => { const o = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", o); };
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) nav.classList.remove("open"); });
    $("#footer").innerHTML = `<div class="wrap"><span>© ${new Date().getFullYear()} ${esc(cfg.artist || cfg.siteTitle)}. Tutti i diritti riservati.</span><span>Le opere non possono essere riprodotte senza autorizzazione. Questo sito raccoglie statistiche di visita anonime.</span></div>`;
  }

  /* ---------- Lightbox ---------- */
  let lbList = [], lbIdx = 0, lbEl;
  function ensureLb() {
    if (lbEl) return;
    lbEl = document.createElement("div");
    lbEl.className = "lb"; lbEl.setAttribute("role", "dialog"); lbEl.setAttribute("aria-modal", "true");
    lbEl.innerHTML = `<button class="x" aria-label="Chiudi">${ICON.close}</button><button class="p" aria-label="Precedente">${ICON.left}</button><button class="n" aria-label="Successiva">${ICON.right}</button><img alt=""><div class="lb-cap"></div>`;
    document.body.appendChild(lbEl);
    $(".x", lbEl).onclick = closeLb;
    $(".p", lbEl).onclick = () => stepLb(-1);
    $(".n", lbEl).onclick = () => stepLb(1);
    lbEl.addEventListener("click", (e) => { if (e.target === lbEl) closeLb(); });
    document.addEventListener("keydown", (e) => {
      if (!lbEl.classList.contains("open")) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") stepLb(-1);
      if (e.key === "ArrowRight") stepLb(1);
    });
    let sx = 0;
    lbEl.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lbEl.addEventListener("touchend", (e) => { const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) stepLb(d < 0 ? 1 : -1); });
  }
  function showLb() {
    const w = lbList[lbIdx];
    const img = $("img", lbEl); img.src = w.image; img.alt = w.title;
    $(".lb-cap", lbEl).innerHTML = `<b>${esc(w.title)}</b><small>${esc(label(cfg.tecniche, w.tecnica))}${w.year ? ` · <time datetime="${esc(isoDate(w))}">${esc(fmtDate(w))}</time>` : ""}</small>${w.description ? `<p>${esc(w.description)}</p>` : ""}`;
  }
  function openLb(list, i) { ensureLb(); lbList = list; lbIdx = i; showLb(); lbEl.classList.add("open"); document.body.style.overflow = "hidden"; $(".x", lbEl).focus(); }
  function stepLb(d) { lbIdx = (lbIdx + d + lbList.length) % lbList.length; showLb(); }
  function closeLb() { lbEl.classList.remove("open"); document.body.style.overflow = ""; }

  /* ---------- Home ---------- */
  const shuffle = (list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- Carosello della home ----------
     Computer: scorrimento continuo e lento (si ferma col mouse sopra; le frecce spostano di un'opera).
     Telefono / "riduci movimento": scorrimento a scatti con swipe, come prima. */
  function initCarousel(feat) {
    const carousel = document.querySelector(".carousel"), track = $("#track"), dots = $("#dots");
    const mq = matchMedia("(min-width: 721px) and (hover: hover) and (pointer: fine)"), reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const slide = (w, i, eager, clone) => `<button class="slide"${clone ? ' tabindex="-1" aria-hidden="true"' : ""} data-i="${i}" aria-label="Apri ${esc(w.title)}"><img src="${esc(w.image)}" alt="${clone ? "" : esc(w.title)}"${eager ? "" : ' loading="lazy"'} decoding="async" draggable="false"><span class="cap">${esc(w.title)}</span></button>`;
    track.addEventListener("click", (e) => { const b = e.target.closest(".slide"); if (b) openLb(feat, +b.dataset.i); });

    function marquee() {
      const ac = new AbortController(), sig = { signal: ac.signal };
      carousel.classList.add("is-marquee");
      track.scrollLeft = 0; dots.innerHTML = "";
      track.innerHTML = '<div class="rail">' + feat.map((w, i) => slide(w, i, true, false)).join("") + "</div>";
      const rail = track.firstElementChild, n = feat.length, first = rail.children[0];
      const addSet = () => { rail.insertAdjacentHTML("beforeend", feat.map((w, i) => slide(w, i, true, true)).join("")); sets++; };
      let sets = 1; addSet();
      const speed = Math.max(5, Number(cfg.carouselSpeed) || 30); // pixel al secondo
      let x = 0, paused = false, tween = null, last = 0, raf = 0, visible = true;
      const setW = () => (rail.children[n] ? rail.children[n].offsetLeft - first.offsetLeft : 0); // larghezza di un giro completo
      const frame = (t) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.1, (t - (last || t)) / 1000); last = t;
        const w = setW(); if (!w) return;
        if ((sets - 1) * w < track.clientWidth + 40 && sets < 8) addSet();
        if (tween) {
          const k = Math.min(1, (t - tween.t0) / tween.d), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          x = tween.from + (tween.to - tween.from) * e; if (k >= 1) tween = null;
        } else if (!paused && visible && !document.hidden) x += speed * dt;
        x = ((x % w) + w) % w;
        rail.style.transform = `translate3d(${-x}px,0,0)`;
      };
      const nudge = (dir) => { const w = setW(); if (!w) return; const step = Math.min(w / n, track.clientWidth * 0.6); tween = { from: x, to: x + dir * step, t0: performance.now(), d: 650 }; };
      $(".car-btn.prev").onclick = () => nudge(-1);
      $(".car-btn.next").onclick = () => nudge(1);
      ["mouseenter", "focusin"].forEach((ev) => carousel.addEventListener(ev, () => (paused = true), sig));
      ["mouseleave", "focusout"].forEach((ev) => carousel.addEventListener(ev, () => (paused = false), sig));
      const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; }); io.observe(carousel);
      raf = requestAnimationFrame(frame);
      return () => { cancelAnimationFrame(raf); ac.abort(); io.disconnect(); carousel.classList.remove("is-marquee"); track.innerHTML = ""; };
    }

    function snap() {
      const ac = new AbortController(), sig = { signal: ac.signal };
      track.scrollLeft = 0;
      track.innerHTML = feat.map((w, i) => slide(w, i, i <= 1, false)).join("");
      const slides = [...track.children];
      dots.innerHTML = slides.map((_, i) => `<button aria-label="Vai all'opera ${i + 1}"></button>`).join("");
      let cur = 0, timer, paused = false;
      const goTo = (i) => {
        cur = (i + slides.length) % slides.length;
        const s = slides[cur];
        track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.clientWidth) / 2, behavior: "smooth" });
      };
      const mark = () => [...dots.children].forEach((d, i) => d.setAttribute("aria-current", i === cur));
      track.addEventListener("scroll", () => {
        const mid = track.scrollLeft + track.clientWidth / 2;
        let best = 0, bd = 1e9;
        slides.forEach((s, i) => { const d = Math.abs(s.offsetLeft + s.clientWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
        if (best !== cur) cur = best; mark();
      }, { passive: true, ...sig });
      dots.onclick = (e) => { const i = [...dots.children].indexOf(e.target.closest("button")); if (i >= 0) goTo(i); };
      $(".car-btn.prev").onclick = () => goTo(cur - 1);
      $(".car-btn.next").onclick = () => goTo(cur + 1);
      timer = setInterval(() => { if (!reduce.matches && !paused && document.visibilityState === "visible") goTo(cur + 1); }, 4200);
      ["mouseenter", "touchstart", "focusin"].forEach((ev) => track.addEventListener(ev, () => (paused = true), { passive: true, ...sig }));
      ["mouseleave", "touchend", "focusout"].forEach((ev) => track.addEventListener(ev, () => setTimeout(() => (paused = false), 1500), { passive: true, ...sig }));
      mark();
      return () => { clearInterval(timer); ac.abort(); track.innerHTML = ""; };
    }

    let stop = () => {};
    const setup = () => { stop(); stop = mq.matches && !reduce.matches && feat.length > 1 ? marquee() : snap(); };
    mq.addEventListener("change", setup); reduce.addEventListener("change", setup);
    setup();
  }

  function home() {
    $("#hero-title").textContent = cfg.siteTitle;
    if (cfg.artist) $("#hero-artist").textContent = cfg.artist;
    $("#hero-tagline").textContent = cfg.tagline;
    // le opere scelte nel pannello compaiono in ordine casuale a ogni caricamento della pagina
    const feat = shuffle(works.filter((w) => w.featured));
    if (!feat.length) { document.querySelector(".carousel").hidden = true; return homeSections(); }
    initCarousel(feat);
    homeSections();
  }

  function homeSections() {
    const count = (key, id) => works.filter((w) => (key === "temi" ? (w.temi || []).includes(id) : w.tecnica === id)).length;
    const tiles = (list, key, param) => list.map((c) => `<a class="tile" href="opere.html?${param}=${encodeURIComponent(c.id)}"><span class="t-name">${esc(c.label)}</span><span class="t-count">${count(key, c.id) === 1 ? "1 opera" : count(key, c.id) + " opere"}</span></a>`).join("");
    $("#tiles-temi").innerHTML = tiles(cfg.temi, "temi", "tema");
    $("#tiles-tecniche").innerHTML = tiles(cfg.tecniche, "tecnica", "tecnica");

    $("#bio").innerHTML = String(cfg.bio || "").split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
    const ct = [];
    if (cfg.instagram) ct.push(`<a class="btn solid" href="${esc(cfg.instagram)}" target="_blank" rel="noopener">${ICON.ig} Instagram</a>`);
    if (cfg.email) ct.push(`<a class="btn" href="mailto:${esc(cfg.email)}">${ICON.mail} Scrivimi</a>`);
    $("#contact-row").innerHTML = ct.join("");
  }

  /* ---------- Opere ---------- */
  function opere() {
    const params = new URLSearchParams(location.search);
    const state = { tema: params.get("tema") || "", tecnica: params.get("tecnica") || "" };
    const chips = (list, key) => `<button class="chip" data-k="${key}" data-v="" aria-pressed="false">Tutti</button>` + list.map((c) => `<button class="chip" data-k="${key}" data-v="${esc(c.id)}" aria-pressed="false">${esc(c.label)}</button>`).join("");
    $("#f-temi").innerHTML = `<span class="lbl">Tema</span>` + chips(cfg.temi, "tema");
    $("#f-tecniche").innerHTML = `<span class="lbl">Tecnica</span>` + chips(cfg.tecniche, "tecnica");
    let shown = [];
    function render() {
      shown = works.filter((w) => (!state.tema || (w.temi || []).includes(state.tema)) && (!state.tecnica || w.tecnica === state.tecnica));
      document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", (state[c.dataset.k] || "") === c.dataset.v));
      $("#count").textContent = shown.length === 1 ? "1 opera" : shown.length + " opere";
      $("#grid").innerHTML = shown.length ? shown.map((w, i) => `<button class="card" data-i="${i}" aria-label="Apri ${esc(w.title)}"><div class="img"><img src="${esc(w.image)}" alt="${esc(w.title)}" loading="lazy"></div><div class="meta"><b>${esc(w.title)}</b><span>${esc(label(cfg.tecniche, w.tecnica))}${w.year ? " · " + esc(w.year) : ""}</span></div></button>`).join("") : `<p class="empty">${works.length ? "Nessuna opera in questa combinazione di filtri." : "Le prime opere arriveranno presto."}</p>`;
      const q = new URLSearchParams(); if (state.tema) q.set("tema", state.tema); if (state.tecnica) q.set("tecnica", state.tecnica);
      history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
      const t = state.tema ? label(cfg.temi, state.tema) : "", k = state.tecnica ? label(cfg.tecniche, state.tecnica) : "";
      $("#page-title").textContent = [t, k].filter(Boolean).join(" · ") || "Tutte le opere";
    }
    if (works.length) {
      const base = (cfg.siteUrl || location.origin).replace(/\/$/, "");
      const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Opere — " + cfg.siteTitle, url: base + "/opere.html",
        mainEntity: { "@type": "ItemList", itemListElement: works.map((w, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "VisualArtwork", name: w.title,
          image: base + "/" + String(w.image).replace(/^\//, ""), ...(w.year ? { dateCreated: isoDate(w) } : {}), artMedium: label(cfg.tecniche, w.tecnica),
          ...(w.description ? { description: w.description } : {}), creator: { "@type": "Person", name: cfg.artist || "Fiammetta Codari" } } })) } };
      const el = document.createElement("script"); el.type = "application/ld+json"; el.textContent = JSON.stringify(ld); document.head.appendChild(el);
    }
    document.querySelector(".filters").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; state[c.dataset.k] = c.dataset.v; render(); });
    $("#grid").addEventListener("click", (e) => { const b = e.target.closest(".card"); if (b) openLb(shown, +b.dataset.i); });
    render();
  }

  function reveal() {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.1 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  const page = document.body.dataset.page;
  load().then(() => { chrome(page); page === "home" ? home() : opere(); reveal(); })
    .catch((err) => { console.error(err); document.body.insertAdjacentHTML("afterbegin", '<p style="padding:24px">Impossibile caricare i contenuti. Se apri il file direttamente dal computer, usa un server locale.</p>'); });
})();

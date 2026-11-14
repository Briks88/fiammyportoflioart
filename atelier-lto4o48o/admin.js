/* Pannello di modifica: lavora su data/*.json e images/ del repository GitHub.
   Il PIN protegge l'interfaccia; per PUBBLICARE serve il token GitHub, salvato solo in questo browser. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: (k) => { try { localStorage.removeItem(k); } catch {} },
  };
  const sess = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
  };
  const showFatal = (e) => {
    console.error(e);
    const box = document.createElement("pre");
    box.style.cssText = "white-space:pre-wrap;padding:16px;margin:16px;border:1px solid #9a2f27;color:#9a2f27;background:#fffdf8";
    box.textContent = "Errore nel pannello: " + (e && e.message || e) + "\n\nBrowser: " + navigator.userAgent;
    document.body.prepend(box);
  };
  window.addEventListener("error", (ev) => showFatal(ev.error || ev.message));
  window.addEventListener("unhandledrejection", (ev) => showFatal(ev.reason));
  const sha256 = async (s) => {
    if (!(window.crypto && crypto.subtle)) throw new Error("Questo browser non supporta la cifratura necessaria (serve una connessione HTTPS e un browser aggiornato).");
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  const pinHash = (pin) => sha256("fcodari-portfolio:" + pin);

  let cfg, data, dirty = false;
  const pendingImages = {}; // path -> base64 (senza prefisso)
  const removedImages = new Set();
  let token = store.get("fc_gh_token") || "";

  function toast(msg, bad) {
    const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (bad ? " bad" : "");
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), bad ? 6000 : 3200);
  }
  function setDirty(v = true) { dirty = v; document.body.classList.toggle("is-dirty", v); $("#dirty").hidden = !v; $("#publish").disabled = !v; }
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- GitHub API ---------- */
  const b64utf8 = (s) => btoa(unescape(encodeURIComponent(s)));
  const fromB64utf8 = (b) => decodeURIComponent(escape(atob(b.replace(/\n/g, ""))));
  async function gh(path, opts = {}) {
    const { owner, repo, branch } = cfg.github;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}` + (opts.method && opts.method !== "GET" ? "" : `?ref=${branch}&t=${Date.now()}`);
    const r = await fetch(url, {
      ...opts,
      headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "Content-Type": "application/json" },
    });
    if (r.status === 404 && (!opts.method || opts.method === "GET")) return null;
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const hint = r.status === 401 || r.status === 403 ? " Controlla il token GitHub (scheda «Collegamento GitHub»)." : "";
      throw new Error((j.message || "Errore " + r.status) + hint);
    }
    return r.json();
  }
  async function putFile(path, contentB64, message) {
    const cur = await gh(path);
    return gh(path, { method: "PUT", body: JSON.stringify({ message, content: contentB64, branch: cfg.github.branch, ...(cur ? { sha: cur.sha } : {}) }) });
  }
  async function delFile(path, message) {
    const cur = await gh(path);
    if (cur) await gh(path, { method: "DELETE", body: JSON.stringify({ message, sha: cur.sha, branch: cfg.github.branch }) });
  }

  /* ---------- Caricamento ---------- */
  async function loadLocal() {
    const bust = "?t=" + Date.now();
    cfg = await fetch("../data/config.json" + bust).then((r) => r.json());
    data = await fetch("../data/works.json" + bust).then((r) => r.json());
  }
  async function loadRemote() {
    const c = await gh("data/config.json"), w = await gh("data/works.json");
    if (c && w) { cfg = JSON.parse(fromB64utf8(c.content)); data = JSON.parse(fromB64utf8(w.content)); }
  }

  /* ---------- Gate PIN ---------- */
  async function gate() {
    await loadLocal();
    const stored = cfg.pinHash || store.get("fc_pin_hash") || "";
    if (sess.get("fc_unlocked") === "1" && stored) return start();
    const g = $("#gate"); g.hidden = false; $("#boot").hidden = true;
    const first = !stored;
    $("#gate-title").textContent = first ? "Crea il tuo PIN" : "Area riservata";
    $("#gate-msg").textContent = first ? "Scegli un PIN di almeno 4 cifre per accedere al pannello." : "Inserisci il PIN per modificare le opere.";
    $("#pin2").hidden = !first; $("#pin2").required = first;
    $("#gate-form").onsubmit = async (e) => {
      e.preventDefault();
      const pin = $("#pin").value, h = await pinHash(pin);
      if (first) {
        if (pin !== $("#pin2").value) { $("#gate-err").textContent = "I due PIN non coincidono."; return; }
        cfg.pinHash = h; store.set("fc_pin_hash", h); sess.set("fc_unlocked", "1");
        g.hidden = true; start(true);
      } else if (h === stored) {
        sess.set("fc_unlocked", "1"); g.hidden = true; start();
      } else { $("#gate-err").textContent = "PIN errato."; $("#pin").value = ""; }
    };
  }

  async function start(needsSave) {
    if (token) { try { await loadRemote(); if (needsSave) cfg.pinHash = store.get("fc_pin_hash"); } catch (e) { toast("Dati da GitHub non letti: " + e.message, true); } }
    $("#app").hidden = false; $("#boot").hidden = true;
    renderAll(); setDirty(!!needsSave);
  }

  /* ---------- Tab ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest(".tabs button"); if (!t) return;
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b === t));
    ["works", "cats", "site", "git"].forEach((k) => ($("#tab-" + k).hidden = k !== t.dataset.tab));
  });
  function renderAll() { renderWorks(); renderCats(); renderSite(); renderGit(); }

  /* ---------- Opere ---------- */
  const lab = (list, id) => (list.find((x) => x.id === id) || {}).label || id;
  function imgSrc(p) { return pendingImages[p] ? "data:image/jpeg;base64," + pendingImages[p] : "../" + p; }
  function renderWorks() {
    const el = $("#tab-works");
    el.innerHTML = `<div class="bar"><h2>Opere (${data.works.length})</h2><button class="btn solid" id="w-new">+ Nuova opera</button></div>
      <div class="wlist">${data.works.map((w) => `<div class="wrow" data-id="${esc(w.id)}">
        <img src="${esc(imgSrc(w.image))}" alt="">
        <div><b>${esc(w.title)} ${w.featured ? '<span class="star" title="In galleria in home">★</span>' : ""}</b>
          <small>${esc(lab(cfg.tecniche, w.tecnica))}${w.year ? " · " + esc(w.year) : ""}</small><br>
          ${(w.temi || []).map((t) => `<span class="tag">${esc(lab(cfg.temi, t))}</span>`).join("")}</div>
        <div class="acts"><button class="btn small" data-a="edit">Modifica</button><button class="btn small danger" data-a="del">Elimina</button></div><span class="chev" aria-hidden="true">›</span></div>`).join("") || '<p class="help">Nessuna opera. Aggiungine una!</p>'}</div>`;
    $("#w-new").onclick = () => workDialog();
    el.onclick = (e) => {
      const row = e.target.closest(".wrow"); if (!row) return;
      const w = data.works.find((x) => x.id === row.dataset.id), b = e.target.closest("button[data-a]");
      if (b && b.dataset.a === "del") removeWork(w); else workDialog(w);
    };
  }
  function removeWork(w) {
    if (!confirm(`Eliminare «${w.title}»? L'opera sparirà dal sito dopo la pubblicazione.`)) return false;
    data.works = data.works.filter((x) => x.id !== w.id);
    if (!data.works.some((x) => x.image === w.image)) { delete pendingImages[w.image]; removedImages.add(w.image); }
    setDirty(); renderWorks(); renderCats(); return true;
  }

  async function resize(file, max = 1800) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86).split(",")[1];
  }

  function workDialog(w) {
    const isNew = !w, cur = w || { title: "", year: "", tecnica: cfg.tecniche[0]?.id || "", temi: [], description: "", featured: true, image: "" };
    let newImg = null; // {path, b64}
    const d = $("#dlg");
    d.innerHTML = `<form class="dlg-in" method="dialog">
      <div class="dlg-head"><h3>${isNew ? "Nuova opera" : "Modifica opera"}</h3><button type="button" class="dlg-x" id="d-x" aria-label="Chiudi">&times;</button></div>
      <div class="dlg-body">
        <div class="f"><span class="fl">Immagine ${isNew ? "*" : ""}</span>
          <img class="preview" id="d-prev" alt="" ${cur.image ? `src="${esc(imgSrc(cur.image))}"` : "hidden"}>
          <label class="btn small filebtn" for="d-file">${isNew ? "Scegli o scatta una foto" : "Cambia immagine"}</label>
          <input type="file" id="d-file" accept="image/*" class="sr"></div>
        <label class="f">Titolo *<input id="d-title" value="${esc(cur.title)}" required></label>
        <div class="two">
          <label class="f">Anno<input id="d-year" value="${esc(cur.year)}" inputmode="numeric" placeholder="es. 2024"></label>
          <label class="f">Tecnica<select id="d-tec">${cfg.tecniche.map((t) => `<option value="${esc(t.id)}" ${t.id === cur.tecnica ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select></label>
        </div>
        <div class="f"><span class="fl">Temi</span><div class="checks">${cfg.temi.map((t) => `<label><input type="checkbox" value="${esc(t.id)}" ${(cur.temi || []).includes(t.id) ? "checked" : ""}>${esc(t.label)}</label>`).join("")}</div></div>
        <label class="f">Descrizione<textarea id="d-desc">${esc(cur.description)}</textarea></label>
        <label class="switch"><input type="checkbox" id="d-feat" ${cur.featured ? "checked" : ""}> Mostra nella galleria in home</label>
      </div>
      <div class="dlg-foot">${isNew ? "" : '<button class="btn danger" type="button" id="d-del">Elimina</button><span class="sp"></span>'}<button class="btn" type="button" id="d-cancel">Annulla</button><button class="btn solid" type="submit" id="d-ok">Salva</button></div></form>`;
    d.showModal();
    $("#d-cancel").onclick = () => d.close(); $("#d-x").onclick = () => d.close();
    if (!isNew) $("#d-del").onclick = () => { if (removeWork(cur)) d.close(); };
    $("#d-file").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const b64 = await resize(f);
        newImg = { b64 };
        const p = $("#d-prev"); p.src = "data:image/jpeg;base64," + b64; p.hidden = false;
        if (!$("#d-title").value) $("#d-title").value = f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      } catch { toast("Immagine non leggibile.", true); }
    };
    $("#d-ok").onclick = (e) => {
      const title = $("#d-title").value.trim();
      if (!title) return;
      if (isNew && !newImg) { e.preventDefault(); toast("Seleziona un'immagine.", true); return; }
      e.preventDefault();
      const rec = cur;
      rec.title = title; rec.year = $("#d-year").value.trim(); rec.tecnica = $("#d-tec").value;
      rec.temi = [...d.querySelectorAll(".dlg-body .checks input[value]")].filter((c) => c.checked).map((c) => c.value);
      rec.description = $("#d-desc").value.trim(); rec.featured = $("#d-feat").checked;
      if (isNew) { let id = slug(title), n = 2; while (data.works.some((x) => x.id === id)) id = slug(title) + "-" + n++; rec.id = id; }
      if (newImg) {
        if (!isNew && rec.image && !data.works.some((x) => x !== rec && x.image === rec.image)) { delete pendingImages[rec.image]; removedImages.add(rec.image); }
        rec.image = `images/${rec.id}-${Date.now().toString(36)}.jpg`; pendingImages[rec.image] = newImg.b64;
      }
      if (isNew) data.works.unshift(rec);
      setDirty(); d.close(); renderWorks(); renderCats();
    };
  }

  /* ---------- Categorie ---------- */
  function renderCats() {
    const group = (key, title, list) => `<div class="panel" data-key="${key}"><h3>${title}</h3>
      ${list.map((c, i) => `<div class="crow"><input value="${esc(c.label)}" data-i="${i}" aria-label="Nome categoria"><button class="btn small danger" data-del="${i}">Elimina</button></div>`).join("")}
      <div class="cadd"><input placeholder="Nuova categoria…" data-new><button class="btn small" data-add>Aggiungi</button></div></div>`;
    const el = $("#tab-cats");
    el.innerHTML = `<div class="bar"><h2>Categorie</h2></div><p class="help">I temi sono multipli (un'opera può essere sia Fantasy che Animali); la tecnica è una sola per opera. Rinominare una categoria aggiorna subito tutte le opere.</p>
      ${group("temi", "Temi", cfg.temi)}${group("tecniche", "Tecniche", cfg.tecniche)}`;
    el.querySelectorAll(".panel").forEach((p) => {
      const key = p.dataset.key, list = cfg[key], wkey = key === "temi" ? "temi" : "tecnica";
      p.querySelectorAll("input[data-i]").forEach((inp) => (inp.onchange = () => { const v = inp.value.trim(); if (v) { list[+inp.dataset.i].label = v; setDirty(); } else inp.value = list[+inp.dataset.i].label; }));
      p.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => {
        const c = list[+b.dataset.del];
        const used = data.works.filter((w) => (wkey === "temi" ? (w.temi || []).includes(c.id) : w.tecnica === c.id));
        if (wkey === "tecnica" && used.length) return toast(`«${c.label}» è usata da ${used.length} opere: cambia prima la loro tecnica.`, true);
        if (used.length && !confirm(`«${c.label}» è assegnato a ${used.length} opere. Rimuoverlo comunque?`)) return;
        data.works.forEach((w) => { w.temi = (w.temi || []).filter((t) => t !== c.id); });
        list.splice(+b.dataset.del, 1); setDirty(); renderCats(); renderWorks();
      }));
      const add = () => {
        const inp = $("[data-new]", p), v = inp.value.trim(); if (!v) return;
        let id = slug(v), n = 2; while (list.some((x) => x.id === id)) id = slug(v) + "-" + n++;
        list.push({ id, label: v }); setDirty(); renderCats(); renderWorks();
      };
      $("[data-add]", p).onclick = add;
      $("[data-new]", p).onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } };
    });
  }

  /* ---------- Sito ---------- */
  function renderSite() {
    const el = $("#tab-site");
    el.innerHTML = `<div class="bar"><h2>Informazioni del sito</h2></div><div class="form">
      <label class="f">Nome<input data-k="siteTitle" value="${esc(cfg.siteTitle)}"></label>
      <label class="f">Frase sotto il titolo<input data-k="tagline" value="${esc(cfg.tagline)}"></label>
      <label class="f">Chi sono (una riga vuota separa i paragrafi)<textarea data-k="bio" style="min-height:200px">${esc(cfg.bio)}</textarea></label>
      <label class="f">Link profilo Instagram<input data-k="instagram" value="${esc(cfg.instagram)}" placeholder="https://www.instagram.com/…"></label>
      <label class="f">Email per i contatti<input data-k="email" type="email" value="${esc(cfg.email)}"></label>
      <div class="panel"><h3>Cambia PIN</h3><div class="crow"><input id="newpin" type="password" inputmode="numeric" placeholder="Nuovo PIN (min. 4 cifre)"><button class="btn small" id="setpin">Imposta</button></div></div></div>`;
    el.querySelectorAll("[data-k]").forEach((i) => (i.oninput = () => { cfg[i.dataset.k] = i.value; setDirty(); }));
    $("#setpin").onclick = async () => {
      const v = $("#newpin").value; if (v.length < 4) return toast("Il PIN deve avere almeno 4 caratteri.", true);
      cfg.pinHash = await pinHash(v); store.set("fc_pin_hash", cfg.pinHash); $("#newpin").value = ""; setDirty(); toast("PIN aggiornato: verrà salvato alla pubblicazione.");
    };
  }

  /* ---------- Collegamento GitHub ---------- */
  function renderGit() {
    const g = cfg.github;
    $("#tab-git").innerHTML = `<div class="bar"><h2>Collegamento GitHub</h2></div><div class="form">
      <div class="help"><p>Per pubblicare le modifiche serve un <b>token GitHub</b> personale, salvato <b>solo in questo browser</b> (mai nel sito).</p>
      <ol><li>Su GitHub: <code>Settings → Developer settings → Fine-grained tokens → Generate new token</code></li>
      <li>«Repository access»: solo <code>${esc(g.owner)}/${esc(g.repo)}</code></li>
      <li>«Permissions → Contents»: <code>Read and write</code></li>
      <li>Incolla il token qui sotto.</li></ol></div>
      <label class="f">Token GitHub<input id="g-token" type="password" value="${esc(token)}" placeholder="github_pat_…" autocomplete="off"></label>
      <div class="grid3">
        <label class="f">Utente<input data-g="owner" value="${esc(g.owner)}"></label>
        <label class="f">Repository<input data-g="repo" value="${esc(g.repo)}"></label>
        <label class="f">Branch<input data-g="branch" value="${esc(g.branch)}"></label></div>
      <div><button class="btn" id="g-test">Salva e verifica</button> <span id="g-res" class="help"></span></div></div>`;
    $("#g-test").onclick = async () => {
      token = $("#g-token").value.trim(); store.set("fc_gh_token", token);
      document.querySelectorAll("[data-g]").forEach((i) => { cfg.github[i.dataset.g] = i.value.trim(); });
      const res = $("#g-res"); res.textContent = "Verifica…"; res.className = "help";
      try { const r = await gh("data/works.json"); if (!r) throw new Error("File data/works.json non trovato nel repository."); res.textContent = "✓ Collegamento riuscito"; res.className = "help ok"; }
      catch (e) { res.textContent = "✗ " + e.message; res.className = "help"; res.style.color = "var(--accent)"; }
    };
  }

  /* ---------- Pubblica ---------- */
  $("#publish").onclick = async () => {
    if (!token) { document.querySelector('[data-tab="git"]').click(); return toast("Inserisci prima il token GitHub.", true); }
    const btn = $("#publish"); btn.disabled = true; btn.textContent = "Pubblico…";
    try {
      const used = new Set(data.works.map((w) => w.image));
      for (const [path, b64] of Object.entries(pendingImages)) { if (used.has(path)) await putFile(path, b64, "Aggiunta immagine " + path); }
      await putFile("data/works.json", b64utf8(JSON.stringify(data, null, 2) + "\n"), "Aggiorna elenco opere");
      await putFile("data/config.json", b64utf8(JSON.stringify(cfg, null, 2) + "\n"), "Aggiorna configurazione sito");
      for (const p of removedImages) { if (!used.has(p) && p.startsWith("images/")) await delFile(p, "Rimuovi immagine " + p).catch(() => {}); }
      Object.keys(pendingImages).forEach((k) => delete pendingImages[k]); removedImages.clear();
      setDirty(false); toast("Pubblicato! Il sito si aggiorna in 1–2 minuti.");
    } catch (e) { setDirty(true); toast("Errore: " + e.message, true); }
    btn.textContent = "Pubblica";
  };

  gate().catch((e) => { document.body.innerHTML = '<p style="padding:24px">Errore nel caricamento: ' + esc(e.message) + "</p>"; });
})();

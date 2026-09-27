/* ==========================================================================
   Jonah Dworkin — Portfolio
   ========================================================================== */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const page = document.body.dataset.page;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (min, max, v) => Math.min(max, Math.max(min, v));

  gsap.registerPlugin(ScrollTrigger);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  /* ------------------------------------------------------------------------
     Palette — ink and paper; the accent is only what you touch
     ------------------------------------------------------------------------ */
  const THEMES = {
    gofun: { "--bg": "rgb(241, 239, 234)", "--ink": "rgb(22, 22, 20)", "--muted": "rgb(107, 105, 100)", "--line": "rgba(22, 22, 20, 0.12)", "--accent": "rgb(183, 40, 46)", "--on-accent": "rgb(241, 239, 234)" },
    sumi: { "--bg": "rgb(22, 22, 20)", "--ink": "rgb(241, 239, 234)", "--muted": "rgb(142, 140, 134)", "--line": "rgba(241, 239, 234, 0.13)", "--accent": "rgb(210, 70, 74)", "--on-accent": "rgb(22, 22, 20)" },
  };
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  let currentTheme = store.get("mode") === "day" ? "gofun" : "sumi"; // night unless you chose day
  Object.entries(THEMES[currentTheme]).forEach(([k, v]) => root.style.setProperty(k, v));
  const themeMeta = $('meta[name="theme-color"]');
  themeMeta.setAttribute("content", THEMES[currentTheme]["--bg"]);
  function setTheme(name, duration = 1) {
    if (!THEMES[name] || name === currentTheme) return;
    currentTheme = name;
    gsap.to(root, { ...THEMES[name], duration: reduced ? 0 : duration, ease: "power2.out", overwrite: true });
    themeMeta.setAttribute("content", THEMES[name]["--bg"]);
  }

  const fontsReady = Promise.race([
    Promise.all([
      document.fonts.load('400 1em "Instrument Serif"'),
      document.fonts.load('400 1em "IBM Plex Mono"'),
      document.fonts.load('500 1em "Zen Kaku Gothic New"', "・ー二ニ三キヰ音花桜ヽ"),
    ]).catch(() => {}),
    new Promise((r) => setTimeout(r, 2000)),
  ]);

  /* ------------------------------------------------------------------------
     Glyphs — the character ramp shared by the wave and the image decoder.
     Light to dense: ・ ー 二 ニ 三 キ ヰ 音
     ------------------------------------------------------------------------ */
  const RAMP = ["・", "ー", "二", "ニ", "三", "キ", "ヰ", "音"];
  const glyphCache = new Map();
  function glyphs(size, color, chars = RAMP) {
    const key = size + "|" + color + "|" + chars.join("");
    if (glyphCache.has(key)) return glyphCache.get(key);
    const set = chars.map((ch) => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d");
      g.fillStyle = color;
      g.font = `500 ${Math.round(size * 0.8)}px "Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(ch, size / 2, size / 2 + size * 0.04);
      return c;
    });
    glyphCache.set(key, set);
    return set;
  }
  fontsReady.then(() => glyphCache.clear()); // redraw once the Japanese font has arrived

  /* ------------------------------------------------------------------------
     Decoder — an image arrives as a mosaic of characters sampled from its own
     light and dark, then the characters drop away and the image resolves.
     ------------------------------------------------------------------------ */
  function makeDecoder(img) {
    let wrap = img.parentElement;
    if (!wrap.classList.contains("thumb")) {
      wrap = document.createElement("span");
      wrap.className = "decode";
      img.replaceWith(wrap);
      wrap.append(img);
    }
    const cv = document.createElement("canvas");
    cv.className = "decode__code";
    wrap.append(cv);
    const ctx = cv.getContext("2d");
    const st = { p: 0 };
    let cells = null, order = null, cols = 0, rows = 0, color = "#000", dpr = 1, cellPx = 8;

    const themeOf = () => currentTheme;
    const loaded = () => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); }));

    function sample() {
      const r = wrap.getBoundingClientRect();
      if (!r.width || !r.height || !img.naturalWidth) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cellPx = r.width < 220 ? 7 : 9;
      cols = Math.max(4, Math.round(r.width / cellPx));
      rows = Math.max(4, Math.round(r.height / cellPx));
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      const oc = document.createElement("canvas");
      oc.width = cols; oc.height = rows;
      const o = oc.getContext("2d", { willReadFrequently: true });
      let data;
      try { o.drawImage(img, 0, 0, cols, rows); data = o.getImageData(0, 0, cols, rows).data; }
      catch { return false; } // file:// taints the canvas — fall back to a plain fade
      const theme = themeOf();
      const onDark = theme === "sumi";
      color = THEMES[theme]["--ink"];
      cells = new Float32Array(cols * rows);
      order = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        const L = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
        cells[i] = onDark ? L : 1 - L;
        order[i] = Math.random();
      }
      return true;
    }

    function render() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (!cells || st.p >= 1) return;
      const set = glyphs(Math.ceil(cellPx * dpr), color);
      const sx = cv.width / cols, sy = cv.height / rows;
      for (let i = 0; i < cells.length; i++) {
        if (order[i] < st.p) continue;
        const d = cells[i];
        if (d < 0.12) continue;
        let idx = Math.min(7, Math.floor(d * 8));
        if (Math.random() < 0.05) idx = (Math.random() * 8) | 0; // a little shimmer while it tunes in
        ctx.globalAlpha = 0.3 + 0.7 * d;
        ctx.drawImage(set[idx], (i % cols) * sx, ((i / cols) | 0) * sy, sx, sy);
      }
      ctx.globalAlpha = 1;
    }
    const imgAlpha = () => clamp(0, 1, (st.p - 0.3) / 0.7);

    img.style.opacity = reduced ? 1 : 0;
    return {
      reveal(delay = 0, duration = 1.2) {
        if (reduced) return;
        return loaded().then(() => {
          if (!sample()) return gsap.to(img, { opacity: 1, duration: 0.8, delay });
          cv.style.display = "";
          st.p = 0; render();
          return gsap.to(st, {
            p: 1, duration, delay, ease: "power1.inOut", overwrite: true,
            onUpdate: () => { render(); img.style.opacity = imgAlpha(); },
            onComplete: () => { img.style.opacity = 1; cv.style.display = "none"; },
          });
        });
      },
      conceal(duration = 0.55) {
        if (reduced || !sample()) return Promise.resolve();
        cv.style.display = "";
        st.p = 1;
        return gsap.to(st, {
          p: 0, duration, ease: "power2.in", overwrite: true,
          onUpdate: () => { render(); img.style.opacity = imgAlpha(); },
        });
      },
    };
  }

  /* ------------------------------------------------------------------------
     Break-apart — shared by the home wave and the project titles.
     Whatever is drawn in characters on the fixed canvas is recorded glyph by
     glyph; as you scroll, every glyph comes loose, bursts outward and flies
     into place as a row of screens — each one landing on a cell of that
     screen's own light-and-dark mosaic. Then the screens resolve underneath.
     It is tied to the scroll, so scrolling back up reassembles the source.
     env: { ctx, canvas, W(), H(), dpr(), cell(), colors(), time() }
     ------------------------------------------------------------------------ */
  function createBreakApart(env) {
    const MAXS = 9000;
    const snap = { x: new Float32Array(MAXS), y: new Float32Array(MAXS), g: new Uint8Array(MAXS), a: new Float32Array(MAXS), red: new Uint8Array(MAXS), n: 0 };
    const T = { ok: false, row: null, imgs: [], fades: [], followers: [], targets: null, parts: null, mode: "live", dirty: true, shown: -1, faded: -1 };
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

    function sampleTargets() {
      const cell = env.cell(), onDark = currentTheme === "sumi";
      const list = [];
      for (let ti = 0; ti < T.imgs.length; ti++) {
        const img = T.imgs[ti], r = img.parentElement.getBoundingClientRect();
        if (!r.width || !img.naturalWidth) return false;
        const tc = Math.max(3, Math.round(r.width / cell)), tr = Math.max(3, Math.round(r.height / cell));
        const oc = document.createElement("canvas");
        oc.width = tc; oc.height = tr;
        const o = oc.getContext("2d", { willReadFrequently: true });
        let data;
        try { o.drawImage(img, 0, 0, tc, tr); data = o.getImageData(0, 0, tc, tr).data; }
        catch { return false; } // file:// taints the canvas — keep the simple fade instead
        for (let j = 0; j < tc * tr; j++) {
          const L = (0.2126 * data[j * 4] + 0.7152 * data[j * 4 + 1] + 0.0722 * data[j * 4 + 2]) / 255;
          const d = onDark ? L : 1 - L;
          if (d < 0.14) continue;
          list.push({ t: ti, fx: ((j % tc) + 0.5) / tc, fy: (((j / tc) | 0) + 0.5) / tr, g: Math.min(7, Math.floor(d * 8)), a: 0.3 + 0.7 * d });
        }
      }
      T.targets = list.sort((a, b) => a.t - b.t || a.fx - b.fx);
      T.dirty = false;
      return true;
    }

    function buildParticles() {
      const W = env.W(), H = env.H(), cell = env.cell(), n = T.targets.length;
      if (!snap.n) { // nothing drawn yet: leave from a quiet line across the middle
        for (let i = 0; i < 400; i++) { snap.x[i] = (i / 400) * W; snap.y[i] = H / 2 - cell / 2; snap.g[i] = 1; snap.a[i] = 0.35; snap.red[i] = 0; }
        snap.n = 400;
      }
      const sn = snap.n;
      const order = Array.from({ length: sn }, (_, i) => i).sort((a, b) => snap.x[a] - snap.x[b]);
      const used = new Uint8Array(sn), P = [];
      const make = (si, tj) => {
        const dx = snap.x[si] - W / 2, dy = snap.y[si] - H / 2, len = Math.hypot(dx, dy) || 1;
        const ang = Math.random() * Math.PI * 2, mag = 70 + Math.random() * 260;
        return {
          sx: snap.x[si], sy: snap.y[si], sg: snap.g[si], sa: snap.a[si], sr: snap.red[si], tj,
          delay: Math.random() * 0.16 + (snap.x[si] / W) * 0.08,
          bx: (dx / len) * mag * 0.6 + Math.cos(ang) * mag * 0.7,
          by: (dy / len) * mag * 0.6 + Math.sin(ang) * mag * 0.7 - 40,
          rot: (Math.random() - 0.5) * 3,
          seed: (Math.random() * 8) | 0,
        };
      };
      for (let j = 0; j < n; j++) {
        const si = order[Math.min(sn - 1, Math.floor((j / n) * sn))];
        used[si] = 1;
        P.push(make(si, j));
      }
      for (let i = 0; i < sn; i++) if (!used[i]) P.push(make(i, -1)); // the rest drift off as dust
      T.parts = P;
    }

    function showImages(v) {
      if (v === T.shown) return;
      T.shown = v;
      T.imgs.forEach((img) => (img.style.opacity = v));
      T.followers.forEach((el) => (el.style.opacity = v)); // e.g. recordings playing over their first frames
      if (T.row) T.row.style.setProperty("--landed", v); // the landing frame (a phone's bezel) appears with its screen, not before
    }

    function drawParticles(p) {
      const { ctx, canvas } = env, { ink, accent, bg } = env.colors();
      const H = env.H(), dpr = env.dpr(), cell = env.cell();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const handoff = clamp(0, 1, (p - 0.9) / 0.1); // the screens take over from the characters
      showImages(handoff);
      if (handoff >= 1) return;
      const cs = Math.ceil(cell * dpr), half = cs / 2;
      const inkSet = glyphs(cs, ink), redSet = glyphs(cs, accent);
      const rects = T.imgs.map((img) => img.parentElement.getBoundingClientRect());
      const tick = Math.floor(env.time() * 14);
      for (const q of T.parts) {
        const k = clamp(0, 1, (p - q.delay) / 0.72);
        let x, y, a, g, rot, red = false;
        if (q.tj < 0) {
          if (k >= 0.6) continue;
          const e = k / 0.6;
          x = q.sx + q.bx * 1.8 * e;
          y = q.sy + q.by * 1.8 * e;
          a = Math.min(1, q.sa * 1.6) * (1 - e);
          g = k < 0.1 ? q.sg : (q.seed + tick) % 8;
          rot = q.rot * e;
        } else {
          const tg = T.targets[q.tj], r = rects[tg.t];
          const tx = r.left + tg.fx * r.width - cell / 2, ty = r.top + tg.fy * r.height - cell / 2;
          const e = ease(k), b = Math.sin(Math.PI * Math.min(1, k * 1.1));
          x = q.sx + (tx - q.sx) * e + q.bx * b;
          y = q.sy + (ty - q.sy) * e + q.by * b;
          a = Math.min(1, (q.sa + (tg.a - q.sa) * e) * (1 + 0.9 * b)) * (1 - handoff); // brighter mid-flight
          g = k < 0.1 ? q.sg : k > 0.84 ? tg.g : (q.seed + tick) % 8; // scrambles in flight, settles on landing
          rot = q.rot * b;
          red = q.sr && k < 0.3;
        }
        if (a < 0.02 || y < -2 * cell || y > H + cell) continue;
        ctx.globalAlpha = a;
        const c = Math.cos(rot), s = Math.sin(rot);
        ctx.setTransform(c, s, -s, c, x * dpr + half, y * dpr + half);
        ctx.drawImage((red ? redSet : inkSet)[g], -half, -half);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    }

    return {
      get ok() { return T.ok; },
      reset() { snap.n = 0; },
      record(x, y, g, a, red) {
        if (snap.n >= MAXS) return;
        const k = snap.n++;
        snap.x[k] = x; snap.y[k] = y; snap.g[k] = g; snap.a[k] = a; snap.red[k] = red ? 1 : 0;
      },
      invalidate() { T.dirty = true; },
      // take over a row of screens; resolves false if it can't run (reduced motion, file://)
      adopt(row, imgs, fades = [], followers = [], endAt = null) {
        if (reduced) return Promise.resolve(false);
        T.row = row; T.imgs = imgs; T.fades = fades; T.followers = followers; T.endAt = endAt;
        const loaded = imgs.map((img) => (img.complete && img.naturalWidth ? 0 : new Promise((r) => {
          img.addEventListener("load", r, { once: true });
          img.addEventListener("error", r, { once: true });
        })));
        return Promise.all(loaded).then(() => fontsReady).then(() => (T.ok = sampleTargets()));
      },
      // 0 at the top → 1 once the row has settled 20% down the viewport (or at a given scroll position)
      progress() {
        const top = T.endAt ? T.endAt() : T.row.getBoundingClientRect().top + window.scrollY - env.H() * 0.2;
        return clamp(0, 1, window.scrollY / Math.max(1, top));
      },
      // draws the flight and returns true while it is under way; false means "draw your source"
      frame(p) {
        let drew = false;
        if (T.ok && p > 0.012) {
          if (T.mode === "live") { buildParticles(); T.mode = "parts"; }
          drawParticles(p);
          drew = true;
        } else {
          T.mode = "live";
          if (T.ok) { if (T.dirty) sampleTargets(); showImages(0); }
        }
        if (T.ok) {
          const f = clamp(0, 1, (p - 0.55) / 0.35);
          if (f !== T.faded) { T.faded = f; T.fades.forEach((el) => el && (el.style.opacity = f)); }
        }
        return drew;
      },
    };
  }

  /* ------------------------------------------------------------------------
     Navigation — hover scramble, page transitions
     ------------------------------------------------------------------------ */
  const KANA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
  $$("[data-scramble]").forEach((el) => {
    const final = el.textContent;
    let raf = 0;
    el.addEventListener("mouseenter", () => {
      if (reduced) return;
      cancelAnimationFrame(raf);
      el.style.width = el.getBoundingClientRect().width + "px";
      let f = 0;
      const tick = () => {
        const k = (f++ / 1.6) | 0;
        el.textContent = [...final].map((ch, i) => (i < k || ch === " " ? ch : KANA[(Math.random() * KANA.length) | 0])).join("");
        if (k < final.length) raf = requestAnimationFrame(tick);
        else { el.textContent = final; el.style.width = ""; }
      };
      tick();
    });
  });

  const curtain = $(".curtain");
  let lenis = null;
  let leaving = false;
  function scrollToTarget(target, immediate = false) {
    if (lenis) lenis.scrollTo(target, immediate ? { immediate: true } : { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else if (target === 0) window.scrollTo({ top: 0 });
    else target.scrollIntoView();
  }
  function leave(href) {
    if (leaving) return;
    leaving = true;
    if (reduced) return (location.href = href);
    curtain.style.animation = "none";
    gsap.fromTo(curtain, { opacity: 0, visibility: "visible" }, {
      opacity: 1, duration: 0.4, ease: "power2.in",
      onComplete: () => (location.href = href),
    });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return; // mailto:, other sites, file://
    const samePage = url.pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, "");
    e.preventDefault();
    if (samePage) {
      const target = url.hash && url.hash !== "#top" ? $(url.hash) : 0;
      if (target !== null) scrollToTarget(target);
      return;
    }
    leave(url.href);
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) { leaving = false; gsap.set(curtain, { opacity: 0, visibility: "hidden" }); }
  });

  function startLenis() {
    if (reduced) return;
    lenis = new Lenis({ lerp: 0.09 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  if (page === "home") initHome();
  else if (page === "project") initProject();
  else initScrollPage();

  /* ========================================================================
     HOME
     ======================================================================== */
  function initHome() {
    startLenis();
    window.scrollTo(0, 0);
    const sound = createSound();
    const wave = createWave($(".wave"), sound);

    /* ---- the work: rows decode in as they arrive ---- */
    const rows = $$(".reel__row").map((row) => ({ row, decoders: $$(".thumb img", row).map(makeDecoder), shown: false, managed: false }));
    // the first row is built by the wave breaking apart (see createWave); the rest decode as they arrive
    rows[0].managed = true;
    wave.adopt(rows[0].row, $$(".thumb img", rows[0].row)).then((ok) => {
      if (ok) return;
      rows[0].managed = false;
      const r = rows[0].row.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0 && !rows[0].shown) { rows[0].shown = true; rows[0].decoders.forEach((d, i) => d.reveal(i * 0.07)); }
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const r = rows.find((x) => x.row === en.target);
        if (!en.isIntersecting || r.shown || r.managed) return;
        r.shown = true;
        r.decoders.forEach((d, i) => d.reveal(i * 0.07));
      });
    }, { threshold: 0.2 });
    rows.forEach((r) => io.observe(r.row));

    // leaving through a project: its screens fold back into characters first
    rows.forEach((r) => r.row.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      const href = r.row.href;
      Promise.all(r.decoders.map((d) => d.conceal())).then(() => leave(href));
    }, true));

    // Apple Music recordings play while you hover them
    $$(".thumb").forEach((t) => {
      const v = $("video", t);
      if (!v || !finePointer) return;
      t.addEventListener("mouseenter", () => {
        if (!v.src) v.src = v.dataset.src;
        v.play().then(() => t.classList.add("is-playing")).catch(() => {});
      });
      t.addEventListener("mouseleave", () => { v.pause(); t.classList.remove("is-playing"); });
    });

    /* ---- sound wakes with the first click, tap or key press (a browser rule) ---- */
    const wake = () => sound.start();
    window.addEventListener("pointerdown", wake, true);
    window.addEventListener("keydown", wake, true);

    setupModes(() => wave.recolor());
    if (location.hash === "#work") fontsReady.then(() => scrollToTarget($("#work"), true));

    /* ---- opening: silence, then sound ---- */
    const chrome = [".bar"];
    if (reduced) { wave.amp(1, 0); return; }
    gsap.set(chrome, { opacity: 0 });
    fontsReady.then(() => {
      wave.amp(1, 2.8, 0.7);
      gsap.to(chrome, { opacity: 1, duration: 1.2, ease: "power2.out", stagger: 0.1, delay: 1.5 });
      wave.showControls(1.8);
    });
  }

  /* ---- the wave ----------------------------------------------------------
     Two strands of a standing wave on a character grid. The cursor bends it
     like a string and swells it with how fast you move; a click plucks it and
     sends a ripple along; dragging strums. Scrolling lets it fall back to
     silence and scatter. The sound engine reads the exact same shape.
     ------------------------------------------------------------------------ */
  function createWave(canvas, sound) {
    const ctx = canvas.getContext("2d");
    const S = { t: 0, amp: 0, mu: 0.5, muT: 0.5, energy: 0, energyT: 0, lastMove: 0, pull: 0, pullT: 0, scroll: 0 };
    const ripples = [];
    const CYCLE = 2 / 4.5; // one period of the wave, as a fraction of the screen width
    let W = 0, H = 0, dpr = 1, cell = 14, cols = 0, rows = 0, ink = "#fff", accent = "#f00", bg = "#000";

    const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    let ba = null; // break-apart, set up below
    const recolor = () => { ink = css("--ink"); accent = css("--accent"); bg = css("--bg"); if (ba) ba.invalidate(); };
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cell = W < 800 ? 11 : 14;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      cols = Math.floor(W / cell);
      rows = Math.floor(H / cell);
      if (ba) ba.invalidate();
    }
    resize(); recolor();
    window.addEventListener("resize", resize);
    ba = createBreakApart({ ctx, canvas, W: () => W, H: () => H, dpr: () => dpr, cell: () => cell, colors: () => ({ ink, accent, bg }), time: () => S.t });

    const Arows = () => Math.min(rows * 0.3, 20);
    const band = () => Arows() + 8;
    const strand = (v, y, z) => {
      const depth = (z + 1) / 2;
      const d = (v - y) / (0.8 + 1.7 * depth); // strand thickness, in rows: thin at the back, full at the front
      return Math.exp(-d * d) * (0.35 + 0.65 * depth);
    };
    const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

    // the shape of the wave at one horizontal position (u = 0…1 across the screen)
    function column(u) {
      const t = S.t, quiet = 1 - S.scroll;
      const env = Math.pow(Math.sin(Math.PI * clamp(0, 1, u)), 1.4);
      const touch = S.energy * Math.exp(-Math.pow((u - S.mu) / 0.08, 2));
      let rip = 0;
      for (const r of ripples) {
        const age = t - r.t0;
        const d = Math.abs(u - r.u) - age * 0.5;
        rip += r.s * Math.exp(-Math.pow(d / 0.04, 2)) * Math.exp(-age * 1.3);
      }
      const A = S.amp * quiet * Arows() * env * (0.7 + 0.2 * Math.sin(t * 0.7 + u * 4) + 0.4 * touch + 0.55 * Math.min(rip, 1.2));
      const bend = S.pull * quiet * Math.exp(-Math.pow((u - S.mu) / 0.1, 2)) * env;
      const th = u * Math.PI * 4.5 - t * 1.05;
      return { env, touch, rip, A, bend, th };
    }

    function draw() {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ba.reset();
      if (S.scroll >= 0.999) return;
      const cs = Math.ceil(cell * dpr);
      const inkSet = glyphs(cs, ink), redSet = glyphs(cs, accent);
      const ox = ((W - cols * cell) / 2) * dpr, oy = ((H - rows * cell) / 2) * dpr;
      const mid = (rows - 1) / 2;
      const scatter = S.scroll * S.scroll * 26;
      for (let c = 0; c < cols; c++) {
        const { env, touch, rip, A, bend, th } = column((c + 0.5) / cols);
        const y1 = A * Math.sin(th), z1 = Math.cos(th);
        const fade = Math.min(1, env * 2.5);
        const reach = Math.abs(y1) + Math.abs(bend) + 5;
        const r0 = Math.max(0, Math.floor(mid - reach)), r1 = Math.min(rows - 1, Math.ceil(mid + reach));
        const lit = touch > 0.3 || rip > 0.12;
        for (let r = r0; r <= r1; r++) {
          const v = r - mid - bend;
          let I = Math.max(strand(v, y1, z1), strand(v, -y1, -z1)) * fade;
          const ay = Math.abs(y1);
          if (Math.abs(v) < ay) I = Math.max(I, 0.1 * fade * (1 - Math.abs(v) / (ay + 1e-3)));
          if (Math.abs(v) < 0.5) I = Math.max(I, 0.2); // the baseline — silence
          if (I < 0.07) continue;
          const idx = Math.min(RAMP.length - 1, Math.floor(I * RAMP.length));
          ctx.globalAlpha = (0.22 + 0.78 * Math.min(1, I)) * (1 - S.scroll * 0.6);
          const dy = scatter ? (hash(c, r) - 0.5) * scatter : 0;
          ctx.drawImage((lit && I > 0.4 ? redSet : inkSet)[idx], ox + c * cs, oy + (r + dy) * cs);
          ba.record((ox + c * cs) / dpr, (oy + (r + dy) * cs) / dpr, idx, ctx.globalAlpha, lit && I > 0.4);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* ---- interaction ---- */
    const now = () => performance.now();
    let down = false, downX = 0, downY = 0, lastStrike = 0, lastString = -1, lx = 0, ly = 0, lt = 0;
    const active = (e) => S.scroll < 0.4 && !e.target.closest("a, button");
    const stringAt = (x) => clamp(0, sound.strings - 1, Math.floor((x / W) * sound.strings));
    function strike(i, vel, delay = 0) {
      ripples.push({ u: (i + 0.5) / sound.strings, t0: S.t + delay, s: 0.25 + vel * 0.6 });
      if (ripples.length > 18) ripples.shift();
      sound.pluck(i, vel, api, delay);
      lastStrike = now();
    }
    window.addEventListener("pointermove", (e) => {
      // how fast you move is how hard you pluck
      const dt = Math.max(8, e.timeStamp - lt);
      const speed = (Math.hypot(e.clientX - lx, e.clientY - ly) / dt) * 1000;
      lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
      const pyRows = (e.clientY - H / 2) / cell;
      const near = clamp(0, 1, 1.6 - Math.abs(pyRows) / band());
      S.muT = e.clientX / W;
      S.energyT = near * clamp(0.3, 1, 0.3 + speed / 1400);
      S.lastMove = now();
      S.pullT = Math.abs(pyRows) < band() ? clamp(-band(), band(), pyRows) * 0.55 : 0;
      // sweeping across the wave plucks every string you pass over
      const i = stringAt(e.clientX);
      const onWave = near > 0.4 && S.scroll < 0.4 && !e.target.closest("a, button");
      if (onWave && lastString !== -1 && i !== lastString && now() - lastStrike > 28) {
        const dir = Math.sign(i - lastString);
        const vel = clamp(0.2, 1, 0.2 + speed / 2600) * (down ? 1.25 : 1);
        for (let k = lastString + dir, n = 0; n < 4 && (dir > 0 ? k <= i : k >= i); k += dir, n++) strike(k, Math.min(1, vel), n * 0.022);
      }
      lastString = onWave ? i : -1;
    });
    window.addEventListener("pointerdown", (e) => {
      if (!active(e)) return;
      down = true; downX = e.clientX; downY = e.clientY;
      if (e.pointerType !== "touch") { strike(stringAt(e.clientX), 0.95); lastString = stringAt(e.clientX); }
    });
    window.addEventListener("pointerup", (e) => {
      if (down && e.pointerType === "touch" && Math.hypot(e.clientX - downX, e.clientY - downY) < 10) strike(stringAt(e.clientX), 0.95);
      down = false;
    });
    document.addEventListener("pointerleave", () => { S.pullT = 0; S.energyT = 0; });

    const opacity = () => (ba.ok ? 1 : 1 - S.scroll);
    const hero = $(".hero");
    const controls = $(".controls");
    const controlsIn = { v: reduced ? 1 : 0 }; // faded in by the opening; the wave settings leave with the wave

    const api = {
      amp: (to, duration, delay = 0) => gsap.to(S, { amp: to, duration, delay, ease: "power2.inOut" }),
      showControls: (delay) => gsap.to(controlsIn, { v: 1, duration: 1.2, delay, ease: "power2.out" }),
      recolor,
      opacity,
      // one period of the wave under the pointer, normalised — this is the waveform you hear
      samples(n) {
        const out = new Float32Array(n), ar = Arows() || 1;
        for (let i = 0; i < n; i++) {
          const c = column(S.mu + (i / n - 0.5) * CYCLE);
          out[i] = (c.A * Math.sin(c.th) + c.bend) / ar;
        }
        return out;
      },
      get mu() { return S.mu; },
      get energy() { return S.energy; },
      get pull() { return S.pull; },
      get band() { return band(); },
      get level() { return S.amp * (1 - S.scroll); },
      // hand the first row of screens to the break-apart
      adopt: (row, imgs) => ba.adopt(row, imgs, [$(".reel__meta", row)]),
    };

    gsap.ticker.add((time, dt) => {
      if (!reduced) S.t += dt / 1000;
      if (now() - S.lastMove > 1100) { S.energyT = 0; S.pullT = 0; }
      S.mu += (S.muT - S.mu) * 0.08;
      S.energy += (S.energyT - S.energy) * 0.06;
      S.pull += (S.pullT - S.pull) * 0.07;
      while (ripples.length && S.t - ripples[0].t0 > 3.2) ripples.shift();
      const p = ba.ok ? ba.progress() : clamp(0, 1, window.scrollY / (H * 0.85));
      S.scroll = p;
      hero.style.opacity = clamp(0, 1, 1 - p * 4);
      controls.style.opacity = String(clamp(0, 1, 1 - (p - 0.2) * 4) * controlsIn.v);
      controls.style.pointerEvents = p > 0.4 ? "none" : "";
      if (!ba.frame(p)) {
        if (!ba.ok) canvas.style.opacity = opacity();
        draw();
      }
      sound.update(api);
    });

    return api;
  }

  /* ---- sound: the wave is a koto ----------------------------------------
     Thirteen strings run invisibly across the screen, tuned to the yo scale
     (D E G A B — the Japanese pentatonic with no half steps, so any strings
     you sweep across sound consonant together). A click plucks hard. Each
     note is a physically modelled string (Karplus-Strong), tuned exactly
     with a fractional all-pass delay, and set ringing by the wave's own
     shape under your pointer: a calm wave gives a round, warm note; a
     jagged, rippling one a brighter twang. Notes are never bent off pitch.
     ------------------------------------------------------------------------ */
  function createSound() {
    const KOTO = [ // yo scale, from D3, equal temperament (A4 = 440)
      ["D3", 146.83], ["E3", 164.81], ["G3", 196.0], ["A3", 220.0], ["B3", 246.94], ["D4", 293.66], ["E4", 329.63],
      ["G4", 392.0], ["A4", 440.0], ["B4", 493.88], ["D5", 587.33], ["E5", 659.25], ["G5", 783.99],
    ];
    const s = { on: true, live: false, ctx: null, strings: KOTO.length, last: null, lastAt: 0 };
    let bus = null, master = null;

    function impulse(ctx, secs) {
      const len = Math.round(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.6);
      }
      return buf;
    }

    function build() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
      // a little wooden body: warm low-mids, softened top
      const body = ctx.createBiquadFilter(); body.type = "peaking"; body.frequency.value = 240; body.Q.value = 0.9; body.gain.value = 3;
      const soft = ctx.createBiquadFilter(); soft.type = "highshelf"; soft.frequency.value = 4200; soft.gain.value = -6;
      const room = ctx.createConvolver(); room.buffer = impulse(ctx, 3.2);
      const wet = ctx.createGain(); wet.gain.value = 0.32;
      bus = ctx.createGain();
      bus.connect(body); body.connect(soft); soft.connect(comp);
      soft.connect(room); room.connect(wet); wet.connect(comp);
      comp.connect(master); master.connect(ctx.destination);
      return ctx;
    }

    // Karplus-Strong: a delay line one period long, filled with an excitation
    // and fed back through a two-point average and a first-order all-pass that
    // supplies the fractional remainder, so the loop is exactly one period and
    // the string rings in tune (measured within a cent across all 13 strings).
    function string(ctx, freq, vel, shape) {
      const sr = ctx.sampleRate, len = Math.round(sr * 3.2);
      let P = sr / freq + 0.5, N = Math.floor(P), frac = P - N; // the average below reads one sample ahead: −½ sample
      if (frac < 0.1) { N -= 1; frac += 1; } // keep the all-pass in its accurate range
      const C = (1 - frac) / (1 + frac);
      const line = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const w = shape ? shape[Math.floor((i / N) * shape.length)] : 0;
        line[i] = 0.65 * w + 0.35 * (Math.random() * 2 - 1);
      }
      // softer plucks are rounder: smooth the excitation before it rings
      const passes = Math.round((1 - vel) * 4);
      for (let p = 0; p < passes; p++) for (let i = 0; i < N; i++) line[i] = 0.5 * (line[i] + line[(i + 1) % N]);
      let mean = 0; for (let i = 0; i < N; i++) mean += line[i]; mean /= N;
      for (let i = 0; i < N; i++) line[i] -= mean;
      const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
      const rho = 0.9992 - freq * 0.0000006; // higher strings die away sooner
      let k = 0, peak = 1e-6, apIn = 0, apOut = 0;
      for (let n = 0; n < len; n++) {
        const a = line[k], b = line[(k + 1) % N];
        out[n] = a;
        const avg = 0.5 * (a + b);
        const ap = C * avg + apIn - C * apOut; // all-pass: y = C·x + x₋₁ − C·y₋₁
        apIn = avg; apOut = ap;
        line[k] = rho * ap;
        k = (k + 1) % N;
        const m = Math.abs(a); if (m > peak) peak = m;
      }
      const g = 1 / peak, fadeFrom = len - Math.round(sr * 0.3);
      for (let n = 0; n < len; n++) out[n] *= g * (n > fadeFrom ? (len - n) / (len - fadeFrom) : 1);
      return buf;
    }

    s.start = () => { // must run inside a click / tap / key press
      if (!s.ctx) s.ctx = build();
      if (!s.ctx) return;
      if (s.ctx.state === "suspended") s.ctx.resume();
      master.gain.setTargetAtTime(1, s.ctx.currentTime, 0.05);
      s.live = true;
    };

    // strike string i (0…12)
    s.pluck = (i, vel = 0.6, w, delay = 0) => {
      if (!s.live) return;
      const ctx = s.ctx, [name, hz] = KOTO[clamp(0, KOTO.length - 1, i)];
      const src = ctx.createBufferSource();
      src.buffer = string(ctx, hz, vel, w ? w.samples(64) : null);
      const g = ctx.createGain(); g.gain.value = 0.34 * vel * (w ? Math.max(0.35, w.level) : 1);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(g);
      if (pan) { pan.pan.value = (i / (KOTO.length - 1)) * 1.3 - 0.65; g.connect(pan); pan.connect(bus); } else g.connect(bus);
      src.start(ctx.currentTime + delay);
      s.last = [name, hz];
      s.lastAt = performance.now();
    };

    s.update = () => {}; // notes stay exactly on pitch — nothing to follow

    document.addEventListener("visibilitychange", () => {
      if (!s.ctx) return;
      if (document.hidden) s.ctx.suspend();
      else if (s.live) s.ctx.resume();
    });
    return s;
  }

  /* ========================================================================
     Shared by the scrolling pages
     ======================================================================== */

  // day / night — one choice for the whole site
  function setupModes(onApply) {
    const modes = $$(".controls [data-mode]");
    const sync = () => modes.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === (currentTheme === "gofun" ? "day" : "night"))));
    sync();
    modes.forEach((b) => b.addEventListener("click", () => {
      const mode = b.dataset.mode;
      store.set("mode", mode);
      const apply = () => { setTheme(mode === "day" ? "gofun" : "sumi", 0); if (onApply) onApply(); sync(); };
      if (reduced) return apply();
      gsap.timeline()
        .to(".wave", { opacity: 0, duration: 0.25, ease: "power1.in", onComplete: apply })
        .to(".wave", { opacity: 1, duration: 0.5, ease: "power1.out" });
    }));
  }

  function scrollBits() {
    // word-by-word ink-in
    $$("[data-words]").forEach((el) => {
      const words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map((w) => `<span class="word">${w}</span>`).join(" ");
      if (!reduced) {
        gsap.fromTo($$(".word", el), { opacity: 0.15 }, {
          opacity: 1, stagger: 0.1, ease: "none",
          scrollTrigger: { trigger: el, start: "top 80%", end: "clamp(bottom 55%)", scrub: true }, // clamp: finishes even near the page end
        });
      }
    });

    // galleries that scroll sideways — pinned on desktop, swiped on phones
    gsap.matchMedia().add("(min-width: 800px)", () => {
      if (reduced) return;
      $$("[data-hscroll]").forEach((sec) => {
        sec.classList.add("is-pinned");
        const track = $(".hscroll__track", sec);
        const bar = $(".hscroll__progress b", sec);
        const dist = () => track.scrollWidth - window.innerWidth;
        gsap.to(track, {
          x: () => -dist(),
          ease: "none",
          scrollTrigger: {
            trigger: sec, start: "top top", end: () => "+=" + dist(),
            pin: true, scrub: 0.8, invalidateOnRefresh: true,
            onUpdate: (self) => bar && (bar.style.transform = `scaleX(${self.progress})`),
          },
        });
      });
      return () => $$("[data-hscroll]").forEach((sec) => sec.classList.remove("is-pinned"));
    });

    // every screen decodes out of characters as it comes into view
    const decoders = new Map($$(".shot img, .screens img, .anno__phone img, .crate__card img").map((img) => [img, makeDecoder(img)]));
    const dio = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        dio.unobserve(en.target);
        decoders.get($("img", en.target)).reveal(0, 1.1);
      });
    }, { threshold: 0.25 });
    $$(".decode").forEach((w) => dio.observe(w));

    if (!reduced) {
      gsap.set("[data-reveal]", { opacity: 0, y: 24 });
      const show = (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.08, overwrite: true });
      ScrollTrigger.batch("[data-reveal]", { start: "top 92%", once: true, onEnter: show, onEnterBack: show });
    }

    $$("[data-anno]").forEach((a) => {
      if (reduced) return a.classList.add("is-in");
      ScrollTrigger.create({ trigger: a, start: "top 65%", once: true, onEnter: () => a.classList.add("is-in") });
    });

    // recordings load and play only while on screen
    const vio = new IntersectionObserver((entries) => {
      entries.forEach(({ target: v, isIntersecting }) => {
        if (isIntersecting) {
          if (!v.src && v.dataset.src) v.src = v.dataset.src;
          if (!reduced) v.play().catch(() => {});
        } else v.pause();
      });
    }, { threshold: 0.3 });
    $$("video[data-src]").forEach((v) => {
      if (!v.closest(".ring")) vio.observe(v);
      v.addEventListener("playing", () => v.parentElement.classList.add("is-playing"));
    });

    window.scrollTo(0, 0);
    fontsReady.then(() => {
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      const target = location.hash && $(location.hash);
      if (target) scrollToTarget(target, true);
    });
  }

  // screens take on their colour as they reach the middle of the view (or when touched)
  function colorFocus() {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.target.classList.toggle("is-color", en.isIntersecting)),
      { rootMargin: "-28% -22% -28% -22%" }
    );
    $$(".proj .decode, .proj .thumb, .proj .film__media").filter((el) => !el.closest(".crate")).forEach((el) => io.observe(el));
  }

  /* ---- a crate of screens you flip through: the front entry tips forward
     out of the way and the next rises into colour, like thumbing through
     records. The caption follows the entry in front. ---- */
  function setupCrates() {
    $$("[data-crate]").forEach((sec) => {
      const cards = $$(".crate__card", sec), n = cards.length;
      const day = $(".crate__day", sec), ttl = $(".crate__title", sec), txt = $(".crate__text", sec);
      const count = $(".crate__count > b", sec), bar = $(".crate__bar b", sec);
      let shown = 0;
      function caption(i) {
        if (i === shown) return;
        shown = i;
        const d = cards[i].dataset;
        day.textContent = d.day; ttl.textContent = d.title; txt.textContent = d.text;
        count.textContent = String(i + 1).padStart(2, "0");
        if (!reduced) gsap.fromTo([day, ttl, txt], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "power2.out", overwrite: true });
      }
      function layout(p) {
        const s = p * (n - 1);
        cards.forEach((card, i) => {
          const d = i - s;
          let tf, op;
          if (d >= 0) { // waiting behind, stacked back and up
            tf = `translate3d(0, ${(-d * 26).toFixed(1)}px, ${(-d * 90).toFixed(1)}px) scale(${(1 - d * 0.04).toFixed(3)})`;
            op = d > 3 ? 0 : 1 - d * 0.22;
          } else { // tipping forward, out of the way
            const k = Math.min(1, -d);
            tf = `translate3d(0, ${(k * 16).toFixed(1)}%, ${(k * 140).toFixed(1)}px) rotateX(${(-k * 78).toFixed(1)}deg)`;
            op = 1 - k * 1.3;
          }
          card.style.transform = tf;
          card.style.opacity = Math.max(0, op).toFixed(3);
          card.style.zIndex = String(100 - i);
          card.classList.toggle("is-front", Math.abs(d) < 0.5);
        });
        caption(clamp(0, n - 1, Math.round(s)));
        if (bar) bar.style.transform = `scaleX(${p})`;
      }
      layout(0);
      if (reduced) return;
      const st = { p: 0 };
      gsap.to(st, {
        p: 1, ease: "none",
        onUpdate: () => layout(st.p),
        scrollTrigger: { trigger: sec, start: "top top", end: () => "+=" + window.innerHeight * (n - 1) * 0.75, pin: true, scrub: 0.6, invalidateOnRefresh: true },
      });
    });
  }

  /* ---- a ring of phones: scrolling turns it, bringing each screen to the
     front in colour while the others recede and dim ---- */
  function setupRing() {
    $$("[data-ring]").forEach((sec) => {
      const spin = $(".ring__spin", sec), items = $$(".ring__item", sec), n = items.length, step = n <= 6 ? 60 : 360 / n;
      const unique = +sec.dataset.ringUnique || n; // a short set is looped round the ring; scrolling turns through it once
      const videos = items.map((it) => $("video", it));
      const st = { p: 0 };
      let R = 0;
      const measure = () => { R = spin.offsetWidth * (window.innerWidth < 800 ? 1.35 : 1.6); };
      function layout(p) {
        const box = sec.getBoundingClientRect(), inView = box.bottom > 0 && box.top < window.innerHeight;
        const rot = -p * step * (unique - 1);
        spin.style.transform = `translateZ(${(-R).toFixed(1)}px) rotateX(-4deg) rotateY(${rot.toFixed(2)}deg)`;
        items.forEach((it, i) => {
          const a = i * step;
          const face = Math.cos(((a + rot) * Math.PI) / 180); // 1 = facing you
          it.style.transform = `rotateY(${a}deg) translateZ(${R.toFixed(1)}px)`;
          it.style.opacity = face < -0.1 ? "0" : (0.35 + 0.65 * Math.max(0, face)).toFixed(3);
          it.classList.toggle("is-front", face > 0.97);
          // only the recording facing you plays
          const v = videos[i];
          if (v) {
            if (inView && face > 0.6 && !reduced) { if (!v.src) v.src = v.dataset.src; if (v.paused) v.play().catch(() => {}); }
            else if (!v.paused) v.pause();
          }
        });
      }
      measure();
      layout(0);
      window.addEventListener("resize", () => { measure(); layout(st.p); });
      // start or stop the front recording as the ring comes and goes
      ScrollTrigger.create({ trigger: sec, start: "top bottom", end: "bottom top", onToggle: () => layout(st.p) });
      if (reduced) return;
      gsap.to(st, {
        p: 1, ease: "none",
        onUpdate: () => layout(st.p),
        scrollTrigger: {
          trigger: sec, start: "top top", end: () => "+=" + window.innerHeight * (unique - 1) * 0.45,
          pin: true, scrub: 0.7, invalidateOnRefresh: true,
          snap: { snapTo: 1 / (unique - 1), duration: { min: 0.25, max: 0.7 }, delay: 0.08, ease: "power2.inOut" }, // always settle on a phone facing you
        },
      });
    });
  }

  /* ========================================================================
     ABOUT
     ======================================================================== */
  function initScrollPage() {
    startLenis();
    const canvas = $(".blossom");
    const tree = canvas ? createBlossom(canvas) : null;
    setupModes(() => tree && tree.recolor());
    scrollBits();
    if (!tree) return;
    const chrome = [".bar", ".about-hero__jp", ".about-hero__gloss"];
    if (reduced) return tree.grow(0);
    gsap.set(chrome, { opacity: 0 });
    fontsReady.then(() => {
      tree.grow(4.2);
      gsap.to(chrome, { opacity: 1, duration: 1.4, ease: "power2.out", stagger: 0.15, delay: 1.2 });
    });
  }

  /* ---- mono no aware ----------------------------------------------------
     A sakura bonsai written in characters: a shallow pot on the quiet line,
     a twisting trunk in the dense end of the ramp, and flat cloud-pads of
     blossom (花 and 桜 thinning to ・). It grows up out of the soil, then
     opens, and is never quite still: the pads breathe, the blossoms shimmer,
     and every few seconds a breeze crosses it from one side. A blossom about
     to let go flushes red; its petal stays red only while it falls — the one
     moment of colour is the moment of passing — then rests on the rim or the
     line below, drifts when the wind passes, and fades. Move through the
     branches to shake petals loose; click for a gust. The same tree grows on
     every visit.
     ------------------------------------------------------------------------ */
  function createBlossom(canvas) {
    const ctx = canvas.getContext("2d");
    const BLOOM = ["・", "ヽ", "花", "桜"];
    const S = { t: 0, reveal: 0, mx: -1e4, my: -1e4, energy: 0, lastMove: 0, gust: 0, dir: 1, visible: true, spawn: 0, G: 0, next: 3, auto: [], hist: [] };
    let W = 0, H = 0, dpr = 1, cell = 12, cols = 0, rows = 0, ground = 0, ink = "#fff", accent = "#f00", bg = "#000";
    let wood = [], bloom = [], pot = [], petals = [], pending = [], rim = { l: 0, r: 0, row: 0 }, colG = new Float32Array(0);
    const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    const recolor = () => { ink = css("--ink"); accent = css("--accent"); bg = css("--bg"); };
    const seeded = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    function grow() {
      const rnd = seeded(151);
      const N = cols * rows;
      const woodD = new Float32Array(N), woodG = new Float32Array(N).fill(9);
      const bloomD = new Float32Array(N), bloomG = new Float32Array(N).fill(9), phase = new Float32Array(N);
      const put = (c, r, arr, v, G, g) => {
        if (r < 0 || c < 0 || r >= rows || c >= cols) return;
        const i = r * cols + c;
        if (v > arr[i]) arr[i] = v;
        if (g < G[i]) G[i] = g;
      };
      // one tapered stroke; g is when it grows in (0 … ~1.4 of the reveal)
      const stroke = (x1, y1, x2, y2, w1, w2, g1, g2) => {
        const m = Math.max(w1, w2);
        const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
        for (let r = Math.floor(Math.min(y1, y2) - m); r <= Math.ceil(Math.max(y1, y2) + m); r++)
          for (let c = Math.floor(Math.min(x1, x2) - m); c <= Math.ceil(Math.max(x1, x2) + m); c++) {
            const t = clamp(0, 1, ((c - x1) * dx + (r - y1) * dy) / L2);
            const d = Math.hypot(c - (x1 + dx * t), r - (y1 + dy * t));
            const half = (w1 + (w2 - w1) * t) / 2 + 0.45;
            if (d < half) put(c, r, woodD, clamp(0.3, 1, 1 - (d / half) * 0.6), woodG, g1 + (g2 - g1) * t);
          }
      };
      // a cloud-pad: a few domed lobes with a flat underside, the way bonsai are pruned
      const pad = (x, y, w, h, g) => {
        const lobes = Math.max(3, Math.round(w / (h * 1.8))) + ((rnd() * 2) | 0), floor = y + h * 0.32, padPh = rnd() * 6.283;
        for (let k = 0; k < lobes; k++) {
          const u = k / (lobes - 1) - 0.5;
          const lx = x + u * w * 0.62 + (rnd() - 0.5) * w * 0.08;
          const ly = y - h * (0.18 - Math.abs(u) * 0.3) + (rnd() - 0.5) * h * 0.15;
          const rx = w * (0.26 + rnd() * 0.06), ry = h * (0.5 + rnd() * 0.12);
          for (let r = Math.floor(ly - ry - 1); r <= floor; r++)
            for (let c = Math.floor(lx - rx - 1); c <= lx + rx + 1; c++) {
              let v = (r - ly) / ry;
              if (v > 0) v *= 1.6;
              const val = 1 - Math.hypot((c - lx) / rx, v) + (rnd() - 0.5) * 0.4;
              if (val <= 0) continue;
              if (r >= 0 && c >= 0 && r < rows && c < cols && Math.min(1, val * 1.25) > bloomD[r * cols + c]) phase[r * cols + c] = padPh;
              put(c, r, bloomD, Math.min(1, val * 1.25), bloomG, g + 0.04 + rnd() * 0.42);
            }
        }
      };

      // fill the screen: from just under the bar down to the line, and out to the sides —
      // stopping short of 物の哀れ where it stands beside the tree
      const portrait = H > W * 1.2;
      const box = canvas.getBoundingClientRect(), jp = $(".about-hero__jp");
      const L0 = 2, R0 = portrait || !jp ? cols - 2 : Math.floor((jp.getBoundingClientRect().left - box.left) / cell) - 2;
      const avail = ground - Math.ceil((W < 800 ? 72 : 88) / cell); // rows between the bar and the line
      const Sy = (avail - 1.6) / 1.22;
      const Sx = Math.min((R0 - L0) / 1.48, Sy * 1.7); // horizontal reach: branch lengths, pad widths
      const Sm = Math.min(Sx, Sy); // thickness
      const Sp = Math.min(Sx * 1.35, Sy); // pad depth: a little deeper on a tall screen
      const potH = Math.max(3, Math.round(Sm * 0.12)), halfW = Math.round(Math.min(Sx * 0.3, Sy * 0.42));
      const crown = 0.2 * Sp;
      const TH = avail - 1.6 - potH - crown * 1.02; // the trunk takes whatever height is left
      const bx = (L0 + R0) / 2 + Sx * 0.24; // the canopy leans left, so centre it rather than the pot
      const cx = Math.round(bx - Sx * 0.08); // the trunk sits a little off-centre in its pot

      // the pot: a lipped rim, a body that tapers in, two small feet on the line
      pot = [];
      const rimRow = ground - 1 - potH;
      rim = { l: (cx - halfW - 1) * cell, r: (cx + halfW + 2) * cell, row: rimRow };
      for (let c = cx - halfW - 1; c <= cx + halfW + 1; c++) pot.push({ c, r: rimRow, k: 4, a: 0.8 });
      for (let j = 1; j < potH; j++) {
        const inset = Math.round((j / potH) * 1.6);
        for (let c = cx - halfW + inset; c <= cx + halfW - inset; c++) {
          const edge = c === cx - halfW + inset || c === cx + halfW - inset;
          pot.push({ c, r: rimRow + j, k: edge ? 4 : 2, a: edge ? 0.7 : 0.42 });
        }
      }
      for (const f of [cx - halfW + 3, cx + halfW - 5]) for (let c = f; c < f + 3; c++) pot.push({ c, r: ground - 1, k: 5, a: 0.7 });
      // moss at the foot of the trunk
      for (let c = Math.round(bx - Sm * 0.2); c <= bx + Sm * 0.18; c++) if (rnd() < 0.55) pot.push({ c, r: rimRow - 1, k: 0, a: 0.25 + rnd() * 0.2 });

      // the trunk: an S-curve, thick and flared at the base, tapering to an apex above its roots;
      // a tall screen gets a taller trunk with more bends
      const soil = rimRow - 0.6;
      const f = 1.8 * clamp(1, 1.6, TH / (0.9 * Sm));
      const tx = (t) => bx + Sx * 0.2 * (-Math.sin(f * Math.PI * t) * (1 - 0.4 * t) + Math.sin(f * Math.PI) * 0.6 * t);
      const ty = (t) => soil - TH * t;
      const w0 = Math.max(2.2, Sm * 0.12, TH * 0.065);
      const tw = (t) => w0 * (1 - 0.6 * t) * (1 + 0.8 * Math.exp(-t * 12));
      const tg = (t) => 0.06 + t * 0.56;
      const STEPS = 40;
      for (let k = 0; k < STEPS; k++) {
        const a = k / STEPS, b = (k + 1) / STEPS;
        stroke(tx(a), ty(a), tx(b), ty(b), tw(a), tw(b), tg(a), tg(b));
      }
      // surface roots, reaching along the soil
      stroke(bx, soil, bx - w0 * 1.5, soil + 0.2, w0 * 0.55, 0.6, 0.05, 0.12);
      stroke(bx, soil, bx + w0 * 1.1, soil + 0.2, w0 * 0.45, 0.6, 0.05, 0.12);

      // branches alternating left and right, shorter as they rise; each carries a pad.
      // more tiers when the trunk is tall, so the height is filled with blossom, not bare wood
      const n = clamp(4, 6, Math.round(TH / (Sm * 0.23)));
      for (let i = 0; i < n; i++) {
        const q = i / (n - 1);
        const L = { t: 0.24 + q * 0.58, side: i % 2 ? 1 : -1, len: 0.62 - q * 0.36, rise: -0.1 + q * 0.3, pw: 0.62 - q * 0.3, ph: 0.2 - q * 0.06 };
        const x0 = tx(L.t), y0 = ty(L.t), len = L.len * Sx, g0 = tg(L.t);
        const bxAt = (s) => x0 + L.side * len * s;
        const byAt = (s) => y0 - len * (L.rise * s - 0.08 * Math.sin(Math.PI * s) + 0.12 * s * s * s) * Math.min(1, Sm / Sx * 1.3);
        const bw = (s) => Math.max(0.7, tw(L.t) * 0.42 * (1 - s * 0.75));
        const bgAt = (s) => g0 + s * 0.26;
        for (let k = 0; k < 12; k++) {
          const a = k / 12, b = (k + 1) / 12;
          stroke(bxAt(a), byAt(a), bxAt(b), byAt(b), bw(a), bw(b), bgAt(a), bgAt(b));
        }
        // a few twigs up into the pad
        for (const s of [0.45, 0.72, 0.92]) {
          const ang = Math.PI / 2 - L.side * (0.5 + rnd() * 0.5), tl = Sm * (0.07 + rnd() * 0.05);
          stroke(bxAt(s), byAt(s), bxAt(s) + Math.cos(ang) * tl, byAt(s) - Math.sin(ang) * tl, 0.8, 0.5, bgAt(s), bgAt(s) + 0.08);
        }
        const ph = L.ph * Sp;
        pad(bxAt(0.62), byAt(0.62) - ph * 0.28, L.pw * Sx, ph, bgAt(0.62));
      }
      // the crown
      pad(tx(1), ty(1) - crown * 0.2, 0.4 * Sx, crown, tg(1));

      wood = []; bloom = []; pending = [];
      for (let i = 0; i < N; i++) {
        const c = i % cols, r = (i / cols) | 0, h = clamp(0, 1, (soil - r) / TH);
        const bd = bloomD[i], wd = woodD[i];
        if (bd > 0.1 && bd > wd * 0.8) bloom.push({ c, r, d: bd, h, o: bloomG[i], ph: phase[i] + (rnd() - 0.5) * 0.6, blush: 0, lost: -99 });
        else if (wd > 0.05 && r < rimRow) wood.push({ c, r, d: wd, h, g: woodG[i], k: clamp(3, 7, 3 + Math.floor(wd * 5 + (rnd() - 0.5) * 1.6)) });
      }
    }

    function layout() {
      const box = canvas.getBoundingClientRect();
      W = box.width; H = box.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cell = W < 800 ? 9 : 12;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      cols = Math.floor(W / cell);
      rows = Math.floor(H / cell);
      ground = Math.round(rows * (H > W * 1.2 ? 0.86 : 0.88)); // the line, just above the gloss
      grow();
    }

    // wind. Gusts come on their own every few seconds (and from your pointer) and travel
    // across the tree from the side they blow from, so the pads lean one after another.
    // colG[c] is the wind at column c right now; S.G is the wind at its source.
    const shape = (u) => (u <= 0 ? 0 : (u / 1.1) ** 2 * Math.exp(2 * (1 - u / 1.1))); // rises for ~1s, dies over ~3s
    function sampleG(tq) {
      const h = S.hist;
      if (!h.length || tq <= h[0]) return h[1] || 0;
      let lo = 0, hi = h.length / 2 - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (h[m * 2] <= tq) lo = m; else hi = m - 1; }
      return h[lo * 2 + 1];
    }
    function wind() {
      if (S.t > S.next && S.reveal > 1.2 && !reduced) {
        S.auto.push({ t0: S.t, amp: 0.35 + Math.random() * 0.45 });
        if (S.energy < 0.1) S.dir = Math.random() < 0.7 ? 1 : -1;
        S.next = S.t + 5 + Math.random() * 7;
      }
      S.auto = S.auto.filter((a) => S.t - a.t0 < 9);
      S.G = Math.min(1.2, S.gust + S.auto.reduce((sum, a) => sum + a.amp * shape(S.t - a.t0), 0));
      S.hist.push(S.t, S.G);
      while (S.hist.length > 4 && S.hist[0] < S.t - 2) S.hist.splice(0, 2);
      if (colG.length !== cols) colG = new Float32Array(cols);
      for (let c = 0; c < cols; c++) colG[c] = sampleG(S.t - (S.dir > 0 ? c / cols : 1 - c / cols) * 0.9);
    }

    // the trunk is stiff and only leans near the top; each pad breathes on its own phase and
    // gives more to the wind
    const woodX = (w) => (Math.sin(S.t * 0.8 + w.r * 0.15) * 0.7 + colG[w.c] * S.dir * 9) * w.h * w.h;
    const bloomX = (b) => (Math.sin(S.t * 0.8 + b.r * 0.15) * 0.7 + Math.sin(S.t * 1.3 + b.ph) * 1.2
      + colG[b.c] * S.dir * (9 + 3 * Math.sin(S.t * 7 + b.ph))) * (0.35 + 0.65 * b.h);
    const bloomY = (b) => Math.sin(S.t * 1.1 + b.ph * 1.3) * 0.9 + colG[b.c] * 1.5;

    // a blossom lets go of a petal, and stays a little dimmer for a while after
    function release(b) {
      petals.push({ x: b.c * cell + bloomX(b), y: b.r * cell + bloomY(b), vx: (Math.random() - 0.3) * 24, vy: 8 + Math.random() * 18,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 3.5, g: Math.random() < 0.5 ? 0 : 1, seed: Math.random() * 10, landed: 0, life: 1 });
      b.lost = S.t;
      if (petals.length > 480) petals.splice(0, petals.length - 480);
    }
    // shaken loose: straight away
    function let_go(n, near) {
      const pool = near ? bloom.filter((b) => Math.hypot(b.c * cell - S.mx, b.r * cell - S.my) < 90) : bloom;
      for (let k = 0; k < n && pool.length; k++) release(pool[(Math.random() * pool.length) | 0]);
    }
    // on its own: the blossom flushes red for a moment first, then lets go
    function blush(n) {
      for (let k = 0; k < n && bloom.length && pending.length < 60; k++) {
        const b = bloom[(Math.random() * bloom.length) | 0];
        if (b.blush || b.o > S.reveal) continue;
        b.blush = S.t;
        pending.push(b);
      }
    }

    function update(dt) {
      if (S.reveal < 1.25 || reduced) return;
      if (performance.now() - S.lastMove > 1000) S.energy += (0 - S.energy) * Math.min(1, dt * 3);
      S.gust *= Math.exp(-dt * 1.1);
      S.spawn += dt * (1.2 + S.energy * 20 + S.G * 10) * Math.max(1, bloom.length / 1500);
      const n = S.spawn | 0;
      if (n) { S.spawn -= n; if (S.energy > 0.2) let_go(n, true); else blush(n); }
      pending = pending.filter((b) => {
        if (S.t - b.blush < 0.9) return true;
        release(b);
        b.blush = 0;
        return false;
      });
      for (const p of petals) {
        if (!p.landed) {
          const wind = 14 + S.G * S.dir * 140 + Math.sin(S.t * 1.3 + p.seed) * 18;
          p.vx += (wind - p.vx) * Math.min(1, dt * 1.4);
          p.vy += (36 + Math.sin(S.t * 2 + p.seed) * 8 - p.vy) * Math.min(1, dt * 0.9);
          p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          // rest on the pot's rim if it's underneath, otherwise on the line
          const onPot = p.x + cell / 2 > rim.l && p.x + cell / 2 < rim.r && p.y < rim.row * cell;
          const floor = onPot ? (rim.row - 0.8) * cell + (p.seed % 1) * 3 : ground * cell - 2 + (p.seed % 1) * 8;
          if (p.y >= floor) { p.landed = S.t; p.y = floor; }
        } else {
          // fallen petals slide a little when the wind passes over them — off the rim, they fall again
          const g = colG[clamp(0, cols - 1, Math.floor((p.x + cell / 2) / cell))] || 0;
          p.x += g * S.dir * 22 * dt;
          p.rot += g * S.dir * 1.5 * dt;
          if (p.y < (ground - 1) * cell && (p.x + cell / 2 < rim.l || p.x + cell / 2 > rim.r)) p.landed = 0;
          else if (S.t - p.landed > 4) p.life -= dt * 0.35;
        }
      }
      petals = petals.filter((p) => p.life > 0 && p.x < W + 30);
    }

    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!cols) return;
      const cs = Math.ceil(cell * dpr), half = cs / 2;
      const inkW = glyphs(cs, ink), inkB = glyphs(cs, ink, BLOOM), redB = glyphs(cs, accent, BLOOM);
      // the quiet line the pot stands on — the same ー as the wave's silence
      ctx.globalAlpha = 0.28;
      for (let c = 0; c < cols; c++) ctx.drawImage(inkW[1], c * cs, ground * cs);
      // the pot, first
      const potIn = clamp(0, 1, S.reveal / 0.12);
      for (const q of pot) {
        ctx.globalAlpha = q.a * potIn;
        ctx.drawImage(inkW[q.k], q.c * cell * dpr, q.r * cs);
      }
      // the trunk rises out of the soil, the branches reach out from it
      for (const w of wood) {
        if (w.g > S.reveal) continue;
        ctx.globalAlpha = (0.35 + 0.65 * w.d) * clamp(0, 1, (S.reveal - w.g) * 12);
        ctx.drawImage(inkW[w.k], (w.c * cell + woodX(w)) * dpr, w.r * cs);
      }
      // then the pads open
      const R2 = 100 * 100;
      for (const b of bloom) {
        if (b.o > S.reveal) continue;
        const x = b.c * cell + bloomX(b), y = b.r * cell + bloomY(b);
        const near = S.energy > 0.05 ? Math.exp(-((x - S.mx) ** 2 + (y - S.my) ** 2) / R2) * S.energy : 0;
        // a slow shimmer through the pads, and a flutter wherever the wind is passing
        const lvl = b.d * 3.4 + near + Math.sin(S.t * 0.6 + b.ph * 3 + b.c * 0.21) * 0.45 + colG[b.c] * Math.sin(S.t * 10 + b.o * 60) * 1.1;
        const idx = clamp(0, 3, Math.floor(lvl));
        const k = b.blush ? clamp(0, 1, (S.t - b.blush) / 0.9) : 0; // flushing red, about to let go
        const base = (0.18 + 0.55 * b.d) * (1 - 0.55 * Math.exp(-(S.t - b.lost) / 2.5)) * clamp(0, 1, (S.reveal - b.o) * 6);
        const red = near > 0.35 || k > 0.25;
        ctx.globalAlpha = near > 0.35 ? 0.85 : base + (0.9 - base) * k;
        ctx.drawImage((red ? redB : inkB)[idx], x * dpr, y * dpr);
      }
      // petals: red while they fall, ink once they have landed, then gone
      for (const p of petals) {
        const falling = !p.landed;
        ctx.globalAlpha = (falling ? 0.9 : 0.55) * p.life;
        const c = Math.cos(p.rot), s = Math.sin(p.rot);
        ctx.setTransform(c, s, -s, c, p.x * dpr + half, p.y * dpr + half);
        ctx.drawImage((falling ? redB : inkB)[p.g], -half, -half);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    }

    // interaction
    const hero = canvas.parentElement;
    let lx = 0, lt = 0;
    hero.addEventListener("pointermove", (e) => {
      const box = canvas.getBoundingClientRect();
      const x = e.clientX - box.left, y = e.clientY - box.top;
      const dt = Math.max(8, e.timeStamp - lt), speed = Math.abs(x - lx) / dt * 1000;
      if (Math.abs(x - lx) > 2) S.dir = Math.sign(x - lx);
      S.gust = Math.min(1, S.gust + speed / 9000);
      lx = x; lt = e.timeStamp;
      S.mx = x; S.my = y; S.energy = 1; S.lastMove = performance.now();
    });
    hero.addEventListener("pointerleave", () => (S.energy = 0));
    hero.addEventListener("pointerdown", (e) => {
      if (e.target.closest("a, button") || reduced) return;
      S.gust = 1;
      let_go(30, false);
    });
    new IntersectionObserver((es) => (S.visible = es[0].isIntersecting)).observe(hero);

    recolor();
    layout();
    window.addEventListener("resize", layout);
    fontsReady.then(() => layout()); // redraw once the Japanese font has arrived

    const controls = $(".controls");
    gsap.ticker.add((time, dt) => {
      if (controls) {
        const f = clamp(0, 1, 1 - window.scrollY / (window.innerHeight * 0.5));
        controls.style.opacity = f;
        controls.style.pointerEvents = f < 0.2 ? "none" : "";
      }
      if (!S.visible) return;
      if (!reduced) S.t += dt / 1000;
      wind();
      update(Math.min(0.05, dt / 1000));
      draw();
    });

    return {
      recolor: () => { recolor(); },
      grow: (duration) => (duration ? gsap.to(S, { reveal: 1.6, duration, ease: "sine.inOut" }) : (S.reveal = 1.6)),
    };
  }


  /* ========================================================================
     PROJECT PAGES — the name, written in characters, breaks apart into
     the key screens; then the story, in the home page's voice.
     ======================================================================== */
  function initProject() {
    startLenis();
    window.scrollTo(0, 0);
    const hero = $(".proj-hero");
    const field = createTitleField($(".wave"), hero.dataset.title, hero.dataset.jp);
    setupModes(() => field.recolor());

    // the title lands on the key screens (a row) or, on Cue, on the front phone of the ring
    const land = $(".proj-land") || $(".ring__item .ring__phone");
    const landImgs = $$(".thumb img", land);
    const landDecoders = landImgs.map(makeDecoder); // fallback if the break-apart can't run
    const others = $$(".ring__item:not(:first-child) .ring__phone"); // the rest of the ring fades in as the characters settle
    // on a ring, the landing finishes exactly as the ring locks in place
    const ring = land.closest(".ring");
    const endAt = ring ? () => (ring.closest(".pin-spacer") || ring).getBoundingClientRect().top + window.scrollY : null;
    field.adopt(land, landImgs, others, $$("video", land), endAt).then((ok) => {
      if (!ok) others.forEach((el) => (el.style.opacity = ""));
      if (ok) return;
      const io = new IntersectionObserver((es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        landDecoders.forEach((d, i) => d.reveal(i * 0.07));
      }, { threshold: 0.2 });
      io.observe(land);
    });

    setupCrates();
    setupRing();
    scrollBits();
    colorFocus();

    const chrome = [".bar", ".proj-hero__title", ".proj-hero__hint"].filter((sel) => $(sel));
    if (reduced) { field.reveal(0); return; }
    gsap.set(chrome, { opacity: 0 });
    fontsReady.then(() => {
      field.reveal(1.8);
      gsap.to(chrome, { opacity: 1, duration: 1.2, ease: "power2.out", stagger: 0.1, delay: 0.8 });
      field.showControls(1.2);
    });
  }

  /* ---- the title field ---------------------------------------------------
     The project's name (and its Japanese word) drawn on the character grid.
     It tunes in on arrival, shimmers, and leans away from your pointer —
     the characters you touch turn red. Scrolling hands it to the break-apart.
     ------------------------------------------------------------------------ */
  function createTitleField(canvas, title, jp) {
    const ctx = canvas.getContext("2d");
    const S = { t: 0, reveal: 0, mx: -1e4, my: -1e4, energy: 0, energyT: 0, lastMove: 0 };
    let W = 0, H = 0, dpr = 1, cell = 13, cols = 0, rows = 0, cov = null, order = null, ink = "#fff", accent = "#f00", bg = "#000";
    const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
    const ba = createBreakApart({ ctx, canvas, W: () => W, H: () => H, dpr: () => dpr, cell: () => cell, colors: () => ({ ink, accent, bg }), time: () => S.t });
    const recolor = () => { ink = css("--ink"); accent = css("--accent"); bg = css("--bg"); ba.invalidate(); };

    function layout() {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cell = W < 800 ? 9 : 13;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      cols = Math.floor(W / cell);
      rows = Math.floor(H / cell);
      // render the words at grid resolution; each cell's coverage becomes a character
      const oc = document.createElement("canvas");
      oc.width = cols; oc.height = rows;
      const o = oc.getContext("2d", { willReadFrequently: true });
      // one line if it stays large, otherwise break long names onto two lines
      const fit = (lines, cap) => {
        o.font = `400 100px "Instrument Serif", serif`;
        const widest = Math.max(...lines.map((l) => o.measureText(l).width));
        return Math.min(cap, (100 * cols * 0.84) / widest);
      };
      let lines = [title], size = fit(lines, rows * 0.36);
      if (size < rows * 0.26 && title.includes(" ")) {
        const two = title.split(" ");
        lines = [two.slice(0, Math.ceil(two.length / 2)).join(" "), two.slice(Math.ceil(two.length / 2)).join(" ")];
        size = fit(lines, rows * 0.3);
      }
      const lh = size * 0.92, js = Math.max(9, size * 0.34);
      const block = lines.length * lh + js * 1.3;
      let cy = rows * 0.44 - block / 2 + lh / 2;
      o.fillStyle = o.strokeStyle = "#fff";
      o.textAlign = "center";
      o.textBaseline = "middle";
      o.font = `400 ${size}px "Instrument Serif", serif`;
      o.lineWidth = Math.max(0.6, size * 0.035);
      for (const l of lines) { o.fillText(l, cols / 2, cy); o.strokeText(l, cols / 2, cy); cy += lh; }
      o.font = `800 ${js}px "Shippori Mincho", serif`;
      o.fillText(jp, cols / 2, cy - lh / 2 + size * 0.5 + js * 0.75);
      const d = o.getImageData(0, 0, cols, rows).data;
      cov = new Float32Array(cols * rows);
      order = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) { cov[i] = d[i * 4 + 3] / 255; order[i] = Math.random(); }
      ba.invalidate();
    }

    function draw() {
      ctx.globalAlpha = 1;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ba.reset();
      if (!cov) return;
      const cs = Math.ceil(cell * dpr), inkSet = glyphs(cs, ink), redSet = glyphs(cs, accent);
      const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
      const tick = Math.floor(S.t * 12), R2 = 130 * 130;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c, I = cov[i];
          if (I < 0.08 || order[i] > S.reveal) continue;
          let x = ox + c * cell, y = oy + r * cell;
          const dx = x - S.mx, dy = y - S.my, d2 = dx * dx + dy * dy;
          const near = d2 < R2 * 5 ? Math.exp(-d2 / R2) * S.energy : 0;
          if (near > 0.01) { const len = Math.sqrt(d2) || 1; x += (dx / len) * near * 18; y += (dy / len) * near * 18; }
          let idx = Math.floor(I * 7.99 + 0.8 * Math.sin(S.t * 1.3 + hash(c, r) * 6.283) + near * 2);
          if (S.reveal < 1 && order[i] > S.reveal - 0.12) idx = (hash(c, r + tick) * 8) | 0; // still tuning in
          idx = clamp(0, 7, idx);
          const a = 0.25 + 0.75 * I, red = near > 0.35;
          ctx.globalAlpha = a;
          ctx.drawImage((red ? redSet : inkSet)[idx], x * dpr, y * dpr);
          ba.record(x, y, idx, a, red);
        }
      }
      ctx.globalAlpha = 1;
    }

    recolor();
    fontsReady.then(layout);
    window.addEventListener("resize", () => cov && layout());
    window.addEventListener("pointermove", (e) => { S.mx = e.clientX; S.my = e.clientY; S.energyT = 1; S.lastMove = performance.now(); });
    document.addEventListener("pointerleave", () => (S.energyT = 0));

    const hero = $(".proj-hero"), controls = $(".controls");
    const controlsIn = { v: reduced ? 1 : 0 };
    gsap.ticker.add((time, dt) => {
      if (!reduced) S.t += dt / 1000;
      if (performance.now() - S.lastMove > 1200) S.energyT = 0;
      S.energy += (S.energyT - S.energy) * 0.06;
      const p = ba.ok ? ba.progress() : clamp(0, 1, window.scrollY / (H * 0.85));
      hero.style.opacity = clamp(0, 1, 1 - p * 4);
      if (controls) {
        controls.style.opacity = String(clamp(0, 1, 1 - (p - 0.2) * 4) * controlsIn.v);
        controls.style.pointerEvents = p > 0.4 ? "none" : "";
      }
      if (!ba.frame(p)) {
        if (!ba.ok) canvas.style.opacity = 1 - p;
        draw();
      }
    });

    return {
      recolor,
      reveal: (duration) => (duration ? gsap.to(S, { reveal: 1, duration, ease: "power1.inOut" }) : (S.reveal = 1)),
      showControls: (delay) => gsap.to(controlsIn, { v: 1, duration: 1.2, delay, ease: "power2.out" }),
      adopt: (row, imgs, fades, followers, endAt) => ba.adopt(row, imgs, fades, followers, endAt),
    };
  }
})();

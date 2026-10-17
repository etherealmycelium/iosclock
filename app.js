(() => {
  "use strict";

  const DEFAULTS = Object.freeze({
    brightness: 35,
    twentyFourHour: false,
    leadingZero: false,
    seconds: false,
    keepAwake: true,
    bouncing: true,
    speed: 2,
    size: 78,
    changeColour: false,
    colour: "white"
  });
  const STORAGE_KEY = "bouncy-clock-settings-v1";
  const PALETTE = {white: "#ffffff", warm: "#ffdcb4", amber: "#ffac5f", mint: "#9be3ce"};
  const SPEEDS = {1: 23, 2: 38, 3: 56, 4: 79, 5: 110};
  const SPEED_LABELS = {1: "Gentle", 2: "Normal", 3: "Brisk", 4: "Fast", 5: "Very fast"};
  const COLOUR_CYCLE = ["white", "warm", "amber", "mint"];
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const field = $("travel-area");
  const clock = $("clock");
  const time = $("time");
  const period = $("period");
  const dialogLayer = $("dialog-layer");
  const dialog = $("settings-dialog");
  const settingsButton = $("settings-button");
  const wakeMessage = $("wake-message");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function loadSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const loaded = {...DEFAULTS};
      for (const [k, fallback] of Object.entries(DEFAULTS)) {
        if (typeof raw[k] === typeof fallback) loaded[k] = raw[k];
      }
      loaded.brightness = clamp(loaded.brightness, 4, 100);
      loaded.size = clamp(loaded.size, 48, 94);
      loaded.speed = Math.round(clamp(loaded.speed, 1, 5));
      if (!(loaded.colour in PALETTE)) loaded.colour = "white";
      return loaded;
    } catch { return {...DEFAULTS}; }
  }
  const settings = loadSettings();
  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }

  // Bouncing only affects the clock, never the settings or controls.
  const motion = {x:0,y:0,vx:1,vy:0.79,maxX:0,maxY:0,w:0,h:0,initialized:false,lastFrame:0};
  let screenLock = null;
  let clockText = "";
  let resizeTimer = 0;
  let controlsTimer = 0;
  let toastTimer = 0;
  let down = null;

  function formattedTime(date) {
    let hour = date.getHours();
    let suffix = "";
    if (!settings.twentyFourHour) {
      suffix = hour >= 12 ? "PM" : "AM";
      hour = (hour % 12) || 12;
    }
    let h = String(hour);
    if (settings.leadingZero) h = h.padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = settings.seconds ? `:${String(date.getSeconds()).padStart(2, "0")}` : "";
    return {main: `${h}:${m}${s}`, suffix};
  }
  function updateTime(force = false) {
    const f = formattedTime(new Date());
    const text = `${f.main}|${f.suffix}`;
    if (force || text !== clockText) {
      time.textContent = f.main;
      period.textContent = f.suffix;
      clockText = text;
      fitClock();
    }
  }

  function fitClock() {
    const beforeMaxX = motion.maxX;
    const beforeMaxY = motion.maxY;
    const relX = beforeMaxX > 0 ? motion.x / beforeMaxX : .5;
    const relY = beforeMaxY > 0 ? motion.y / beforeMaxY : .5;

    // Measure using a known size so AM/PM, seconds and 24h all fit correctly.
    clock.style.fontSize = "100px";
    const natural = Math.max(1, clock.getBoundingClientRect().width);
    const wantedWidth = field.clientWidth * settings.size / 100;
    const wantedFont = Math.min(100 * wantedWidth / natural, field.clientHeight * .65);
    clock.style.fontSize = `${Math.max(15, wantedFont)}px`;

    const rect = clock.getBoundingClientRect();
    motion.w = rect.width;
    motion.h = rect.height;
    motion.maxX = Math.max(0, field.clientWidth - motion.w);
    motion.maxY = Math.max(0, field.clientHeight - motion.h);

    if (!motion.initialized) {
      motion.x = motion.maxX / 2;
      motion.y = motion.maxY / 2;
      motion.initialized = true;
    } else {
      motion.x = clamp(relX * motion.maxX, 0, motion.maxX);
      motion.y = clamp(relY * motion.maxY, 0, motion.maxY);
    }
    draw();
  }
  function draw() {
    clock.style.transform = `translate3d(${motion.x.toFixed(2)}px,${motion.y.toFixed(2)}px,0)`;
  }

  function brightness(value) {
    settings.brightness = clamp(Math.round(value), 4, 100);
    clock.style.setProperty("--display-opacity", String(settings.brightness / 100));
    $("brightness").value = settings.brightness;
    $("brightness-value").textContent = `${settings.brightness}%`;
    paintTrack($("brightness"));
    saveSettings();
  }
  function updateInk(colour = settings.colour) {
    clock.style.setProperty("--clock-ink", PALETTE[colour]);
    document.querySelectorAll(".colour-swatch").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.colour === settings.colour));
    });
  }
  function paintTrack(input) {
    const low = Number(input.min), high = Number(input.max);
    input.style.setProperty("--range-fill", `${100 * (Number(input.value) - low) / (high - low)}%`);
  }
  function cornerCelebration() {
    const toast = $("corner-toast");
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 1200);
  }
  function onBounce(horizontal, vertical) {
    if (settings.changeColour) {
      const index = COLOUR_CYCLE.indexOf(motion.colour || settings.colour);
      motion.colour = COLOUR_CYCLE[(index + 1) % COLOUR_CYCLE.length];
      updateInk(motion.colour);
    }
    if (horizontal && vertical) cornerCelebration();
  }
  function animate(t) {
    requestAnimationFrame(animate);
    if (document.hidden) { motion.lastFrame = t; return; }
    // Throttle drawing to ~30fps to save battery versus a perpetual 60fps animation.
    if (t - motion.lastFrame < 1000 / 30) return;
    const dt = motion.lastFrame ? Math.min(.08, (t - motion.lastFrame) / 1000) : 0;
    motion.lastFrame = t;
    if (!settings.bouncing || dialogLayer.hidden === false) return;

    const speed = SPEEDS[settings.speed];
    let dx = motion.vx * speed * dt;
    let dy = motion.vy * speed * dt;
    let horizontal = false, vertical = false;

    // Reflect with overshoot to avoid sticking at a boundary during orientation changes.
    if (motion.maxX > 0) {
      motion.x += dx;
      if (motion.x <= 0 || motion.x >= motion.maxX) {
        horizontal = true;
        if (motion.x < 0) motion.x = -motion.x;
        else motion.x = 2 * motion.maxX - motion.x;
        motion.vx = -motion.vx;
      }
      motion.x = clamp(motion.x, 0, motion.maxX);
    } else { motion.x = 0; }
    if (motion.maxY > 0) {
      motion.y += dy;
      if (motion.y <= 0 || motion.y >= motion.maxY) {
        vertical = true;
        if (motion.y < 0) motion.y = -motion.y;
        else motion.y = 2 * motion.maxY - motion.y;
        motion.vy = -motion.vy;
      }
      motion.y = clamp(motion.y, 0, motion.maxY);
    } else { motion.y = 0; }
    if (horizontal || vertical) onBounce(horizontal, vertical);
    draw();
  }

  function setControlsShown(shown, duration = 4500) {
    clearTimeout(controlsTimer);
    stage.classList.toggle("controls-visible", shown);
    if (shown && dialogLayer.hidden) {
      controlsTimer = setTimeout(() => stage.classList.remove("controls-visible"), duration);
    }
  }
  function showSettings() {
    dialogLayer.hidden = false;
    stage.classList.remove("controls-visible", "show-tip");
    clearTimeout(controlsTimer);
    dialog.focus();
    requestWakeLock(); // An interaction can unlock iOS's wake lock permission.
  }
  function hideSettings() {
    dialogLayer.hidden = true;
    settingsButton.focus({preventScroll:true});
    setControlsShown(true, 1800);
    motion.lastFrame = 0;
  }

  async function releaseWakeLock() {
    const held = screenLock;
    screenLock = null;
    if (held) { try { await held.release(); } catch {} }
  }
  async function requestWakeLock() {
    if (!settings.keepAwake || document.hidden || screenLock) return;
    if (!("wakeLock" in navigator)) {
      wakeMessage.textContent = "Screen wake lock isn't available in this browser. Increase Auto-Lock manually if needed.";
      return;
    }
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (!settings.keepAwake || document.hidden) { await lock.release(); return; }
      screenLock = lock;
      lock.addEventListener("release", () => { if (screenLock === lock) screenLock = null; });
      wakeMessage.textContent = "";
    } catch {
      wakeMessage.textContent = "iOS didn't allow the screen wake lock. Keep the app in front, or adjust Auto-Lock in iPhone Settings.";
    }
  }
  function wireToggle(id, key, after) {
    const input = $(id);
    input.checked = settings[key];
    input.addEventListener("change", () => {
      settings[key] = input.checked;
      saveSettings();
      after?.();
    });
  }
  function wireSlider(id, key, update) {
    const input = $(id);
    input.value = settings[key];
    paintTrack(input);
    input.addEventListener("input", () => {
      settings[key] = Number(input.value);
      paintTrack(input);
      update();
      saveSettings();
    });
  }
  function bindSettings() {
    wireSlider("brightness", "brightness", () => brightness(settings.brightness));
    brightness(settings.brightness);
    wireToggle("use-24h", "twentyFourHour", () => updateTime(true));
    wireToggle("leading-zero", "leadingZero", () => updateTime(true));
    wireToggle("show-seconds", "seconds", () => updateTime(true));
    wireToggle("stay-awake", "keepAwake", () => {
      if (settings.keepAwake) requestWakeLock();
      else { wakeMessage.textContent = ""; releaseWakeLock(); }
    });
    wireToggle("bounce", "bouncing", () => {motion.lastFrame = 0;});
    wireToggle("change-colour", "changeColour", () => {
      motion.colour = settings.colour;
      updateInk();
    });
    wireSlider("speed", "speed", () => { $("speed-value").textContent = SPEED_LABELS[settings.speed]; });
    $("speed-value").textContent = SPEED_LABELS[settings.speed];
    wireSlider("size", "size", () => { $("size-value").textContent = `${settings.size}%`; fitClock(); });
    $("size-value").textContent = `${settings.size}%`;
    document.querySelectorAll(".colour-swatch").forEach(button => {
      button.addEventListener("click", () => {
        settings.colour = button.dataset.colour;
        motion.colour = settings.colour;
        updateInk();
        saveSettings();
      });
    });
    updateInk();
    settingsButton.addEventListener("click", showSettings);
    $("close-button").addEventListener("click", hideSettings);
    $("dialog-backdrop").addEventListener("click", hideSettings);
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !dialogLayer.hidden) hideSettings();
      if (ev.key === " " && dialogLayer.hidden) { ev.preventDefault(); setControlsShown(true); }
    });
    // Keep focus inside the modal (for keyboard and accessibility users).
    dialog.addEventListener("keydown", (ev) => {
      if (ev.key !== "Tab") return;
      const all = [...dialog.querySelectorAll("button,input")].filter(el => !el.disabled);
      const first = all[0], last = all[all.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  }

  // Gestures: upward swipe brightens, downward swipe dims. Touch/pointer safe.
  function bindGestures() {
    stage.addEventListener("pointerdown", ev => {
      requestWakeLock(); // Retry from a genuine user gesture when iOS requires it.
      if (ev.target.closest("button")) return;
      down = {x:ev.clientX, y:ev.clientY, brightness:settings.brightness, moved:false};
    });
    stage.addEventListener("pointermove", ev => {
      if (!down || !ev.isPrimary) return;
      const delta = down.y - ev.clientY;
      if (Math.abs(delta) > 8 || Math.abs(ev.clientX - down.x) > 8) down.moved = true;
      if (Math.abs(delta) > 8) {
        const maxDelta = Math.max(160, window.innerHeight * .55);
        brightness(down.brightness + delta / maxDelta * 100);
        setControlsShown(false);
      }
    });
    const finish = () => {
      if (!down) return;
      if (!down.moved) setControlsShown(true);
      down = null;
    };
    stage.addEventListener("pointerup", finish);
    stage.addEventListener("pointercancel", () => down = null);
    stage.addEventListener("contextmenu", e => e.preventDefault());
    stage.addEventListener("wheel", e => {
      e.preventDefault();
      brightness(settings.brightness - Math.sign(e.deltaY) * 3);
    }, {passive:false});
  }

  // The clock only needs to update once each second; the animation is separate.
  bindSettings();
  bindGestures();
  updateTime(true);
  requestAnimationFrame(animate);
  setInterval(() => updateTime(), 250);
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitClock, 70);
  });
  window.addEventListener("orientationchange", () => setTimeout(fitClock, 250));
  document.addEventListener("visibilitychange", () => {
    motion.lastFrame = 0;
    if (document.hidden) releaseWakeLock();
    else { updateTime(true); requestWakeLock(); }
  });
  requestWakeLock();
  setControlsShown(true, 6500);
  try {
    if (!localStorage.getItem("bouncy-clock-seen-tip")) {
      stage.classList.add("show-tip");
      setTimeout(() => stage.classList.remove("show-tip"), 3500);
      localStorage.setItem("bouncy-clock-seen-tip", "yes");
    }
  } catch { /* Storage unavailable in file previews / restrictive browsing modes. */ }
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();

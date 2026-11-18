// js/main.js: Main application state, world switching (Moon/Mars), room scaling, boot sequence, clocks, audio, speech synthesis, laser show, badge download, and 3D globe integration
// SI-assisted code (Claude, Antigravity), reviewed by La Shara Cordero. See AI_DISCLOSURE.md.

import { loadGhostData, loadMarsData, showErrorBanner } from './data.js';
import { resolveLang, loadDict, localizeWorld, applyStatic, setLang, t } from './i18n.js';
import { createMoonGlobe } from './globe.js';
import { initSiteMarkers } from './markers.js';
import { initPanels } from './card.js';

function p2(n) {
  return String(n).padStart(2, '0');
}

function since(iso, nowMs) {
  const s = new Date(iso);
  const n = new Date(nowMs);
  let y = n.getUTCFullYear() - s.getUTCFullYear();
  let m = n.getUTCMonth() - s.getUTCMonth();
  let d = n.getUTCDate() - s.getUTCDate();
  if (d < 0) {
    m -= 1;
    d += new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0)).getUTCDate();
  }
  if (m < 0) {
    y -= 1;
    m += 12;
  }
  const secs = Math.floor(((nowMs - s.getTime()) / 1000) % 86400);
  const hh = p2(Math.floor(secs / 3600));
  const mm = p2(Math.floor(secs / 60) % 60);
  const ss = p2(secs % 60);
  return {
    y: p2(y),
    m: p2(m),
    d: p2(d),
    hms: hh + ':' + mm + ':' + ss,
    hm: hh + ':' + mm
  };
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}

// Synthesized console sounds (Web Audio, no files), from design/mission-control-prototype.dc.html
function makeAudio() {
  let ctx = null;
  const get = () => {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  };
  const tone = (freq, start, dur, type, vol) => {
    const c = get();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + start);
    o.stop(c.currentTime + start + dur + 0.02);
  };
  const noise = (dur, vol) => {
    const c = get();
    if (!c) return;
    const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / 900));
    }
    const s = c.createBufferSource();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    s.buffer = b;
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(c.destination);
    s.start();
  };
  return {
    click: () => tone(1400, 0, 0.04, 'square', 0.05),
    typeBeep: () => tone(880, 0, 0.045, 'sine', 0.05),
    calling: () => noise(1.5, 0.06),
    ping: () => {
      tone(1320, 0, 0.5, 'sine', 0.18);
      tone(1320, 0.55, 0.5, 'sine', 0.12);
      tone(1320, 1.1, 0.5, 'sine', 0.07);
    },
    nosignal: () => {
      tone(220, 0, 0.18, 'square', 0.05);
      tone(180, 0.24, 0.3, 'square', 0.05);
    },
    done: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.08));
    }
  };
}

function makeEmptyWorldMem() {
  return {
    checked: {},
    missionCompleteDismissed: false,
    hasBooted: false,
    globeRotation: null
  };
}

async function startApp() {
  // Optional translation: ?lang= wins, then the saved choice, then the browser language.
  // Start the dictionary and the data together, so translating never adds a round trip.
  const lang = resolveLang();
  const dictReady = lang === 'en' ? Promise.resolve(null) : loadDict(lang);

  let moonData;
  try {
    moonData = await loadGhostData();
  } catch (err) {
    return;
  }

  if (lang !== 'en') {
    const dict = await dictReady;
    // Only claim the language when the dictionary actually loaded: otherwise the page shows
    // English and must announce English to screen readers.
    if (dict) {
      moonData = localizeWorld(moonData);
      applyStatic();
      document.documentElement.lang = lang;
    }
  }

  // Mars is a second world, not a dependency of the first: it loads in the background,
  // so a slow or missing Mars file never delays the Moon console.
  const worldDataMap = { moon: moonData, mars: null };
  const marsReady = loadMarsData()
    .then((data) => {
      // localizeWorld() is a no-op when no dictionary is loaded, so English stays untouched.
      const localized = localizeWorld(data);
      worldDataMap.mars = localized;
      return localized;
    })
    .catch(() => {
      showErrorBanner('MARS CONSOLE UNAVAILABLE: Mars data did not load. The Moon console still works.');
      return null;
    });

  const wantsMars = window.location.hash.toLowerCase() === '#mars';
  if (wantsMars) await marsReady;
  const initialWorld = wantsMars && worldDataMap.mars ? 'mars' : 'moon';
  let data = worldDataMap[initialWorld];
  let ghosts = data.ghosts;
  let sites = data.sites;
  let bootLines = data.bootLines;

  const worldMem = {
    moon: makeEmptyWorldMem(),
    mars: makeEmptyWorldMem()
  };
  worldMem[initialWorld].hasBooted = true;

  const sfx = makeAudio();

  const speechSupported = Boolean(
    typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window
  );

  const state = {
    world: initialWorld,
    phase: 'boot',
    step: 0,
    sel: null,
    viewMode: 'moon', // 'moon' or 'photo'
    call: null,
    openQ: null,
    now: Date.now(),
    checked: {},
    muted: false,
    phoneSheetOpen: false,
    photoModalOpen: false,
    photoTriggerEl: null,
    aboutModalOpen: false,
    typedAnswer: '',
    typingAnswer: false,
    missionCompleteDismissed: false,
    speechSupported,
    speaking: false,
    laserActive: false,
    laserStaticDone: false,
    laserElapsed: 0
  };

  let currentRoomScale = 1;
  let bootTimer = null;
  let callTimer = null;
  let answerTypeTimer = null;
  let laserRafId = null;
  let dragHintTimer = null;
  let dragHintDismissed = false;
  let globeController = null;
  let markersController = null;
  let missionPanelFocused = false;
  let missionPanelReturnFocus = null;

  // DOM Elements
  const roomEl = document.getElementById('room');
  const mainScreenEl = document.getElementById('main-screen') || document.querySelector('.main-screen');
  const moonViewportEl = document.getElementById('moon-viewport');
  const gmtValEl = document.getElementById('gmt-val');
  const moonClockLabelEl = document.getElementById('moon-clock-label');
  const moonClockValEl = document.getElementById('moon-clock-val');
  const langSelectEl = document.getElementById('lang-select');
  langSelectEl.value = lang;
  langSelectEl.addEventListener('change', () => setLang(langSelectEl.value));

  const worldMoonBtnEl = document.getElementById('world-moon-btn');
  const worldMarsBtnEl = document.getElementById('world-mars-btn');

  if (worldMarsBtnEl) {
    const applyMarsState = (available) => {
      worldMarsBtnEl.disabled = !available;
      if (available) {
        worldMarsBtnEl.removeAttribute('aria-disabled');
        worldMarsBtnEl.title = '';
      } else {
        worldMarsBtnEl.setAttribute('aria-disabled', 'true');
        worldMarsBtnEl.title = 'Mars data is unavailable right now';
      }
    };
    applyMarsState(Boolean(worldDataMap.mars));
    marsReady.then((data) => applyMarsState(Boolean(data)));
  }
  const muteBtnEl = document.getElementById('mute-btn');
  const aboutBtnEl = document.getElementById('about-btn');
  const replayBtnEl = document.getElementById('replay-btn');
  replayBtnEl.textContent = 'REPLAY\nPOWER-ON';

  const bootPanelEl = document.getElementById('boot-panel');
  const bootLinesEl = document.getElementById('boot-lines');
  const bootCursorEl = document.getElementById('boot-cursor');
  const beginBtnEl = document.getElementById('begin-btn');
  const bootDimmerEl = document.getElementById('boot-dimmer');
  const skipIntroBtnEl = document.getElementById('skip-intro-btn');

  const mainContentEl = document.getElementById('main-content');
  const moonCanvasWrapEl = document.getElementById('moon-canvas-wrap');
  const faceEarthBtnEl = document.getElementById('face-earth-btn');
  const dragHintEl = document.getElementById('drag-hint');
  const photoModalCloseEl = document.getElementById('photo-modal-close');
  const aboutModalEl = document.getElementById('about-modal');
  const aboutModalCloseEl = document.getElementById('about-modal-close');
  const srStatusLiveEl = document.getElementById('sr-status-live');

  // Laser Show DOM Elements
  const laserLayerEl = document.getElementById('laser-layer');
  const laserSvgEl = document.getElementById('laser-svg');
  const laserBeamGlowEl = document.getElementById('laser-beam-glow');
  const laserBeamLineEl = document.getElementById('laser-beam-line');
  const laserPulseDotEl = document.getElementById('laser-pulse-dot');
  const laserEarthNodeEl = document.getElementById('laser-earth-node');

  function announcePolite(message) {
    if (!srStatusLiveEl) return;
    srStatusLiveEl.textContent = message;
  }

  function isPhoneWidth() {
    return window.innerWidth <= 599;
  }

  function updateRoomScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (aboutBtnEl) {
      const compact = vw <= 599;
      aboutBtnEl.textContent = compact ? 'INFO' : 'ABOUT ·\nTEACHERS';
      // WCAG 2.5.3 (Label in Name): the accessible name must contain the visible text.
      aboutBtnEl.setAttribute(
        'aria-label',
        compact
          ? 'INFO: about Ghost Rovers, teachers and resources'
          : 'ABOUT · TEACHERS: about Ghost Rovers and teacher resources'
      );
    }
    if (vw <= 599) {
      currentRoomScale = 1;
      roomEl.style.transform = '';
      return;
    }
    let baseW = 1280;
    let baseH = 800;
    if (vw <= 959) {
      baseW = 820;
      baseH = 1180;
    } else if (vw <= 1219) {
      baseW = 1180;
      baseH = 820;
    }
    const scale = Math.min(vw / baseW, vh / baseH);
    currentRoomScale = scale;
    roomEl.style.transform = 'translate(-50%, -50%) scale(' + scale.toFixed(4) + ')';
  }

  function playSound(name) {
    if (!state.muted && sfx[name]) {
      try {
        sfx[name]();
      } catch (e) {}
    }
  }

  function stopSpeech() {
    if (speechSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    state.speaking = false;
  }

  function stopAnswerTyping() {
    if (answerTypeTimer) {
      clearInterval(answerTypeTimer);
      answerTypeTimer = null;
    }
    state.typingAnswer = false;
  }

  function finishTypingAnswer() {
    if (!state.typingAnswer) return;
    stopAnswerTyping();
    const g = ghosts.find((x) => x.id === state.sel);
    const full = g && state.openQ !== null && g.qs[state.openQ] ? g.qs[state.openQ][1] : '';
    state.typedAnswer = full;
    if (panels && panels.renderAnswerText) {
      panels.renderAnswerText(full);
    }
  }

  function startAnswerTyping(fullText) {
    stopAnswerTyping();
    if (!fullText) {
      state.typedAnswer = '';
      return;
    }
    playSound('typeBeep');
    announcePolite('Answer: ' + fullText);
    if (prefersReducedMotion()) {
      state.typedAnswer = fullText;
      state.typingAnswer = false;
      return;
    }
    let idx = 1;
    state.typedAnswer = fullText.slice(0, idx);
    state.typingAnswer = true;
    answerTypeTimer = setInterval(() => {
      idx += 1;
      if (idx >= fullText.length) {
        state.typedAnswer = fullText;
        stopAnswerTyping();
      } else {
        state.typedAnswer = fullText.slice(0, idx);
      }
      if (panels && panels.renderAnswerText) {
        panels.renderAnswerText(state.typedAnswer);
      }
    }, 25);
  }

  function toggleSpeech() {
    if (!speechSupported) return;
    playSound('click');
    if (state.speaking) {
      stopSpeech();
      updateAll();
      return;
    }
    const g = ghosts.find((x) => x.id === state.sel);
    if (!g) return;

    try {
      window.speechSynthesis.cancel();
      const openAnswer = state.openQ !== null && g.qs[state.openQ] ? g.qs[state.openQ][1] : null;
      const fullText =
        'Mission: ' + g.job + ' ' + g.story + (openAnswer ? ' Answer: ' + openAnswer : '');
      const utter = new SpeechSynthesisUtterance(fullText);
      utter.rate = 0.95;
      utter.onend = () => {
        state.speaking = false;
        updateAll();
      };
      utter.onerror = () => {
        state.speaking = false;
        updateAll();
      };
      state.speaking = true;
      window.speechSynthesis.speak(utter);
      updateAll();
    } catch (e) {
      state.speaking = false;
      updateAll();
    }
  }

  function stopLaserShow(clearStatic = true) {
    if (laserRafId) {
      cancelAnimationFrame(laserRafId);
      laserRafId = null;
    }
    state.laserActive = false;
    if (clearStatic) {
      state.laserStaticDone = false;
    }
    state.laserElapsed = 0;
    laserLayerEl.hidden = true;
  }

  function updateLaserGeometry(progress, staticFullLine) {
    if (!globeController || !mainScreenEl || !moonViewportEl || state.world !== 'moon') return;
    const sw = mainScreenEl.clientWidth || 728;
    const sh = mainScreenEl.clientHeight || 424;
    laserSvgEl.setAttribute('viewBox', '0 0 ' + sw + ' ' + sh);

    // offsetLeft/offsetTop ignore CSS transforms (phone and tablet-portrait centre the globe
    // with translateX(-50%)), so measure real boxes and convert them into the SVG viewBox space.
    // Boxes are measured against the SVG itself: its viewBox is the surface we draw on,
    // so borders or padding on .main-screen cannot shift the target.
    const svgRect = laserSvgEl.getBoundingClientRect();
    const sx = sw / (svgRect.width || 1);
    const sy = sh / (svgRect.height || 1);
    const boxInSvg = (el, defLeft, defTop) => {
      if (!el) return { left: defLeft, top: defTop };
      const r = el.getBoundingClientRect();
      return { left: (r.left - svgRect.left) * sx, top: (r.top - svgRect.top) * sy };
    };
    const vpBox = boxInSvg(moonViewportEl, 0, 0);
    const vpLeft = vpBox.left;
    const vpTop = vpBox.top;

    const a11 = sites.A11;
    if (!a11) return;
    const pos = globeController.projectLatLon(a11.lat, a11.lon);
    const targetX = vpLeft + pos.x;
    const targetY = vpTop + pos.y;

    const nodeBox = boxInSvg(laserEarthNodeEl, 16, 24);
    const nodeLeft = nodeBox.left;
    const nodeTop = nodeBox.top;
    const earthX = nodeLeft + 9;
    const earthY = nodeTop + 9;

    let x1 = earthX;
    let y1 = earthY;
    let x2 = targetX;
    let y2 = targetY;
    let dotX = targetX;
    let dotY = targetY;

    if (!staticFullLine) {
      if (progress <= 0.5) {
        // Outbound leg: Earth -> A11 (0 to 1.25s)
        const t = progress / 0.5;
        x2 = earthX + (targetX - earthX) * t;
        y2 = earthY + (targetY - earthY) * t;
        dotX = x2;
        dotY = y2;
      } else {
        // Return leg: A11 -> Earth (1.25s to 2.5s)
        const t = (progress - 0.5) / 0.5;
        x1 = targetX;
        y1 = targetY;
        x2 = targetX + (earthX - targetX) * t;
        y2 = targetY + (earthY - targetY) * t;
        dotX = x2;
        dotY = y2;
      }
      laserPulseDotEl.style.display = '';
      laserPulseDotEl.setAttribute('cx', dotX.toFixed(1));
      laserPulseDotEl.setAttribute('cy', dotY.toFixed(1));
    } else {
      laserPulseDotEl.style.display = 'none';
    }

    laserBeamGlowEl.setAttribute('x1', x1.toFixed(1));
    laserBeamGlowEl.setAttribute('y1', y1.toFixed(1));
    laserBeamGlowEl.setAttribute('x2', x2.toFixed(1));
    laserBeamGlowEl.setAttribute('y2', y2.toFixed(1));

    laserBeamLineEl.setAttribute('x1', x1.toFixed(1));
    laserBeamLineEl.setAttribute('y1', y1.toFixed(1));
    laserBeamLineEl.setAttribute('x2', x2.toFixed(1));
    laserBeamLineEl.setAttribute('y2', y2.toFixed(1));
  }

  function dismissDragHint() {
    if (dragHintDismissed) return;
    dragHintDismissed = true;
    clearTimeout(dragHintTimer);
    if (prefersReducedMotion()) {
      dragHintEl.hidden = true;
    } else {
      dragHintEl.classList.add('drag-hint--hidden');
    }
  }

  function scheduleDragHintFade() {
    if (dragHintDismissed) return;
    clearTimeout(dragHintTimer);
    dragHintTimer = setTimeout(() => {
      dismissDragHint();
    }, 8000);
  }

  function renderClocks() {
    const nd = new Date(state.now);
    const gmt = p2(nd.getUTCHours()) + ':' + p2(nd.getUTCMinutes()) + ':' + p2(nd.getUTCSeconds());
    const clocksOn = state.phase !== 'boot' || state.step >= 3;
    gmtValEl.textContent = clocksOn ? gmt : '--:--:--';

    const g = ghosts.find((x) => x.id === state.sel) || null;
    // On phones the strip has one cell and three buttons: the long "TIME ON THE MOON ·"
    // prefix pushed the live counter under the MOON button.
    const prefix = isPhoneWidth()
      ? state.world === 'mars' ? 'MARS · ' : 'MOON · '
      : state.world === 'mars' ? 'TIME ON MARS · ' : 'TIME ON THE MOON · ';
    moonClockLabelEl.textContent = prefix + (g ? g.name.toUpperCase() : 'PICK A GHOST');

    if (!g) {
      moonClockValEl.textContent = isPhoneWidth()
        ? '--Y --M --D --:--'
        : '--Y --M --D --:--:--';
    } else {
      const c = since(g.landed, state.now);
      const timePart = isPhoneWidth() ? c.hm : c.hms;
      moonClockValEl.textContent = c.y + 'Y ' + c.m + 'M ' + c.d + 'D ' + timePart;
    }

    if (worldMoonBtnEl && worldMarsBtnEl) {
      const isMars = state.world === 'mars';
      worldMoonBtnEl.setAttribute('aria-pressed', isMars ? 'false' : 'true');
      worldMarsBtnEl.setAttribute('aria-pressed', isMars ? 'true' : 'false');
    }

    muteBtnEl.textContent = state.muted ? 'SOUND OFF' : 'SOUND ON';
    muteBtnEl.setAttribute('aria-pressed', state.muted ? 'true' : 'false');

    if (panels && panels.renderTakeoverClock) {
      panels.renderTakeoverClock(state);
    }
  }

  function renderBoot() {
    const showBoot = state.phase === 'boot';
    bootPanelEl.hidden = !showBoot;
    bootDimmerEl.hidden = !showBoot;
    skipIntroBtnEl.hidden = !showBoot;
    mainContentEl.hidden = showBoot;

    if (showBoot) {
      while (bootLinesEl.firstChild) {
        bootLinesEl.removeChild(bootLinesEl.firstChild);
      }
      const visibleLines = bootLines.slice(0, state.step);
      visibleLines.forEach((lineText) => {
        const p = document.createElement('p');
        p.className = 'boot-line';
        p.textContent = '> ' + lineText;
        bootLinesEl.appendChild(p);
      });
      const done = state.step >= bootLines.length;
      bootCursorEl.hidden = done;
      beginBtnEl.hidden = !done;
    }
  }

  function updateAll() {
    renderBoot();
    renderClocks();
    const res = panels.render(state);
    // The 6/6 panel is a modal dialog: move focus into it once, and release it when it closes.
    if (res.missionComplete && !missionPanelFocused) {
      missionPanelFocused = true;
      const panel = document.getElementById('mission-complete-panel');
      if (panel) {
        missionPanelReturnFocus = document.activeElement;
        panel.focus();
      }
    } else if (!res.missionComplete) {
      missionPanelFocused = false;
    }
    if (globeController && (res.viewportChanged || state.phase === 'main')) {
      globeController.resize();
    }
    if (markersController) {
      const g = ghosts.find((x) => x.id === state.sel) || null;
      const showPing = Boolean(state.call === 'done' && g && g.answers);
      const isCornerMode = Boolean(!isPhoneWidth() && g && g.hasPhoto && state.viewMode === 'photo');
      markersController.updateSelectionAndLabels(g, showPing, isCornerMode);
      if (globeController) {
        markersController.updatePositions(globeController.projectLatLon, showPing);
      }
    }
    if (state.world === 'moon' && state.laserStaticDone) {
      laserLayerEl.hidden = false;
      updateLaserGeometry(1, true);
    } else if (!state.laserActive) {
      laserLayerEl.hidden = true;
    }
  }

  function dismissMissionPanel() {
    state.missionCompleteDismissed = true;
    updateAll();
    const back = missionPanelReturnFocus;
    missionPanelReturnFocus = null;
    if (back && typeof back.focus === 'function' && document.contains(back)) back.focus();
  }

  function openPhotoModal(triggerEl) {
    const g = ghosts.find((x) => x.id === state.sel) || null;
    if (!g || !g.hasPhoto) return;
    playSound('click');
    state.photoModalOpen = true;
    state.photoTriggerEl = triggerEl || null;
    updateAll();
    photoModalCloseEl.focus();
  }

  function closePhotoModal() {
    if (!state.photoModalOpen) return;
    playSound('click');
    state.photoModalOpen = false;
    const trigger = state.photoTriggerEl;
    state.photoTriggerEl = null;
    updateAll();
    if (trigger && typeof trigger.focus === 'function') {
      trigger.focus();
    }
  }

  function openAboutModal() {
    playSound('click');
    state.aboutModalOpen = true;
    updateAll();
    if (aboutModalCloseEl) {
      aboutModalCloseEl.focus();
    }
  }

  function closeAboutModal() {
    if (!state.aboutModalOpen) return;
    playSound('click');
    state.aboutModalOpen = false;
    updateAll();
    if (aboutBtnEl) {
      aboutBtnEl.focus();
    }
  }

  function pickGhostById(id) {
    if (state.phase === 'boot') return;
    clearTimeout(callTimer);
    stopLaserShow();
    stopSpeech();
    stopAnswerTyping();
    playSound('click');

    const g = ghosts.find((x) => x.id === id);
    state.sel = id;
    state.viewMode = g && g.hasPhoto ? 'photo' : 'moon';
    state.call = null;
    state.openQ = null;
    state.typedAnswer = '';
    state.phoneSheetOpen = true;
    state.photoModalOpen = false;

    if (g && globeController) {
      const site = sites[g.site];
      const lat = site ? site.lat : g.lat;
      const lon = site ? site.lon : g.lon;
      globeController.rotateToSite(lat, lon);
    }
    updateAll();
  }

  function pickSitePin(siteKey, siteGhosts) {
    if (!siteGhosts || siteGhosts.length === 0) return;
    const currentIdx = siteGhosts.findIndex((x) => x.id === state.sel);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % siteGhosts.length : 0;
    pickGhostById(siteGhosts[nextIdx].id);
  }

  function finishCallForGhost(g) {
    const wasAllDone = ghosts.every((x) => state.checked[x.id]);
    state.checked = Object.assign({}, state.checked, { [g.id]: true });
    const nowAllDone = ghosts.every((x) => state.checked[x.id]);
    if (nowAllDone && !wasAllDone) {
      state.missionCompleteDismissed = false;
      setTimeout(() => playSound('done'), 900);
    }
    playSound(g.answers ? 'ping' : 'nosignal');
    state.call = 'done';
    announcePolite(g.reply);
    updateAll();
  }

  function doCall() {
    if (state.phase === 'boot') return;
    const g = ghosts.find((x) => x.id === state.sel);
    if (!g) {
      playSound('nosignal');
      state.call = 'nosel';
      announcePolite('Pick a ghost first, then call.');
      updateAll();
      return;
    }

    clearTimeout(callTimer);
    stopLaserShow();
    stopSpeech();
    stopAnswerTyping();
    state.typedAnswer = '';

    // Special Laser Show for Laser Mirror (id === 'mirror' on Moon)
    if (state.world === 'moon' && g.id === 'mirror') {
      state.viewMode = 'moon';
      // On phones the file sheet covers the wall screen, so the beam would be invisible.
      if (isPhoneWidth()) state.phoneSheetOpen = false;
      if (globeController && sites.A11) {
        const site = sites.A11;
        globeController.rotateToSite(site.lat, site.lon);
      }

      if (prefersReducedMotion()) {
        state.laserStaticDone = true;
        state.laserElapsed = 2.5;
        finishCallForGhost(g);
        return;
      }

      playSound('calling');
      state.call = 'calling';
      state.openQ = null;
      state.laserActive = true;
      state.laserElapsed = 0;
      laserLayerEl.hidden = false;
      announcePolite('Firing laser beam to Apollo 11 Laser Mirror.');
      updateAll();

      const startTime = performance.now();
      const durationMs = 2500;

      const stepLaser = (nowPerf) => {
        const elapsedMs = Math.min(durationMs, Math.max(0, nowPerf - startTime));
        state.laserElapsed = elapsedMs / 1000;
        const progress = elapsedMs / durationMs;
        updateLaserGeometry(progress, false);
        panels.render(state);

        if (elapsedMs < durationMs) {
          laserRafId = requestAnimationFrame(stepLaser);
        } else {
          laserRafId = null;
          state.laserActive = false;
          state.laserStaticDone = true;
          finishCallForGhost(g);
        }
      };

      laserRafId = requestAnimationFrame(stepLaser);
      return;
    }

    // Standard radio call
    playSound('calling');
    state.call = 'calling';
    state.openQ = null;
    announcePolite(
      state.world === 'mars'
        ? 'Radioing Mars. 3 to 22 minutes each way.'
        : 'Radioing the Moon. 1.3 seconds each way.'
    );
    updateAll();

    callTimer = setTimeout(() => {
      finishCallForGhost(g);
    }, 1600);
  }

  function resetConsole() {
    if (state.phase === 'boot') return;
    clearTimeout(callTimer);
    stopLaserShow();
    stopSpeech();
    stopAnswerTyping();
    playSound('click');

    state.sel = null;
    state.viewMode = 'moon';
    state.call = null;
    state.openQ = null;
    state.typedAnswer = '';
    state.checked = {};
    state.phoneSheetOpen = false;
    state.photoModalOpen = false;
    state.aboutModalOpen = false;
    state.missionCompleteDismissed = false;

    if (globeController) {
      globeController.faceEarth();
    }
    announcePolite('Console reset. Pick a machine. Press CALL GHOST. See who answers.');
    updateAll();
  }

  function backToMoon() {
    if (state.phase === 'boot') return;
    playSound('click');
    state.viewMode = 'moon';
    updateAll();
  }

  function toggleQuestion(qIndex) {
    stopSpeech();
    const nextQ = state.openQ === qIndex ? null : qIndex;
    state.openQ = nextQ;
    if (nextQ !== null) {
      const g = ghosts.find((x) => x.id === state.sel);
      const full = g && g.qs[nextQ] ? g.qs[nextQ][1] : '';
      startAnswerTyping(full);
    } else {
      playSound('click');
      stopAnswerTyping();
      state.typedAnswer = '';
    }
    updateAll();

    // On a phone the answer box sits above the question buttons; bring it into view so the
    // reply is readable and the remaining questions stay reachable right below it.
    if (nextQ !== null) {
      const answerBox = isPhoneWidth()
        ? document.getElementById('phone-file-answer-box')
        : document.getElementById('file-answer-box');
      if (answerBox && !answerBox.hidden) {
        answerBox.scrollIntoView({
          block: 'nearest',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth'
        });
      }
    }
  }

  function clearQuestion() {
    stopSpeech();
    stopAnswerTyping();
    playSound('click');
    state.openQ = null;
    state.typedAnswer = '';
    updateAll();
  }

  function saveBadge(canvasEl, worldKey) {
    if (!canvasEl) return;
    playSound('click');
    try {
      const dataUrl = canvasEl.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download =
        worldKey === 'mars'
          ? 'ghost-rovers-junior-flight-controller-mars.png'
          : 'ghost-rovers-junior-flight-controller.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {}
  }

  const panels = initPanels(data, {
    onPickGhostId: pickGhostById,
    onPickSite: pickSitePin,
    onToggleQuestion: toggleQuestion,
    onClearQuestion: clearQuestion,
    onFinishTypingAnswer: finishTypingAnswer,
    onCallGhost: doCall,
    onResetConsole: resetConsole,
    onBackToMoon: backToMoon,
    onToggleSpeech: toggleSpeech,
    onClosePhoneSheet: () => {
      stopSpeech();
      playSound('click');
      state.phoneSheetOpen = false;
      updateAll();
    },
    onOpenPhoneSheet: () => {
      playSound('click');
      state.phoneSheetOpen = true;
      updateAll();
    },
    onOpenPhotoModal: openPhotoModal,
    onClosePhotoModal: closePhotoModal,
    onCloseAboutModal: closeAboutModal,
    onCloseMissionComplete: () => {
      playSound('click');
      dismissMissionPanel();
    },
    onSaveBadge: saveBadge
  });

  markersController = initSiteMarkers(sites, ghosts, pickSitePin);

  function startBootSequence() {
    clearInterval(bootTimer);
    if (prefersReducedMotion()) {
      state.step = bootLines.length;
      updateAll();
      return;
    }

    bootTimer = setInterval(() => {
      if (state.step >= bootLines.length) {
        clearInterval(bootTimer);
        updateAll();
        return;
      }
      state.step += 1;
      updateAll();
    }, 420);
  }

  async function switchWorld(targetWorld, fromHashChange = false) {
    const nextWorld = targetWorld === 'mars' ? 'mars' : 'moon';
    if (nextWorld === state.world) return;
    if (!worldDataMap[nextWorld]) return;

    clearInterval(bootTimer);
    clearTimeout(callTimer);
    stopLaserShow(false);
    stopSpeech();
    stopAnswerTyping();
    playSound('click');

    // Save current world state. The selected ghost is deliberately NOT carried over:
    // arriving on a world always starts at its console, not inside the last file.
    const curMem = worldMem[state.world];
    curMem.checked = Object.assign({}, state.checked);
    curMem.missionCompleteDismissed = state.missionCompleteDismissed;
    curMem.globeRotation = globeController ? globeController.getRotation() : null;

    // Load next world state
    state.world = nextWorld;
    data = worldDataMap[nextWorld];
    ghosts = data.ghosts;
    sites = data.sites;
    bootLines = data.bootLines;

    const nextMem = worldMem[nextWorld];
    state.sel = null;
    state.viewMode = 'moon';
    state.call = null;
    state.openQ = null;
    state.typedAnswer = '';
    state.checked = Object.assign({}, nextMem.checked);
    state.missionCompleteDismissed = nextMem.missionCompleteDismissed;
    state.laserStaticDone = false;
    state.phoneSheetOpen = false;
    state.photoModalOpen = false;
    state.aboutModalOpen = false;

    if (!fromHashChange) {
      const targetHash = nextWorld === 'mars' ? '#mars' : '';
      if (targetHash) {
        if (window.location.hash !== '#mars') {
          history.replaceState(null, '', '#mars');
        }
      } else if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    panels.setWorldData(data);
    if (markersController) {
      markersController.setWorldData(sites, ghosts);
    }
    if (globeController) {
      await globeController.setWorld(nextWorld, null);
    }

    // Switching to Mars replays a short boot using bootLines from mars.json;
    // Switching back to the Moon restores the Moon as it was.
    if (nextWorld === 'mars' && !nextMem.hasBooted) {
      nextMem.hasBooted = true;
      state.phase = 'boot';
      state.step = 0;
      updateAll();
      startBootSequence();
    } else if (nextWorld === 'mars' && Object.keys(nextMem.checked).length === 0) {
      state.phase = 'boot';
      state.step = 0;
      updateAll();
      startBootSequence();
    } else {
      nextMem.hasBooted = true;
      state.phase = 'main';
      state.step = bootLines.length;
      updateAll();
    }
  }

  if (worldMoonBtnEl) {
    worldMoonBtnEl.addEventListener('click', () => switchWorld('moon'));
  }
  if (worldMarsBtnEl) {
    worldMarsBtnEl.addEventListener('click', () => switchWorld('mars'));
  }

  window.addEventListener('hashchange', () => {
    const hashWorld = window.location.hash.toLowerCase() === '#mars' ? 'mars' : 'moon';
    if (hashWorld !== state.world) {
      switchWorld(hashWorld, true);
    }
  });

  beginBtnEl.addEventListener('click', () => {
    clearInterval(bootTimer);
    playSound('click');
    state.phase = 'main';
    state.step = bootLines.length;
    updateAll();
    scheduleDragHintFade();
  });

  skipIntroBtnEl.addEventListener('click', () => {
    clearInterval(bootTimer);
    state.phase = 'main';
    state.step = bootLines.length;
    updateAll();
    scheduleDragHintFade();
  });

  replayBtnEl.addEventListener('click', () => {
    clearTimeout(callTimer);
    stopLaserShow();
    stopSpeech();
    stopAnswerTyping();
    state.phase = 'boot';
    state.step = 0;
    state.sel = null;
    state.viewMode = 'moon';
    state.call = null;
    state.openQ = null;
    state.typedAnswer = '';
    state.checked = {};
    state.phoneSheetOpen = false;
    state.photoModalOpen = false;
    state.aboutModalOpen = false;
    state.missionCompleteDismissed = false;
    if (globeController) {
      globeController.faceEarth();
    }
    updateAll();
    startBootSequence();
  });

  muteBtnEl.addEventListener('click', () => {
    state.muted = !state.muted;
    updateAll();
  });

  if (aboutBtnEl) {
    aboutBtnEl.addEventListener('click', () => {
      if (state.aboutModalOpen) {
        closeAboutModal();
      } else {
        openAboutModal();
      }
    });
  }

  faceEarthBtnEl.addEventListener('click', () => {
    playSound('click');
    if (globeController) {
      globeController.faceEarth();
    }
  });

  window.addEventListener('keydown', (e) => {
    const missionPanelEl = document.getElementById('mission-complete-panel');
    const missionPanelOpen = Boolean(missionPanelEl && !missionPanelEl.hidden);
    if (e.key === 'Tab' && (state.aboutModalOpen || state.photoModalOpen || missionPanelOpen)) {
      const modalRoot = state.aboutModalOpen
        ? aboutModalEl
        : state.photoModalOpen
          ? document.getElementById('photo-modal')
          : missionPanelEl;
      if (modalRoot) {
        const focusables = Array.from(
          modalRoot.querySelectorAll('button:not([hidden]), a[href]:not([hidden])')
        );
        if (focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
            return;
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
            return;
          }
        }
      }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (missionPanelOpen) {
        dismissMissionPanel();
        return;
      }
      if (state.aboutModalOpen) {
        closeAboutModal();
        return;
      }
      if (state.photoModalOpen) {
        closePhotoModal();
        return;
      }
      if (state.typingAnswer) {
        finishTypingAnswer();
        return;
      }
      if (state.phoneSheetOpen) {
        stopSpeech();
        state.phoneSheetOpen = false;
        updateAll();
        return;
      }
    }
    if (state.phase === 'boot' || state.photoModalOpen || state.aboutModalOpen || missionPanelOpen) return;
    if (e.key === '?') {
      openAboutModal();
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      switchWorld(state.world === 'mars' ? 'moon' : 'mars');
      return;
    }
    if (e.key >= '1' && e.key <= '6') {
      const idx = Number(e.key) - 1;
      if (ghosts[idx]) {
        pickGhostById(ghosts[idx].id);
      }
    } else if (e.key === 'c' || e.key === 'C') {
      doCall();
    }
  });

  window.addEventListener('resize', () => {
    updateRoomScale();
    renderClocks();
    updateAll();
  });

  setInterval(() => {
    state.now = Date.now();
    renderClocks();
  }, 1000);

  updateRoomScale();
  updateAll();
  startBootSequence();

  // Initialize Three.js 0.187.0 Globe
  try {
    globeController = await createMoonGlobe(
      moonCanvasWrapEl,
      (projectLatLon) => {
        if (!markersController || state.phase === 'boot') return;
        const g = ghosts.find((x) => x.id === state.sel) || null;
        const showPing = Boolean(state.call === 'done' && g && g.answers);
        const isCornerMode = Boolean(!isPhoneWidth() && g && g.hasPhoto && state.viewMode === 'photo');
        markersController.updateSelectionAndLabels(g, showPing, isCornerMode);
        markersController.updatePositions(projectLatLon, showPing);
        if (state.world === 'moon' && state.laserStaticDone) {
          updateLaserGeometry(1, true);
        }
      },
      {
        initialWorld,
        getRoomScale: () => currentRoomScale,
        onFirstDrag: dismissDragHint
      }
    );
    updateAll();
  } catch (err) {
    showErrorBanner(
      '3D Globe failed to initialize: ' + (err && err.message ? err.message : String(err))
    );
  }
}

startApp();

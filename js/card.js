// js/card.js: Render side screens, hardware plot, photo takeover, console monitor, phone sheet, photo viewer, and mission complete badge using textContent only
// SI-assisted code (Claude, Antigravity), reviewed by La Shara Cordero. See AI_DISCLOSURE.md.

import { t } from './i18n.js';

function p2(n) {
  return String(n).padStart(2, '0');
}

function sinceParts(iso, nowMs) {
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
    hh,
    mm,
    ss
  };
}

function fitFont(ctx, text, weight, maxPx, minPx, family, maxWidth) {
  let size = maxPx;
  while (size > minPx) {
    ctx.font = weight + ' ' + size + 'px ' + family;
    if (ctx.measureText(text).width <= maxWidth) {
      break;
    }
    size -= 0.5;
  }
  return ctx.font;
}

// Draw the 1969 Console Junior Flight Controller Badge on <canvas>
// Contest rule: NO NASA logo, insignia, mission patch, flag, or mission identifiers
export function drawMissionBadge(canvas, world = 'moon') {
  if (!canvas || !canvas.getContext) return;
  const isMars = world === 'mars';
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Outer console slate plate
  ctx.fillStyle = '#0B0E0D';
  ctx.fillRect(0, 0, w, h);

  // Subtle grid background
  ctx.strokeStyle = 'rgba(201, 221, 224, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 20; x < w; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 20; y < h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Outer and inner brass/amber borders
  ctx.strokeStyle = '#C9B871';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  ctx.strokeStyle = 'rgba(255, 233, 176, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  // Corner console rivets
  const rivets = [
    [18, 18],
    [w - 18, 18],
    [18, h - 18],
    [w - 18, h - 18]
  ];
  rivets.forEach(([rx, ry]) => {
    ctx.fillStyle = '#8C978F';
    ctx.beginPath();
    ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Left Emblem: Geometric Globe with Landing Site Squares
  const cx = 72;
  const cy = h / 2;
  const r = 44;

  ctx.fillStyle = isMars ? '#2A1712' : '#162224';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isMars ? '#E8A88A' : '#C9DDE0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Latitude/Longitude crosshairs
  ctx.strokeStyle = isMars ? 'rgba(232, 168, 138, 0.3)' : 'rgba(201, 221, 224, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.55, r, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Site hollow squares on the emblem
  const emblemSites = isMars
    ? [
        { x: cx - 18, y: cy - 14, lit: false },
        { x: cx + 18, y: cy - 24, lit: false },
        { x: cx - 10, y: cy - 11, lit: false },
        { x: cx + 22, y: cy + 12, lit: false },
        { x: cx - 2, y: cy + 4, lit: false },
        { x: cx + 18, y: cy - 3, lit: false }
      ]
    : [
        { x: cx + 16, y: cy - 2, lit: true },
        { x: cx - 18, y: cy + 5, lit: false },
        { x: cx + 3, y: cy - 22, lit: false },
        { x: cx + 21, y: cy - 16, lit: false }
      ];
  emblemSites.forEach((pt) => {
    ctx.strokeStyle = pt.lit ? '#7BE495' : '#FFFFFF';
    ctx.lineWidth = pt.lit ? 2 : 1.5;
    ctx.strokeRect(pt.x - 4, pt.y - 4, 8, 8);
  });

  // Right Typography Block (fit every line via measureText inside inner border)
  const tx = 132;
  const maxTextW = w - tx - 24;
  const monoFont = '"IBM Plex Mono", monospace';
  const sansFont = '"Archivo Narrow", Arial, sans-serif';

  // Top red Dymo-style strip
  const dymoText = 'CONSOLE 7 · MISSION COMPLETE';
  fitFont(ctx, dymoText, '700', 11, 8, monoFont, maxTextW - 16);
  const dymoW = Math.ceil(ctx.measureText(dymoText).width) + 16;
  ctx.fillStyle = '#9E2B25';
  ctx.fillRect(tx, 26, dymoW, 20);
  ctx.fillStyle = '#F4F4F0';
  ctx.fillText(dymoText, tx + 8, 40);

  // Main Badge Title
  const title1 = isMars ? 'JUNIOR FLIGHT CONTROLLER · MARS' : 'JUNIOR FLIGHT CONTROLLER';
  ctx.fillStyle = '#FFE9B0';
  fitFont(ctx, title1, '700', 21, 12, sansFont, maxTextW);
  ctx.fillText(title1, tx, 74);

  const title2 = isMars
    ? 'GHOST ROVERS · MARS HARDWARE CHECK'
    : 'GHOST ROVERS · LUNAR HARDWARE CHECK';
  ctx.fillStyle = '#FFFFFF';
  fitFont(ctx, title2, '700', 16, 10, sansFont, maxTextW);
  ctx.fillText(title2, tx, 97);

  // Divider
  ctx.strokeStyle = 'rgba(201, 184, 113, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx, 110);
  ctx.lineTo(w - 24, 110);
  ctx.stroke();

  // Telemetry verification lines (no mission identifiers)
  const line1 = 'LOG STATUS : 06 OF 06 MACHINES CHECKED';
  ctx.fillStyle = '#C9DDE0';
  fitFont(ctx, line1, '600', 11, 8, monoFont, maxTextW);
  ctx.fillText(line1, tx, 132);

  const line2 = isMars ? 'ACTIVE LINK: NONE YET' : 'ACTIVE LINK: LASER MIRROR (2.5 SEC)';
  ctx.fillStyle = isMars ? '#F2A08F' : '#9BEFB0';
  fitFont(ctx, line2, '600', 11, 8, monoFont, maxTextW);
  ctx.fillText(line2, tx, 152);

  const line3 = isMars ? '6 MACHINES · 6 SITES · ALL QUIET' : '4 SITES · NEAR SIDE';
  ctx.fillStyle = '#8FA5A9';
  fitFont(ctx, line3, '400', 10, 8, monoFont, maxTextW);
  ctx.fillText(line3, tx, 172);
}

export function initPanels(initialData, callbacks) {
  let currentData = initialData;
  let ghosts = currentData.ghosts;
  let sites = currentData.sites;
  let currentWorld = currentData.world === 'mars' ? 'mars' : 'moon';

  const {
    onPickGhostId,
    onPickSite,
    onToggleQuestion,
    onClearQuestion,
    onFinishTypingAnswer,
    onCallGhost,
    onResetConsole,
    onBackToMoon,
    onToggleSpeech,
    onClosePhoneSheet,
    onOpenPhoneSheet,
    onOpenPhotoModal,
    onClosePhotoModal,
    onCloseAboutModal,
    onCloseMissionComplete,
    onSaveBadge
  } = callbacks;

  const legendListEl = document.getElementById('site-legend-list');
  const timelineListEl = document.getElementById('timeline-list');
  const logListEl = document.getElementById('log-list');
  const btnGridEl = document.getElementById('ghost-btn-grid');

  const pageH1El = document.getElementById('page-h1');
  const mainScreenEl = document.querySelector('.main-screen');
  const moonCanvasWrapEl = document.getElementById('moon-canvas-wrap');
  const faceEarthBtnEl = document.getElementById('face-earth-btn');
  const hardwarePlotEl = document.getElementById('hardware-plot');
  const plotKickerEl = document.getElementById('plot-kicker');
  const plotHeadingEl = document.getElementById('plot-heading');
  const plotTakeoverLabelEl = document.getElementById('plot-takeover-label');
  const lightTimeLabelEl = document.getElementById('light-time-label');
  const lightTimeValEl = document.getElementById('light-time-val');
  const lastCrewLabelEl = document.getElementById('last-crew-label');
  const lastCrewValEl = document.getElementById('last-crew-val');
  const compactLandedTextEl = document.getElementById('compact-landed-text');
  const dymoTapeEl = document.getElementById('dymo-tape');
  const monitorReadyHintEl = document.getElementById('monitor-ready-hint');
  const missionCompleteTitleEl = document.getElementById('mission-complete-title');

  const studyQuizLinkEl = document.getElementById('study-quiz-link');
  const studyFlashcardsLinkEl = document.getElementById('study-flashcards-link');
  const studyMindmapLinkEl = document.getElementById('study-mindmap-link');
  const notebookLinkEl = document.getElementById('notebook-link');
  const podcastLinkEl = document.getElementById('podcast-link');
  const phoneNotebookLinkEl = document.getElementById('phone-notebook-link');
  const phonePodcastLinkEl = document.getElementById('phone-podcast-link');

  let timelineItems = [];
  let logItems = [];
  let ghostButtons = [];
  let badgeDrawnWorld = null;
  let lastRenderedGhostId = null;
  let pendingScrollReset = false;
  let lastSheetOpen = false;
  let sheetCloseTimer = null;

  function buildWorldDOM(dataObj) {
    currentData = dataObj;
    ghosts = dataObj.ghosts;
    sites = dataObj.sites;
    currentWorld = dataObj.world === 'mars' ? 'mars' : 'moon';
    const isMars = currentWorld === 'mars';
    badgeDrawnWorld = null;

    // 1. Rebuild Clickable Legend Buttons on Main Screen
    while (legendListEl.firstChild) {
      legendListEl.removeChild(legendListEl.firstChild);
    }
    const siteKeys = Object.keys(sites);
    siteKeys.forEach((siteKey) => {
      const site = sites[siteKey];
      const gs = ghosts.filter((x) => x.site === siteKey);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'legend-row';
      const namesJoined =
        gs.length === 2 ? gs[0].name + ' and ' + gs[1].name : gs.map((x) => x.name).join(', ');
      row.setAttribute('aria-label', site.legendCode + ', ' + site.name + ': ' + namesJoined + '.');

      const codeSpan = document.createElement('span');
      codeSpan.className = 'legend-code';
      codeSpan.textContent = site.legendCode;

      const textSpan = document.createElement('span');
      textSpan.className = 'legend-text';
      textSpan.textContent = site.name.toUpperCase() + ': ' + gs.map((x) => x.name).join(', ');

      row.appendChild(codeSpan);
      row.appendChild(textSpan);
      row.addEventListener('click', () => {
        if (onPickSite) onPickSite(siteKey, gs);
      });
      legendListEl.appendChild(row);
    });

    // 2. Rebuild Left Side Screen Clickable Timeline (LANDED · BY YEAR) + TODAY row
    while (timelineListEl.firstChild) {
      timelineListEl.removeChild(timelineListEl.firstChild);
    }
    const sortedByLanded = ghosts.slice().sort((a, b) => (a.landed < b.landed ? -1 : 1));
    timelineItems = sortedByLanded.map((g) => {
      const li = document.createElement('li');
      li.className = 'timeline-item';

      const dot = document.createElement('span');
      dot.className = 'timeline-dot';
      dot.setAttribute('aria-hidden', 'true');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'timeline-btn';
      btn.setAttribute('aria-pressed', 'false');

      const year = document.createElement('span');
      year.className = 'timeline-year';
      year.textContent = g.landed.slice(0, 4);

      const label = document.createElement('span');
      label.className = 'timeline-label';
      label.textContent = g.name.toUpperCase();

      btn.appendChild(year);
      btn.appendChild(label);
      btn.addEventListener('click', () => onPickGhostId(g.id));

      li.appendChild(dot);
      li.appendChild(btn);
      timelineListEl.appendChild(li);

      return { id: g.id, dot, btn, year, label };
    });

    const todayLi = document.createElement('li');
    todayLi.className = 'timeline-today';
    todayLi.textContent =
      dataObj.today ||
      (isMars
        ? t('timelineTodayMars', 'TODAY · All 6 are still there. None answer yet.')
        : t('timelineTodayMoon', 'TODAY · All 6 are still there. 1 still answers.'));
    timelineListEl.appendChild(todayLi);

    // 3. Rebuild Right Side Screen Ghost Log (GHOST LOG)
    while (logListEl.firstChild) {
      logListEl.removeChild(logListEl.firstChild);
    }
    logItems = ghosts.map((g) => {
      const li = document.createElement('li');
      li.className = 'log-item';

      const lamp = document.createElement('span');
      lamp.className = 'log-lamp';
      lamp.setAttribute('aria-hidden', 'true');

      const col = document.createElement('span');
      col.className = 'log-text-col';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'log-name';

      const statusSpan = document.createElement('span');
      statusSpan.className = 'log-status';

      col.appendChild(nameSpan);
      col.appendChild(statusSpan);
      li.appendChild(lamp);
      li.appendChild(col);
      logListEl.appendChild(li);

      return { ghost: g, lamp, nameSpan, statusSpan };
    });

    // 4. Rebuild 6 Console Ghost Buttons
    while (btnGridEl.firstChild) {
      btnGridEl.removeChild(btnGridEl.firstChild);
    }
    ghostButtons = ghosts.map((g, i) => {
      const keyNum = String(i + 1);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ghost-btn' + (g.answers ? ' ghost-btn--answers' : '');
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-keyshortcuts', keyNum);

      const codeSpan = document.createElement('span');
      codeSpan.className = 'ghost-btn-code';
      codeSpan.textContent = '[' + keyNum + '] ' + g.code;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'ghost-btn-name';
      nameSpan.textContent = g.name;

      btn.appendChild(codeSpan);
      btn.appendChild(nameSpan);
      btn.addEventListener('click', () => onPickGhostId(g.id));
      btnGridEl.appendChild(btn);

      return { ghost: g, btn };
    });

    // 5. Update World Labels, Clocks, Study Links, and Aria Labels
    if (pageH1El) {
      pageH1El.textContent = isMars
        ? 'Ghost Rovers: Mars Hardware Check'
        : 'Ghost Rovers: Lunar Hardware Check';
    }
    if (mainScreenEl) {
      mainScreenEl.setAttribute(
        'aria-label',
        isMars
          ? 'Main wall screen: Mars and its landing sites'
          : 'Main wall screen: the Moon and its landing sites'
      );
    }
    if (moonCanvasWrapEl) {
      moonCanvasWrapEl.setAttribute(
        'aria-label',
        isMars
          ? '3D Mars globe showing landing sites, drag to spin'
          : '3D Moon globe showing near-side landing sites, drag to spin'
      );
    }
    if (faceEarthBtnEl) {
      faceEarthBtnEl.textContent = isMars ? 'RESET VIEW' : 'FACE EARTH';
      faceEarthBtnEl.setAttribute(
        'aria-label',
        isMars ? 'Reset Mars globe view' : 'Rotate Moon globe back to face Earth'
      );
    }
    if (backToMoonBtn) {
      backToMoonBtn.textContent = isMars ? 'BACK TO MARS' : 'BACK TO MOON';
      backToMoonBtn.setAttribute(
        'aria-label',
        isMars ? 'Return to full Mars globe' : 'Return to full Moon globe'
      );
    }
    if (cornerMapBtn) {
      cornerMapBtn.setAttribute(
        'aria-label',
        isMars ? 'Back to full Mars' : 'Back to the full Moon'
      );
    }
    if (hardwarePlotEl) {
      hardwarePlotEl.classList.toggle('hardware-plot--mars', isMars);
    }
    if (plotKickerEl) {
      plotKickerEl.textContent = isMars
        ? 'MARS SURFACE · HARDWARE PLOT'
        : 'LUNAR SURFACE · HARDWARE PLOT';
    }
    if (plotHeadingEl) {
      plotHeadingEl.textContent = siteKeys.length + ' SITES · ' + ghosts.length + ' MACHINES';
    }
    if (plotTakeoverLabelEl) {
      plotTakeoverLabelEl.textContent = isMars ? 'ON MARS FOR' : 'ON THE MOON FOR';
    }
    if (dataObj.clocks) {
      if (lightTimeLabelEl) lightTimeLabelEl.textContent = dataObj.clocks.lightTimeLabel;
      if (lightTimeValEl) lightTimeValEl.textContent = dataObj.clocks.lightTime;
      if (lastCrewLabelEl) lastCrewLabelEl.textContent = dataObj.clocks.lastCrewLabel;
      if (lastCrewValEl) lastCrewValEl.textContent = dataObj.clocks.lastCrew;
    }
    if (compactLandedTextEl) {
      const uniqueYears = Array.from(
        new Set(sortedByLanded.map((g) => g.landed.slice(0, 4)))
      ).join(' · ');
      compactLandedTextEl.textContent = 'LANDED ' + uniqueYears;
    }
    if (dymoTapeEl) {
      dymoTapeEl.textContent = isMars
        ? 'Ghost Rovers · Mars hardware check'
        : 'Ghost Rovers · Lunar hardware check';
    }
    if (monitorReadyHintEl) {
      monitorReadyHintEl.textContent = isMars
        ? t('monitorTapMars', 'Or tap a square on Mars. Then press CALL GHOST (or C). Press M for Moon. Press ? for About.')
        : t('monitorTapMoon', 'Or tap a square on the Moon. Then press CALL GHOST (or C). Press M for Mars. Press ? for About.');
    }
    if (missionCompleteTitleEl) {
      missionCompleteTitleEl.textContent = isMars
        ? t('missionTitleMars', 'MARS CHECK COMPLETE. None of them answer. Yet.')
        : t('missionTitleMoon', 'GHOST CHECK COMPLETE. You checked every machine NASA left on the Moon.');
    }

    const links = dataObj.studyLinks || {};
    if (studyQuizLinkEl && links.quiz) studyQuizLinkEl.href = links.quiz;
    if (studyFlashcardsLinkEl && links.flashcards) studyFlashcardsLinkEl.href = links.flashcards;
    if (studyMindmapLinkEl && links.mindMap) studyMindmapLinkEl.href = links.mindMap;
    if (notebookLinkEl && links.notebook) notebookLinkEl.href = links.notebook;
    if (phoneNotebookLinkEl && links.notebook) phoneNotebookLinkEl.href = links.notebook;

    if (links.podcast) {
      if (podcastLinkEl) {
        podcastLinkEl.hidden = false;
        podcastLinkEl.href = links.podcast;
      }
      if (phonePodcastLinkEl) {
        phonePodcastLinkEl.hidden = false;
        phonePodcastLinkEl.href = links.podcast;
      }
    } else {
      if (podcastLinkEl) podcastLinkEl.hidden = true;
      if (phonePodcastLinkEl) phonePodcastLinkEl.hidden = true;
    }
  }

  // 5. Wire Question Buttons (3 per ghost), Clear Answer, Read To Me, Call, Reset, Close, Photo Buttons
  const qBtns = [
    document.getElementById('q-btn-0'),
    document.getElementById('q-btn-1'),
    document.getElementById('q-btn-2')
  ];
  const phoneQBtns = [
    document.getElementById('phone-q-btn-0'),
    document.getElementById('phone-q-btn-1'),
    document.getElementById('phone-q-btn-2')
  ];

  qBtns.forEach((btn, idx) => {
    btn.addEventListener('click', () => onToggleQuestion(idx));
  });
  phoneQBtns.forEach((btn, idx) => {
    btn.addEventListener('click', () => onToggleQuestion(idx));
  });

  const fileAnswerClearBtn = document.getElementById('file-answer-clear');
  const phoneFileAnswerClearBtn = document.getElementById('phone-file-answer-clear');
  fileAnswerClearBtn.addEventListener('click', onClearQuestion);
  phoneFileAnswerClearBtn.addEventListener('click', onClearQuestion);

  const readBtn = document.getElementById('read-btn');
  const phoneReadBtn = document.getElementById('phone-read-btn');
  readBtn.addEventListener('click', onToggleSpeech);
  phoneReadBtn.addEventListener('click', onToggleSpeech);

  const callBtn = document.getElementById('call-btn');
  const phoneCallBtn = document.getElementById('phone-call-btn');
  callBtn.addEventListener('click', onCallGhost);
  phoneCallBtn.addEventListener('click', onCallGhost);

  const resetBtn = document.getElementById('reset-btn');
  const phoneResetBtn = document.getElementById('phone-reset-btn');
  resetBtn.addEventListener('click', onResetConsole);
  phoneResetBtn.addEventListener('click', onResetConsole);

  const backToMoonBtn = document.getElementById('back-to-moon-btn');
  backToMoonBtn.addEventListener('click', onBackToMoon);

  const cornerMapBtn = document.getElementById('corner-map-btn');
  if (cornerMapBtn) {
    cornerMapBtn.addEventListener('click', onBackToMoon);
  }

  const phoneSheetCloseBtn = document.getElementById('phone-sheet-close');
  phoneSheetCloseBtn.addEventListener('click', onClosePhoneSheet);

  const compactOpenFileBtn = document.getElementById('compact-open-file-btn');
  compactOpenFileBtn.addEventListener('click', onOpenPhoneSheet);

  const plotPhotoBtn = document.getElementById('plot-photo-btn');
  const takeoverPhotoBtn = document.getElementById('takeover-photo-btn');
  const phoneSheetPhotoBtn = document.getElementById('phone-sheet-photo-btn');

  plotPhotoBtn.addEventListener('click', () => onOpenPhotoModal(plotPhotoBtn));
  takeoverPhotoBtn.addEventListener('click', () => onOpenPhotoModal(takeoverPhotoBtn));
  phoneSheetPhotoBtn.addEventListener('click', () => onOpenPhotoModal(phoneSheetPhotoBtn));

  // Photo Viewer Modal DOM
  const photoModalEl = document.getElementById('photo-modal');
  const photoModalBackdropEl = document.getElementById('photo-modal-backdrop');
  const photoModalCloseEl = document.getElementById('photo-modal-close');
  const photoModalCaptionEl = document.getElementById('photo-modal-caption');
  const photoModalImgEl = document.getElementById('photo-modal-img');

  photoModalCloseEl.addEventListener('click', onClosePhotoModal);
  photoModalBackdropEl.addEventListener('click', onClosePhotoModal);

  // ABOUT Modal DOM
  const aboutModalEl = document.getElementById('about-modal');
  const aboutModalBackdropEl = document.getElementById('about-modal-backdrop');
  const aboutModalCloseEl = document.getElementById('about-modal-close');
  if (aboutModalCloseEl && onCloseAboutModal) {
    aboutModalCloseEl.addEventListener('click', onCloseAboutModal);
  }
  if (aboutModalBackdropEl && onCloseAboutModal) {
    aboutModalBackdropEl.addEventListener('click', onCloseAboutModal);
  }

  // Mission Complete Panel DOM
  const missionCompletePanelEl = document.getElementById('mission-complete-panel');
  const closeCompleteBtn = document.getElementById('close-complete-btn');
  const saveBadgeBtn = document.getElementById('save-badge-btn');
  const badgeCanvasEl = document.getElementById('badge-canvas');

  closeCompleteBtn.addEventListener('click', onCloseMissionComplete);
  saveBadgeBtn.addEventListener('click', () => {
    drawMissionBadge(badgeCanvasEl, currentWorld);
    onSaveBadge(badgeCanvasEl, currentWorld);
  });

  // DOM References for Dynamic Updates
  const takeoverPhotoWrap = document.getElementById('takeover-photo-wrap');
  const takeoverPhotoImg = document.getElementById('takeover-photo-img');
  const takeoverPhotoBadge = document.getElementById('takeover-photo-badge');
  const moonViewportEl = document.getElementById('moon-viewport');

  const plotLegendWrap = document.getElementById('plot-legend-wrap');
  const plotSelectedWrap = document.getElementById('plot-selected-wrap');
  const plotGhostName = document.getElementById('plot-ghost-name');
  const plotGhostMeta = document.getElementById('plot-ghost-meta');
  const plotTakeoverStats = document.getElementById('plot-takeover-stats');
  const plotTakeoverYmd = document.getElementById('plot-takeover-ymd');
  const plotTakeoverHms = document.getElementById('plot-takeover-hms');
  const plotTakeoverStatus = document.getElementById('plot-takeover-status');
  const plotTakeoverSr = document.getElementById('plot-takeover-sr');
  let lastSrGhostId = null;
  const plotPhotoFig = document.getElementById('plot-photo-fig');
  const plotPhotoImg = document.getElementById('plot-photo-img');
  const plotPhotoCap = document.getElementById('plot-photo-cap');
  const plotPhotoPlaceholder = document.getElementById('plot-photo-placeholder');
  const plotSignalText = document.getElementById('plot-signal-text');

  const logCountEl = document.getElementById('log-count');
  const compactLogTextEl = document.getElementById('compact-log-text');

  const monitorIdleEl = document.getElementById('monitor-idle');
  const monitorWarnEl = document.getElementById('monitor-warn');
  const monitorFileEl = document.getElementById('monitor-file');
  const fileHeaderEl = document.getElementById('file-header');
  const fileJobEl = document.getElementById('file-job');
  const fileBodyEl = document.getElementById('file-body');
  const fileAnswerBoxEl = document.getElementById('file-answer-box');
  const fileAnswerTextEl = document.getElementById('file-answer-text');
  const nasaLinkEl = document.getElementById('nasa-link');

  const signalLampEl = document.getElementById('signal-lamp');
  const noSignalLampEl = document.getElementById('nosignal-lamp');

  // Phone Sheet DOM References
  const phoneSheetEl = document.getElementById('phone-sheet');

  // The [hidden] attribute cannot animate out, so closing is a class + a timer.
  function setSheetVisible(show) {
    if (!phoneSheetEl) return;
    if (show) {
      clearTimeout(sheetCloseTimer);
      sheetCloseTimer = null;
      phoneSheetEl.classList.remove('phone-sheet--closing');
      phoneSheetEl.hidden = false;
      return;
    }
    if (!phoneSheetEl.hidden && !phoneSheetEl.classList.contains('phone-sheet--closing')) {
      phoneSheetEl.classList.add('phone-sheet--closing');
      sheetCloseTimer = setTimeout(() => {
        phoneSheetEl.hidden = true;
        phoneSheetEl.classList.remove('phone-sheet--closing');
        sheetCloseTimer = null;
      }, 300);
    }
  }
  const phoneSheetPhoto = document.getElementById('phone-sheet-photo');
  const phoneSheetPlaceholder = document.getElementById('phone-sheet-placeholder');
  const phoneSheetName = document.getElementById('phone-sheet-name');
  const phoneSheetPhotoId = document.getElementById('phone-sheet-photoid');
  const phoneFileHeader = document.getElementById('phone-file-header');
  const phoneFileJob = document.getElementById('phone-file-job');
  const phoneFileBody = document.getElementById('phone-file-body');
  const phoneFileAnswerBox = document.getElementById('phone-file-answer-box');
  const phoneFileAnswerText = document.getElementById('phone-file-answer-text');

  fileAnswerBoxEl.addEventListener('click', (e) => {
    if (e.target.closest('#file-answer-clear')) return;
    if (onFinishTypingAnswer) onFinishTypingAnswer();
  });
  phoneFileAnswerBox.addEventListener('click', (e) => {
    if (e.target.closest('#phone-file-answer-clear')) return;
    if (onFinishTypingAnswer) onFinishTypingAnswer();
  });

  function renderAnswerText(text) {
    fileAnswerTextEl.textContent = text;
    phoneFileAnswerText.textContent = text;
  }

  const phoneNasaLink = document.getElementById('phone-nasa-link');
  const phoneSheetSignalText = document.getElementById('phone-sheet-signal-text');
  const phoneSignalLamp = document.getElementById('phone-signal-lamp');
  const phoneNoSignalLamp = document.getElementById('phone-nosignal-lamp');

  buildWorldDOM(initialData);

  function renderTakeoverClock(state) {
    const g = ghosts.find((x) => x.id === state.sel) || null;
    const isPhone = window.innerWidth <= 599;
    const isPhotoTakeover = Boolean(!isPhone && g && g.hasPhoto && state.viewMode === 'photo');
    if (!isPhotoTakeover || !plotTakeoverStats) {
      if (plotTakeoverStats) plotTakeoverStats.hidden = true;
      lastSrGhostId = null;
      return;
    }
    plotTakeoverStats.hidden = false;
    const c = sinceParts(g.landed, state.now);
    plotTakeoverYmd.textContent = c.y + ' YRS · ' + c.m + ' MOS · ' + c.d + ' DAYS';
    plotTakeoverHms.textContent = c.hh + ' HRS · ' + c.mm + ' MIN · ' + c.ss + ' SEC';

    if (g.answers) {
      plotTakeoverStatus.textContent = 'STILL ANSWERS';
      plotTakeoverStatus.style.color = '#9BEFB0';
    } else if (g.id === 'alsep') {
      plotTakeoverStatus.textContent = 'SWITCHED OFF ' + g.quiet;
      plotTakeoverStatus.style.color = '#FFE9B0';
    } else {
      plotTakeoverStatus.textContent = 'QUIET SINCE ' + g.quiet;
      plotTakeoverStatus.style.color = '#FFE9B0';
    }

    if (lastSrGhostId !== g.id) {
      lastSrGhostId = g.id;
      const ny = Number(c.y);
      const nm = Number(c.m);
      const nd = Number(c.d);
      const worldPhrase = currentWorld === 'mars' ? 'On Mars for ' : 'On the Moon for ';
      plotTakeoverSr.textContent =
        worldPhrase +
        ny +
        (ny === 1 ? ' year, ' : ' years, ') +
        nm +
        (nm === 1 ? ' month, ' : ' months, ') +
        nd +
        (nd === 1 ? ' day.' : ' days.');
    }
  }

  function render(state) {
    const isMars = currentWorld === 'mars';
    const g = ghosts.find((x) => x.id === state.sel) || null;

    // A different ghost starts at the top of its file. The reset has to run after the sheet is
    // visible: while it is display:none the browser ignores scrollTop and restores the old one.
    if (g && g.id !== lastRenderedGhostId) {
      lastRenderedGhostId = g.id;
      pendingScrollReset = true;
    } else if (!g) {
      lastRenderedGhostId = null;
    }

    // Opening the file always starts at the top, even for the same ghost.
    if (state.phoneSheetOpen && !lastSheetOpen) {
      pendingScrollReset = true;
    }
    lastSheetOpen = Boolean(state.phoneSheetOpen);
    const nChecked = ghosts.filter((x) => state.checked[x.id]).length;
    const allDone = nChecked === ghosts.length;
    const answered = state.call === 'done';
    const calling = state.call === 'calling';
    const ping = Boolean(answered && g && g.answers);
    const isPhone = window.innerWidth <= 599;
    const isPhotoTakeover = Boolean(!isPhone && g && g.hasPhoto && state.viewMode === 'photo');

    // 1. Update Left Timeline
    timelineItems.forEach((item) => {
      const on = Boolean(g && g.id === item.id);
      item.dot.style.background = on ? '#FFFFFF' : '#6F8A8F';
      item.dot.style.boxShadow = on ? '0 0 8px #FFFFFF' : 'none';
      item.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      item.btn.classList.toggle('timeline-btn--selected', on);
      item.year.style.color = on ? '#FFFFFF' : '#B7CDD1';
      item.label.style.color = on ? '#FFFFFF' : '#B7CDD1';
    });

    // 2. Update Right Ghost Log & Compact Strip
    logItems.forEach((item) => {
      const x = item.ghost;
      const on = Boolean(g && g.id === x.id);
      const done = Boolean(state.checked[x.id]);

      const lampColor = on ? '#F6F2E2' : done ? (x.answers ? '#7BE495' : '#E8735C') : '#3A403C';
      const lampGlow = on
        ? '0 0 10px rgba(246,242,226,0.8)'
        : done
          ? x.answers
            ? '0 0 10px rgba(123,228,149,0.8)'
            : '0 0 8px rgba(232,115,92,0.7)'
          : 'none';

      item.lamp.style.background = lampColor;
      item.lamp.style.boxShadow = lampGlow;
      item.nameSpan.textContent = (done ? '✓ ' : '') + x.name;
      item.statusSpan.textContent = done
        ? x.answers
          ? t('logStatusAnswers', 'CHECKED · ANSWERS')
          : t('logStatusQuiet', 'CHECKED · QUIET SINCE') + ' ' + x.quiet
        : t('logStatusNew', 'NOT CHECKED YET');
      item.statusSpan.style.color = done ? (x.answers ? '#9BEFB0' : '#F2A08F') : '#A9B4AD';
    });

    const checkedStr = p2(nChecked) + ' OF 06 CHECKED';
    logCountEl.textContent = checkedStr;
    compactLogTextEl.textContent = 'GHOST LOG · ' + checkedStr;

    // 3. Update Console Ghost Buttons
    ghostButtons.forEach((item) => {
      const x = item.ghost;
      const on = Boolean(g && g.id === x.id);
      item.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      item.btn.classList.toggle('ghost-btn--selected', on);
      item.btn.classList.toggle('ghost-btn--answers', !on && x.answers);
    });

    // 4. Update Photo Takeover & Corner Map vs Full Moon/Mars Viewport
    const wasCorner = moonViewportEl.classList.contains('moon-viewport--corner');
    if (cornerMapBtn) {
      cornerMapBtn.hidden = !isPhotoTakeover;
    }
    if (isPhotoTakeover) {
      takeoverPhotoWrap.hidden = false;
      takeoverPhotoBtn.setAttribute('aria-label', 'View larger photo of ' + g.name);
      takeoverPhotoImg.src = g.photo;
      takeoverPhotoImg.alt = g.photoAlt;
      takeoverPhotoBadge.textContent = 'PHOTO: ' + g.photoId;
      moonViewportEl.classList.add('moon-viewport--corner');
    } else {
      takeoverPhotoWrap.hidden = true;
      moonViewportEl.classList.remove('moon-viewport--corner');
    }

    // 5. Update Main Screen Hardware Plot & Status Box
    renderTakeoverClock(state);
    if (!g) {
      plotLegendWrap.hidden = false;
      plotSelectedWrap.hidden = true;
      plotSignalText.className = '';
      if (state.call === 'nosel') {
        plotSignalText.textContent = t('pickFirst', 'PICK A GHOST FIRST, THEN CALL.');
        plotSignalText.style.color = '#F2A08F';
      } else {
        plotSignalText.textContent = t('idlePrompt', 'Pick a machine. Press CALL GHOST. See who answers.');
        plotSignalText.style.color = '#B7CDD1';
      }
    } else {
      plotLegendWrap.hidden = true;
      plotSelectedWrap.hidden = false;
      plotGhostName.textContent = g.name;

      if (isPhotoTakeover) {
        plotPhotoFig.hidden = true;
        plotPhotoPlaceholder.hidden = true;
        plotGhostMeta.hidden = false;
        plotGhostMeta.textContent =
          g.mission.toUpperCase() + ' · ' + g.siteName.toUpperCase() + '\nLANDED ' + g.landedTxt;
        plotGhostMeta.style.whiteSpace = 'pre-line';
      } else {
        plotGhostMeta.hidden = true;
        if (g.hasPhoto) {
          plotPhotoFig.hidden = false;
          plotPhotoPlaceholder.hidden = true;
          plotPhotoBtn.setAttribute('aria-label', 'View larger photo of ' + g.name);
          plotPhotoImg.src = g.photo;
          plotPhotoImg.alt = g.photoAlt;
          plotPhotoCap.textContent = 'PHOTO: ' + g.photoId;
        } else {
          plotPhotoFig.hidden = true;
          plotPhotoPlaceholder.hidden = false;
          plotPhotoPlaceholder.textContent = g.photoId
            ? 'PHOTO ' + g.photoId + '\nLOADING IN BUILD'
            : 'NASA SURFACE PHOTO\nLOADING IN BUILD';
        }
      }

      if (calling) {
        if (state.laserActive) {
          plotSignalText.textContent =
            'LASER BEAM IN FLIGHT... ' + state.laserElapsed.toFixed(1) + ' SEC';
          plotSignalText.style.color = '#9BEFB0';
          plotSignalText.className = '';
        } else {
          plotSignalText.textContent = isMars
            ? t('radioMars', 'Radioing Mars… 3 to 22 minutes each way.')
            : t('radioMoon', 'Radioing the Moon… 1.3 seconds each way.');
          plotSignalText.style.color = '#FFFFFF';
          plotSignalText.className = 'blink';
        }
      } else if (answered) {
        plotSignalText.textContent = g.reply;
        plotSignalText.style.color = g.answers ? '#9BEFB0' : '#F2A08F';
        plotSignalText.className = '';
      } else {
        plotSignalText.textContent = t('signalCheck', 'SIGNAL CHECK: PRESS CALL GHOST');
        plotSignalText.style.color = '#B7CDD1';
        plotSignalText.className = '';
      }
    }

    // 6. Update Console Monitor & Phone Sheet
    if (!g) {
      monitorIdleEl.hidden = false;
      monitorFileEl.hidden = true;
      monitorWarnEl.hidden = state.call !== 'nosel';
      setSheetVisible(false);
      compactOpenFileBtn.hidden = true;
    } else {
      monitorIdleEl.hidden = true;
      monitorFileEl.hidden = false;

      const headerLine =
        'FILE ' + g.num + ' · ' + g.mission + ' · LANDED ' + g.landedTxt + ' · ' + g.siteName;
      const openAnswer = state.openQ !== null && g.qs[state.openQ] ? g.qs[state.openQ][1] : null;
      const shownAnswer =
        openAnswer && typeof state.typedAnswer === 'string' ? state.typedAnswer : openAnswer;

      fileHeaderEl.textContent = headerLine;
      fileJobEl.textContent = g.job;
      fileBodyEl.textContent = g.story;
      nasaLinkEl.href = g.nasaUrl;

      if (openAnswer) {
        fileAnswerBoxEl.hidden = false;
        fileAnswerTextEl.textContent = shownAnswer;
      } else {
        fileAnswerBoxEl.hidden = true;
        fileAnswerTextEl.textContent = '';
      }

      qBtns.forEach((btn, idx) => {
        if (g.qs[idx]) {
          btn.hidden = false;
          btn.textContent = g.qs[idx][0];
          btn.setAttribute('aria-expanded', state.openQ === idx ? 'true' : 'false');
          btn.classList.toggle('q-btn--open', state.openQ === idx);
        } else {
          btn.hidden = true;
        }
      });

      // Speech synthesis button state
      readBtn.hidden = !state.speechSupported;
      phoneReadBtn.hidden = !state.speechSupported;
      if (state.speechSupported) {
        const readLabel = state.speaking ? t('stop', 'STOP') : t('readToMe', 'READ TO ME');
        readBtn.textContent = readLabel;
        readBtn.setAttribute('aria-pressed', state.speaking ? 'true' : 'false');
        phoneReadBtn.textContent = readLabel;
        phoneReadBtn.setAttribute('aria-pressed', state.speaking ? 'true' : 'false');
      }

      // Phone Sheet updates
      phoneSheetName.textContent = g.name;
      phoneSheetPhotoId.textContent = g.photoId ? 'PHOTO: ' + g.photoId : 'NASA SURFACE PHOTO';
      if (g.hasPhoto) {
        phoneSheetPhotoBtn.hidden = false;
        phoneSheetPlaceholder.hidden = true;
        phoneSheetPhotoBtn.setAttribute('aria-label', 'View larger photo of ' + g.name);
        phoneSheetPhoto.src = g.photo;
        phoneSheetPhoto.alt = g.photoAlt;
      } else {
        phoneSheetPhotoBtn.hidden = true;
        phoneSheetPlaceholder.hidden = false;
        phoneSheetPlaceholder.textContent = g.photoId
          ? 'PHOTO ' + g.photoId + '\nLOADING IN BUILD'
          : 'NASA SURFACE PHOTO\nLOADING IN BUILD';
      }

      phoneFileHeader.textContent = headerLine.toUpperCase();
      phoneFileJob.textContent = g.job;
      phoneFileBody.textContent = g.story;
      phoneNasaLink.href = g.nasaUrl;

      if (openAnswer) {
        phoneFileAnswerBox.hidden = false;
        phoneFileAnswerText.textContent = shownAnswer;
      } else {
        phoneFileAnswerBox.hidden = true;
        phoneFileAnswerText.textContent = '';
      }

      phoneQBtns.forEach((btn, idx) => {
        if (g.qs[idx]) {
          btn.hidden = false;
          btn.textContent = g.qs[idx][0];
          btn.setAttribute('aria-expanded', state.openQ === idx ? 'true' : 'false');
          btn.classList.toggle('q-btn--open', state.openQ === idx);
        } else {
          btn.hidden = true;
        }
      });

      phoneSheetSignalText.textContent = plotSignalText.textContent;
      phoneSheetSignalText.style.color = plotSignalText.style.color;
      phoneSheetSignalText.className = plotSignalText.className;

      setSheetVisible(Boolean(state.phoneSheetOpen));
      compactOpenFileBtn.hidden = state.phoneSheetOpen;
    }

    // 7. Update Photo Viewer Modal & ABOUT Modal
    if (state.photoModalOpen && g && g.hasPhoto) {
      photoModalEl.hidden = false;
      photoModalCaptionEl.textContent = 'PHOTO: ' + g.photoId;
      photoModalImgEl.src = g.photo;
      photoModalImgEl.alt = g.photoAlt;
    } else {
      photoModalEl.hidden = true;
    }

    if (aboutModalEl) {
      aboutModalEl.hidden = !state.aboutModalOpen;
    }

    // 8. Update Mission Complete Panel & Badge
    if (allDone && !state.missionCompleteDismissed) {
      missionCompletePanelEl.hidden = false;
      if (badgeDrawnWorld !== currentWorld) {
        drawMissionBadge(badgeCanvasEl, currentWorld);
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => drawMissionBadge(badgeCanvasEl, currentWorld));
        }
        badgeDrawnWorld = currentWorld;
      }
    } else {
      missionCompletePanelEl.hidden = true;
    }

    // 9. Update Round Signal / No Signal Lamps (Console & Phone Sheet)
    const sigLit = Boolean(answered && g && g.answers);
    const noSigLit = Boolean(answered && g && !g.answers);

    signalLampEl.style.background = sigLit ? '#7BE495' : '#263029';
    signalLampEl.style.boxShadow = sigLit ? '0 0 12px #7BE495' : 'none';
    noSignalLampEl.style.background = noSigLit ? '#E8735C' : '#302624';
    noSignalLampEl.style.boxShadow = noSigLit ? '0 0 12px #E8735C' : 'none';

    phoneSignalLamp.style.background = sigLit ? '#7BE495' : '#263029';
    phoneSignalLamp.style.boxShadow = sigLit ? '0 0 12px #7BE495' : 'none';
    phoneNoSignalLamp.style.background = noSigLit ? '#E8735C' : '#302624';
    phoneNoSignalLamp.style.boxShadow = noSigLit ? '0 0 12px #E8735C' : 'none';

    if (pendingScrollReset) {
      pendingScrollReset = false;
      const instant = { top: 0, behavior: 'instant' };
      if (phoneSheetEl) phoneSheetEl.scrollTo(instant);
      const sheetCrt = document.querySelector('.phone-sheet-crt');
      if (sheetCrt) sheetCrt.scrollTo(instant);
      const monitorScroll = document.querySelector('.monitor-file-scroll');
      if (monitorScroll) monitorScroll.scrollTo(instant);
    }

    return {
      ping,
      missionComplete: Boolean(allDone && !state.missionCompleteDismissed),
      viewportChanged: wasCorner !== isPhotoTakeover
    };
  }

  return {
    render,
    renderTakeoverClock,
    renderAnswerText,
    setWorldData: buildWorldDOM
  };
}

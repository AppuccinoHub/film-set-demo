(() => {
  'use strict';

  const STORAGE_HELP = 'filmSet.helpLevel';
  const STORAGE_MUTE = 'filmSet.muted';

  // Safe storage: localStorage can be missing or throw (private mode,
  // sandboxed iframes, blocked storage). Fall back to memory so the app
  // always works; preferences just won't persist in that case.
  const memoryStore = {};
  function getStorage() {
    try {
      return window.localStorage || null;
    } catch (_) {
      return null;
    }
  }
  function storeGet(key) {
    try {
      const s = getStorage();
      if (s) {
        const v = s.getItem(key);
        if (v !== null && v !== undefined) return v;
      }
    } catch (_) { /* fall through to memory */ }
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  }
  function storeSet(key, value) {
    memoryStore[key] = String(value);
    try {
      const s = getStorage();
      if (s) s.setItem(key, String(value));
    } catch (_) { /* memory copy is enough */ }
  }

  const HELP_HINTS = {
    more: 'English gloss + tense tip under each line.',
    mid: 'Italian + short context under each line.',
    challenge: 'Italian only. Soft hint after a miss.',
  };

  const TENSE_LABEL = {
    presente: 'Presente',
    imperfetto: 'Imperfetto',
    passato: 'Passato prossimo',
  };

  /** @type {Array<{
   *  id:number, emoji:string, bg:string, context:string,
   *  italian:string, verbHtml:string, gloss:string,
   *  tip:string, correct:'presente'|'imperfetto'|'passato', why:string
   * }>} */
  const SHOTS = [
    {
      id: 1,
      emoji: '☕ 🌙 ✨',
      bg: 'bg-setup',
      context: 'Setup — friends already there, Saturday night.',
      italian: 'Sabato sera eravamo al bar con gli amici.',
      verbHtml: 'Sabato sera <span class="verb">eravamo</span> al bar con gli amici.',
      gloss: 'Saturday night we were at the café with friends.',
      tip: 'Tip: background / scene-setting → Imperfetto.',
      correct: 'imperfetto',
      why: 'This sets the scene — you were already there. Background description uses the imperfetto, not a one-and-done action.',
    },
    {
      id: 2,
      emoji: '🎵 👥 💬',
      bg: 'bg-vibe',
      context: 'Ongoing vibe — atmosphere in progress.',
      italian: 'La musica suonava e tutti chiacchieravano.',
      verbHtml: 'La musica <span class="verb">suonava</span> e tutti <span class="verb">chiacchieravano</span>.',
      gloss: 'The music was playing and everyone was chatting.',
      tip: 'Tip: ongoing atmosphere (was happening) → Imperfetto.',
      correct: 'imperfetto',
      why: 'Music and chatting were ongoing — the vibe of the night. Imperfetto paints continuous background action.',
    },
    {
      id: 3,
      emoji: '👋 🚪 😄',
      bg: 'bg-arrive',
      context: 'Completed beat — someone shows up.',
      italian: 'Improvvisamente è arrivato Marco.',
      verbHtml: 'Improvvisamente <span class="verb">è arrivato</span> Marco.',
      gloss: 'Suddenly Marco arrived.',
      tip: 'Tip: single completed event → Passato prossimo.',
      correct: 'passato',
      why: 'Arrival is a finished moment in the story. Passato prossimo marks that completed beat (trap: not the ongoing imperfect).',
    },
    {
      id: 4,
      emoji: '☕ 📝 🪑',
      bg: 'bg-order',
      context: 'Another completed beat — he places an order.',
      italian: 'Ha ordinato un caffè macchiato e si è seduto.',
      verbHtml: '<span class="verb">Ha ordinato</span> un caffè macchiato e <span class="verb">si è seduto</span>.',
      gloss: 'He ordered a macchiato and sat down.',
      tip: 'Tip: ordered / sat = done actions → Passato prossimo.',
      correct: 'passato',
      why: 'Ordering and sitting are finished actions in the plot. Passato prossimo for completed beats — not the “was ordering” imperfect.',
    },
    {
      id: 5,
      emoji: '🌃 💫 🚶',
      bg: 'bg-wrap',
      context: 'Wrap — the night’s feel, still atmospheric.',
      italian: 'Era tardi, ma nessuno voleva andare a casa.',
      verbHtml: '<span class="verb">Era</span> tardi, ma nessuno <span class="verb">voleva</span> andare a casa.',
      gloss: 'It was late, but nobody wanted to go home.',
      tip: 'Tip: describing how the night felt → Imperfetto.',
      correct: 'imperfetto',
      why: 'Wrapping the mood of the evening (how things were / what people wanted) uses imperfetto — not a single “it got late” passato prossimo.',
    },
    {
      id: 6,
      emoji: '🗣️ 😂 📅',
      bg: 'bg-live',
      context: 'Epilogue — present day, looking back on that night.',
      italian: 'Oggi Marco racconta ancora a tutti quella serata.',
      verbHtml: 'Oggi Marco <span class="verb">racconta</span> ancora a tutti quella serata.',
      gloss: 'Today Marco still tells everyone about that evening.',
      tip: 'Tip: “oggi” / still true now → Presente.',
      correct: 'presente',
      why: '“Oggi” jumps from Saturday night to today, and “racconta” is the present form of raccontare (no helper verb, not “raccontava”). The night is over, but the telling still happens now — so Presente, not a past tense.',
    },
  ];

  const state = {
    helpLevel: storeGet(STORAGE_HELP) || 'mid',
    muted: storeGet(STORAGE_MUTE) !== '0', // default quiet
    index: 0,
    firstTryCorrect: 0,
    missedThisShot: false,
    locked: false,
    answers: [],
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const el = {
    statusTime: $('#statusTime'),
    btnMute: $('#btnMute'),
    btnHelp: $('#btnHelp'),
    screenStart: $('#screenStart'),
    screenShoot: $('#screenShoot'),
    screenEnd: $('#screenEnd'),
    helpHint: $('#helpHint'),
    btnStart: $('#btnStart'),
    storyboard: $('#storyboard'),
    takeBadge: $('#takeBadge'),
    sceneBg: $('#sceneBg'),
    sceneEmoji: $('#sceneEmoji'),
    clapperStamp: $('#clapperStamp'),
    shotContext: $('#shotContext'),
    italianLine: $('#italianLine'),
    shotGloss: $('#shotGloss'),
    tenseTip: $('#tenseTip'),
    feedback: $('#feedback'),
    shotCard: $('#shotCard'),
    scoreLine: $('#scoreLine'),
    filmReel: $('#filmReel'),
    btnReplay: $('#btnReplay'),
    btnChangeHelp: $('#btnChangeHelp'),
  };

  function tickClock() {
    const d = new Date();
    el.statusTime.textContent = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).replace(/\s?(AM|PM)/, '');
  }

  function setHelpLevel(level) {
    if (!HELP_HINTS[level]) return;
    state.helpLevel = level;
    storeSet(STORAGE_HELP, level);
    $$('.help-chip').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.help === level ? 'true' : 'false');
    });
    if (el.helpHint) el.helpHint.textContent = HELP_HINTS[level];
  }

  function setMuted(muted) {
    state.muted = muted;
    storeSet(STORAGE_MUTE, muted ? '1' : '0');
    el.btnMute.textContent = muted ? '🔇' : '🔊';
    el.btnMute.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  // Tiny WebAudio blips — optional, default muted
  let audioCtx = null;
  function beep(freq, dur, type = 'sine', gain = 0.04) {
    if (state.muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur);
    } catch (_) { /* ignore */ }
  }

  // Scroll the shoot screen just enough that the feedback box is fully in
  // view. Scrolling the minimum keeps as much of the shot card (and the
  // Italian sentence) on screen as the height allows.
  const reduceMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  function revealFeedback() {
    const scr = el.screenShoot;
    const fb = el.feedback;
    if (!scr || !fb || fb.hidden) return;
    const pad = 12;
    const scrRect = scr.getBoundingClientRect();
    const fbRect = fb.getBoundingClientRect();
    const cur = scr.scrollTop;
    const fbTop = fbRect.top - scrRect.top + cur;
    const fbBottom = fbRect.bottom - scrRect.top + cur;
    const view = scr.clientHeight;
    const maxScroll = Math.max(0, scr.scrollHeight - view);
    let target = fbBottom + pad - view; // smallest scroll that shows the whole box
    if (fbBottom - fbTop + pad * 2 > view) target = fbTop - pad; // box taller than screen: show its top
    target = Math.min(maxScroll, Math.max(0, target));
    if (Math.abs(target - cur) < 1) return;
    const smooth = !(reduceMotionQuery && reduceMotionQuery.matches);
    try {
      scr.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
    } catch (_) {
      scr.scrollTop = target;
    }
  }

  function showScreen(name) {
    [el.screenStart, el.screenShoot, el.screenEnd].forEach((s) => {
      const on = s === name;
      s.classList.toggle('active', on);
      s.hidden = !on;
      if (on) s.scrollTop = 0;
    });
  }

  function buildStoryboard() {
    el.storyboard.innerHTML = SHOTS.map((s, i) => {
      let cls = 'sb-cell';
      if (i < state.index) cls += ' done';
      if (i === state.index) cls += ' current';
      return `<div class="${cls}" aria-hidden="true"><span class="sb-emoji">${s.emoji.split(' ')[0]}</span><span class="sb-num">${i + 1}</span></div>`;
    }).join('');
  }

  function renderShot() {
    const shot = SHOTS[state.index];
    state.missedThisShot = false;
    state.locked = false;
    el.shotCard.classList.remove('locked');
    el.clapperStamp.hidden = true;
    el.feedback.hidden = true;
    el.feedback.innerHTML = '';
    el.takeBadge.textContent = `Take ${state.index + 1} / ${SHOTS.length}`;
    el.screenShoot.scrollTop = 0; // each new shot starts with the sentence in view

    el.sceneBg.className = `scene-bg ${shot.bg}`;
    el.sceneEmoji.textContent = shot.emoji;
    el.italianLine.innerHTML = shot.verbHtml;

    const level = state.helpLevel;
    // Context: mid + more; challenge hides until miss
    el.shotContext.textContent = shot.context;
    el.shotContext.hidden = level === 'challenge';

    el.shotGloss.textContent = shot.gloss;
    el.shotGloss.hidden = level !== 'more';

    el.tenseTip.textContent = shot.tip;
    el.tenseTip.hidden = level !== 'more';

    $$('.tense-chip').forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove('correct', 'soft-wrong');
    });

    buildStoryboard();
  }

  function startFilm() {
    state.index = 0;
    state.firstTryCorrect = 0;
    state.answers = [];
    showScreen(el.screenShoot);
    renderShot();
  }

  function onCorrect(firstTry) {
    const shot = SHOTS[state.index];
    state.locked = true;
    if (firstTry) state.firstTryCorrect += 1;
    state.answers.push({ id: shot.id, correct: true, firstTry });

    $$('.tense-chip').forEach((btn) => {
      btn.disabled = true;
      if (btn.dataset.tense === shot.correct) btn.classList.add('correct');
    });

    el.shotCard.classList.add('locked');
    el.clapperStamp.hidden = false;
    el.feedback.hidden = false;
    el.feedback.className = 'feedback ok';
    el.feedback.innerHTML = `<div class="fb-title">${firstTry ? 'Buona la prima!' : 'Buona!'}</div>Line locked · ${TENSE_LABEL[shot.correct]}`;
    revealFeedback();
    beep(660, 0.08);
    setTimeout(() => beep(880, 0.1), 90);

    setTimeout(() => {
      state.index += 1;
      if (state.index >= SHOTS.length) {
        endScreening();
      } else {
        renderShot();
      }
    }, 900);
  }

  function onWrong(tenseBtn) {
    const shot = SHOTS[state.index];
    const firstMiss = !state.missedThisShot;
    state.missedThisShot = true;

    tenseBtn.classList.add('soft-wrong');
    setTimeout(() => tenseBtn.classList.remove('soft-wrong'), 400);
    beep(220, 0.07, 'triangle', 0.03);

    let why = shot.why;
    if (state.helpLevel === 'challenge' && firstMiss) {
      why = `Soft hint: think about whether this is ongoing background, a finished beat, or happening now.`;
    }

    el.feedback.hidden = false;
    el.feedback.className = 'feedback tip';
    el.feedback.innerHTML = `
      <div class="fb-title">Almost — try again</div>
      ${why}
      <div><button type="button" class="try-again" id="btnTryAgain">Try again</button></div>
    `;

    // Challenge: after miss, reveal short context
    if (state.helpLevel === 'challenge') {
      el.shotContext.hidden = false;
    }
    // More/mid already have enough; after second miss on challenge, show tip
    if (state.helpLevel === 'challenge' && !firstMiss) {
      el.tenseTip.textContent = shot.tip;
      el.tenseTip.hidden = false;
    }
    revealFeedback();

    $('#btnTryAgain')?.addEventListener('click', () => {
      el.feedback.hidden = true;
      $$('.tense-chip').forEach((b) => b.classList.remove('soft-wrong'));
    }, { once: true });
  }

  function endScreening() {
    showScreen(el.screenEnd);
    el.scoreLine.textContent = `Score: ${state.firstTryCorrect}/${SHOTS.length} first-try`;
    el.filmReel.innerHTML = SHOTS.map((s, i) => `
      <div class="reel-shot" style="animation-delay:${i * 0.08}s">
        <div class="mini ${s.bg}"><span class="mini-emoji">${s.emoji.split(' ')[0]}</span></div>
        <div>
          <div class="reel-it">${s.italian}</div>
          <div class="reel-tense">${TENSE_LABEL[s.correct]}</div>
        </div>
      </div>
    `).join('');
    beep(523, 0.08);
    setTimeout(() => beep(659, 0.08), 100);
    setTimeout(() => beep(784, 0.12), 200);
  }

  const HELP_ORDER = ['more', 'mid', 'challenge'];

  function cycleHelpLevel() {
    const i = HELP_ORDER.indexOf(state.helpLevel);
    const next = HELP_ORDER[(i + 1) % HELP_ORDER.length];
    setHelpLevel(next);
    const labels = { more: 'More help', mid: 'Just right', challenge: 'Challenge me' };
    el.btnHelp.setAttribute('title', labels[next]);
    el.btnHelp.setAttribute('aria-label', 'Help level: ' + labels[next]);
  }

  // Events — no popup sheet (Safari bottom bar blocked Chiudi)
  el.btnStart.addEventListener('click', startFilm);
  el.btnReplay.addEventListener('click', startFilm);
  el.btnChangeHelp.addEventListener('click', () => showScreen(el.screenStart));
  el.btnHelp.addEventListener('click', () => {
    if (el.screenStart.classList.contains('active')) cycleHelpLevel();
    else showScreen(el.screenStart);
  });

  el.btnMute.addEventListener('click', () => setMuted(!state.muted));

  document.addEventListener('click', (e) => {
    const helpBtn = e.target.closest('.help-chip');
    if (helpBtn?.dataset.help) {
      setHelpLevel(helpBtn.dataset.help);
      return;
    }
    const tenseBtn = e.target.closest('.tense-chip');
    if (tenseBtn && !state.locked && el.screenShoot.classList.contains('active')) {
      const choice = tenseBtn.dataset.tense;
      const shot = SHOTS[state.index];
      if (choice === shot.correct) {
        onCorrect(!state.missedThisShot);
      } else {
        onWrong(tenseBtn);
      }
    }
  });

  // Init
  setHelpLevel(state.helpLevel);
  setMuted(state.muted);
  tickClock();
  setInterval(tickClock, 30000);
  showScreen(el.screenStart);
})();

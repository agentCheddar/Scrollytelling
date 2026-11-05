/*
 * Scrollytelling engine for poem close readings.
 *
 * Markup it expects (see README.md):
 *   [data-poem] .poem-body .poem-text   the poem as plain text; a blank line
 *                                       starts a new stanza
 *   .step[data-fx="…"]                  analysis blocks; while a step is the
 *                                       active one, its effects apply to the poem
 *
 * data-fx syntax:  effect [effect…]: target ; effect: target ; …
 *   target   line numbers ("3", "2-4", "1, 5"), stanzas ("s2"), "all",
 *            word positions in a line ("5:2-6" = words 2–6 of line 5),
 *            and/or a quoted phrase ('…', "…" or “…”) to find inside those lines
 */
(function () {
  'use strict';

  const EFFECTS = [
    'focus', 'blur', 'bold', 'accent', 'highlight', 'underline', 'fade',
    'shimmer', 'ripple', 'shake', 'flicker', 'mirror', 'rise',
  ];
  // Effects that change the rest of the poem, not only their targets.
  const PANEL_EFFECTS = ['focus', 'blur'];
  const RIPPLE_SCALE = 7;
  // Opening → closing quote characters around a phrase in data-fx.
  const QUOTES = { '"': '"', "'": "'", '“': '”' };
  const PHRASE = /"([^"]*)"|'([^']*)'|“([^”]*)”/g;
  // Punctuation trimmed off the ends of a word-position target.
  const LEADING_PUNCT = /["'“‘(\[]/;
  const TRAILING_PUNCT = /[.,;:!?"'”’)\]‚—–-]/;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = window.matchMedia('(max-width: 899px)');

  const poem = document.querySelector('[data-poem]');
  const poemBody = poem.querySelector('.poem-body');
  const scroller = poem.closest('.poem-scroller');
  const panel = poem.closest('.poem-panel');
  const rippleMap = document.querySelector('#fx-ripple feDisplacementMap');

  const { lines, stanzas } = buildPoem(poemBody.querySelector('.poem-text').textContent);
  const steps = Array.from(document.querySelectorAll('.step'), (el, i) => ({
    el,
    rules: parseFx(el.dataset.fx || '', i + 1),
  }));

  if (document.body.hasAttribute('data-show-fx')) {
    for (const { el } of steps) {
      const label = document.createElement('p');
      label.className = 'fx-label';
      label.innerHTML = '<span>data-fx</span> ';
      label.append(el.dataset.fx?.trim() || '(none)');
      el.append(label);
    }
  }

  if (reduceMotion.matches) {
    document.querySelectorAll('.fx-defs animate').forEach((a) => a.remove());
  }

  /* ---------------------------------------------------------------- poem */

  function buildPoem(source) {
    const rows = source.replace(/\r\n?/g, '\n').split('\n');
    const filled = rows.filter((row) => row.trim());
    const baseIndent = Math.min(...filled.map((row) => row.match(/^\s*/)[0].length));
    const lines = [];
    const stanzas = [];
    let stanza = null;

    for (const row of rows) {
      if (!row.trim()) {
        stanza = null;
        continue;
      }
      if (!stanza) {
        stanza = document.createElement('div');
        stanza.className = 'stanza';
        poemBody.append(stanza);
        stanzas.push([]);
      }

      const n = lines.length + 1;
      const line = document.createElement('div');
      line.className = n % 5 === 0 ? 'line is-marked' : 'line';
      line.dataset.line = n;
      const indent = row.slice(baseIndent).match(/^\s*/)[0].length;
      if (indent) line.style.setProperty('--indent', indent);

      const num = document.createElement('span');
      num.className = 'num';
      num.setAttribute('aria-hidden', 'true');
      num.textContent = n;

      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = row.trim();

      line.append(num, text);
      stanza.append(line);
      lines.push(line);
      stanzas[stanzas.length - 1].push(line);
    }
    return { lines, stanzas };
  }

  /* -------------------------------------------------------------- parsing */

  function parseFx(source, stepNumber) {
    return splitOutsideQuotes(source, ';')
      .map((rule) => {
        const colon = rule.indexOf(':');
        const names = (colon < 0 ? rule : rule.slice(0, colon)).toLowerCase().split(/\s+/).filter(Boolean);
        const effects = names.filter((name) => {
          if (EFFECTS.includes(name)) return true;
          warn(`step ${stepNumber}: unknown effect "${name}"`);
          return false;
        });
        const targets = resolveTargets(colon < 0 ? '' : rule.slice(colon + 1), stepNumber);
        return { effects, targets };
      })
      .filter((rule) => rule.effects.length && rule.targets.length);
  }

  function splitOutsideQuotes(source, separator) {
    const parts = [];
    let current = '';
    let closing = null;
    for (const ch of source) {
      if (closing) {
        if (ch === closing) closing = null;
      } else if (ch in QUOTES) {
        closing = QUOTES[ch];
      } else if (ch === separator) {
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    parts.push(current);
    return parts.map((part) => part.trim()).filter(Boolean);
  }

  function resolveTargets(spec, stepNumber) {
    const phrases = [];
    const rest = spec
      .replace(PHRASE, (_, a, b, c) => {
        phrases.push(a ?? b ?? c);
        return ' ';
      })
      .replace(/\s*[-–]\s*/g, '-');

    let scope = [];
    const wordRanges = []; // [line, first word, last word]
    for (const token of rest.split(/[\s,]+/).filter(Boolean)) {
      let m;
      if (token.toLowerCase() === 'all') {
        scope.push(...lines);
      } else if ((m = token.match(/^s(?:tanza)?(\d+)$/i))) {
        scope.push(...(stanzas[m[1] - 1] || []));
      } else if ((m = token.match(/^(\d+):(\d+)(?:-(\d+))?$/))) {
        if (lines[m[1] - 1]) wordRanges.push([lines[m[1] - 1], +m[2], +(m[3] || m[2])]);
        else warn(`step ${stepNumber}: there is no line ${m[1]}`);
      } else if ((m = token.match(/^(\d+)(?:-(\d+))?$/))) {
        for (let n = +m[1]; n <= +(m[2] || m[1]); n++) {
          if (lines[n - 1]) scope.push(lines[n - 1]);
        }
      } else {
        warn(`step ${stepNumber}: can't read target "${token}"`);
      }
    }

    const explicit = scope.length > 0;
    scope = explicit ? [...new Set(scope)] : lines;

    const found = [];
    if (!phrases.length) {
      // Bare word positions target only those words, not the whole poem.
      if (explicit || !wordRanges.length) found.push(...scope);
    }
    for (const phrase of phrases) {
      const hits = scope.map((line) => wrapPhrase(line.querySelector('.text'), phrase)).filter(Boolean);
      if (hits.length) {
        found.push(...hits);
      } else {
        warn(`step ${stepNumber}: phrase "${phrase}" not found${explicit ? '; using the whole line instead' : ''}`);
        if (explicit) found.push(...scope);
      }
    }
    for (const [line, first, last] of wordRanges) {
      found.push(wrapWords(line, first, last, stepNumber) || line);
    }
    return [...new Set(found)];
  }

  // Case-, curly-quote- and nbsp-insensitive, without changing string length.
  function normalize(s) {
    return s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/ /g, ' ');
  }

  // Wrap the first occurrence of `phrase` in a <span class="phrase">.
  function wrapPhrase(textEl, phrase) {
    const needle = normalize(phrase.trim());
    if (!needle) return null;
    const start = normalize(textEl.textContent).indexOf(needle);
    if (start < 0) return null;
    return wrapRange(textEl, start, start + needle.length);
  }

  // Wrap words `first`–`last` (1-based) of a line, minus punctuation at the ends.
  function wrapWords(line, first, last, stepNumber) {
    const textEl = line.querySelector('.text');
    const text = textEl.textContent;
    const words = Array.from(text.matchAll(/\S+/g));
    if (first < 1 || last < first || last > words.length) {
      warn(`step ${stepNumber}: line ${line.dataset.line} has ${words.length} words, so it has no words ${first}-${last}; using the whole line instead`);
      return null;
    }
    let start = words[first - 1].index;
    let end = words[last - 1].index + words[last - 1][0].length;
    while (start < end && LEADING_PUNCT.test(text[start])) start++;
    while (end > start && TRAILING_PUNCT.test(text[end - 1])) end--;
    return wrapRange(textEl, start, end);
  }

  // Wrap characters [start, end) of a line's text in a <span class="phrase">,
  // reusing a span that already covers exactly that range. Ranges may nest
  // inside each other but not partially overlap.
  function wrapRange(textEl, start, end) {
    for (const span of textEl.querySelectorAll('.phrase')) {
      if (offsetOf(textEl, span) === start && span.textContent.length === end - start) return span;
    }

    const [startNode, startOffset] = locate(textEl, start, 'start');
    const [endNode, endOffset] = locate(textEl, end, 'end');
    // Try the tight range first. If that cuts through an existing phrase that
    // sits flush against the new one's edge, widen the range to take it in.
    for (const widen of [false, true]) {
      const range = document.createRange();
      if (widen && startOffset === 0) range.setStartBefore(outermost(startNode, textEl, 'firstChild'));
      else range.setStart(startNode, startOffset);
      if (widen && endOffset === endNode.length) range.setEndAfter(outermost(endNode, textEl, 'lastChild'));
      else range.setEnd(endNode, endOffset);

      const span = document.createElement('span');
      span.className = 'phrase';
      try {
        range.surroundContents(span);
        return span;
      } catch {
        // partially overlaps another phrase; try the wider range
      }
    }
    warn(`"${textEl.textContent.slice(start, end)}" overlaps another phrase in line ${textEl.parentNode.dataset.line}`);
    return null;
  }

  function offsetOf(root, node) {
    const range = document.createRange();
    range.setStart(root, 0);
    range.setEndBefore(node);
    return range.toString().length;
  }

  function locate(root, offset, edge) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (edge === 'start' ? offset < node.length : offset <= node.length) break;
      offset -= node.length;
    }
    return [node, offset];
  }

  function outermost(node, root, edgeChild) {
    while (node.parentNode !== root && node.parentNode[edgeChild] === node) node = node.parentNode;
    return node;
  }

  function warn(message) {
    console.warn(`[scrolly] ${message}`);
  }

  /* ------------------------------------------------------------- effects */

  let applied = []; // [element, className] pairs added for the active step
  let activeIndex = null;
  let rippleOn = false;
  let rippleFrame = 0;

  function activate(index) {
    if (index === activeIndex) return;
    activeIndex = index;
    steps.forEach((step, i) => step.el.classList.toggle('is-active', i === index));

    for (const [el, cls] of applied) el.classList.remove(cls);
    applied = [];
    const add = (el, cls) => {
      el.classList.add(cls);
      applied.push([el, cls]);
    };

    const rules = index >= 0 ? steps[index].rules : [];
    for (const { effects, targets } of rules) {
      for (const effect of effects) {
        if (PANEL_EFFECTS.includes(effect)) add(poem, `has-${effect}`);
        for (const target of targets) {
          add(target, `fx-${effect}`);
          const line = target.closest('.line');
          add(line, 'is-target');
          if (line !== target) add(line, `fx-${effect}-within`);
        }
      }
    }

    setRipple(rules.some((rule) => rule.effects.includes('ripple')));
    revealTargets();
  }

  // Ease the ripple filter's displacement in rather than snapping it on.
  function setRipple(on) {
    if (!rippleMap || on === rippleOn) return;
    rippleOn = on;
    cancelAnimationFrame(rippleFrame);
    if (!on || reduceMotion.matches) {
      rippleMap.setAttribute('scale', on ? RIPPLE_SCALE : 0);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1400);
      rippleMap.setAttribute('scale', (RIPPLE_SCALE * (1 - (1 - t) ** 3)).toFixed(2));
      if (t < 1) rippleFrame = requestAnimationFrame(tick);
    };
    rippleFrame = requestAnimationFrame(tick);
  }

  // When the poem doesn't fit its panel (small screens), scroll the targeted
  // lines into view.
  function revealTargets() {
    if (scroller.scrollHeight <= scroller.clientHeight + 2) return;
    const targets = lines.filter((line) => line.classList.contains('is-target'));
    let y = 0;
    if (targets.length) {
      const box = scroller.getBoundingClientRect();
      const top = targets[0].getBoundingClientRect().top - box.top + scroller.scrollTop;
      const bottom = targets[targets.length - 1].getBoundingClientRect().bottom - box.top + scroller.scrollTop;
      y = bottom - top > scroller.clientHeight * 0.8
        ? top - scroller.clientHeight * 0.1
        : (top + bottom) / 2 - scroller.clientHeight / 2;
    }
    scroller.scrollTo({ top: Math.max(0, y), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }

  /* --------------------------------------------------------- scroll sync */

  // A step becomes active once its top edge passes this line on screen.
  function triggerY() {
    if (narrow.matches) {
      const panelBottom = panel.getBoundingClientRect().bottom;
      return panelBottom + (window.innerHeight - panelBottom) * 0.6;
    }
    return window.innerHeight * 0.6;
  }

  function update() {
    const y = triggerY();
    let index = -1;
    steps.forEach((step, i) => {
      if (step.el.getBoundingClientRect().top < y) index = i;
    });
    activate(index);
  }

  // Browsers already fire scroll at most once per frame; update() is cheap.
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  document.fonts?.ready.then(update);
  update();
})();

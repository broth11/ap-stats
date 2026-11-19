/* Unit page house script. One copy serves every unit page in the course.
   It reads the page's unit-data block and the shared course index, then draws:
   the 1-pager (lesson table), the category lenses, and the zoomed lesson sheet. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var D;
  try { D = JSON.parse(document.getElementById('unit-data').textContent); }
  catch (e) { app.textContent = 'The unit data on this page could not be read: ' + e.message; return; }
  var C = window.UNIT_COURSE || { course: (D.unit || {}).course || '', units: [], resources: [] };
  var ROOT = D.rootPrefix || '../';
  /* AP Statistics pages use a slimmer overview (lesson, CED, skills, summary) and button-style file links. */
  var AP = /^AP\b/i.test(C.course || (D.unit || {}).course || '');
  if (AP) document.documentElement.classList.add('ap');
  var L = (D.lessons || []).slice().sort(function (a, b) { return a.n - b.n; });

  var CATS = [
    { key: 'skills', label: 'Skills', bar: 'Skills' },
    { key: 'standards', label: 'Standards', bar: 'Standards' },
    { key: 'resources', label: 'Resources', bar: 'Resources' },
    { key: 'understandings', label: 'Key understandings', bar: 'Understandings', tag: 'Know' },
    { key: 'misconceptions', label: 'Common misunderstandings', bar: 'Misunderstandings', tag: 'Slip' },
    { key: 'processes', label: 'Math processes', bar: 'Processes', tag: 'Do' },
    { key: 'exam', label: 'Exam tips', bar: 'Exam tips', tag: 'Exam' }
  ];
  /* The student site is the same page with student wording and no teacher material. */
  var STUDENT = D.audience === 'student';
  if (STUDENT) {
    var SW = { resources: ['Files', 'Files'], understandings: ['Key ideas', 'Key ideas', 'Know'],
      misconceptions: ['Watch out for', 'Watch out', 'Watch'], processes: ['How to do it', 'How to', 'Do'] };
    CATS.forEach(function (c) { var w = SW[c.key]; if (w) { c.label = w[0]; c.bar = w[1]; if (w[2]) c.tag = w[2]; } });
  }
  var REF = ['understandings', 'misconceptions', 'processes', 'exam'].filter(function (k) {
    return !D.categories || D.categories.indexOf(k) >= 0;
  });
  CATS = CATS.filter(function (c) { return ['skills', 'standards', 'resources'].indexOf(c.key) >= 0 || REF.indexOf(c.key) >= 0; });
  if (AP) CATS.forEach(function (c) { if (c.key === 'standards') { c.label = 'CED topics'; c.bar = 'CED'; } });
  var CAT = {}; CATS.forEach(function (c) { CAT[c.key] = c; });
  var EMPTY = STUDENT ? 'Nothing here yet' : 'Not written yet';
  var state = { lens: 'overview', lesson: null, section: null };

  /* ---------- text ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function tex(src, display) {
    if (window.katex) {
      try { return window.katex.renderToString(src, { throwOnError: false, displayMode: !!display }); }
      catch (e) { /* fall through */ }
    }
    return '<code class="m">' + esc(src) + '</code>';
  }
  /* $math$, `maths in plain text`, **bold**, *italic* */
  function fmt(s) {
    var parts = String(s == null ? '' : s).split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|`[^`]+`)/);
    return parts.map(function (p) {
      if (/^\$\$[\s\S]+\$\$$/.test(p)) return tex(p.slice(2, -2), true);
      if (/^\$[^$]+\$$/.test(p)) return tex(p.slice(1, -1));
      if (/^`[^`]+`$/.test(p)) return '<code class="m">' + esc(p.slice(1, -1)) + '</code>';
      return esc(p).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
    }).join('');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function text(item) { return typeof item === 'string' ? item : (item && (item.text || item.code)) || ''; }
  /* A guidance section switched off on the proofing panel (Teacher off, or Student off on the student site). */
  function off(l, key) { return (l.hideGuide || []).indexOf(key) >= 0; }
  /* Single items switched off on the proofing page (Teacher off), by position in the list. */
  function shown(l, key, list) {
    var gone = (l.hideItems || {})[key] || [];
    return gone.length ? list.filter(function (x, i) { return gone.indexOf(i) < 0; }) : list;
  }
  function items(l, key) {
    if (off(l, key)) return [];
    if (key === 'skills') return shown(l, key, l.skills || []);
    if (key === 'standards') return l.standards || [];
    if (key === 'resources') return (l.resources || []).concat(l.links || []).filter(function (r) { return !r.hide; });
    return shown(l, key, (l.explainer || {})[key] || []);
  }
  function byId(id) { for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
  function res(l, who) {
    return (l.resources || []).concat(l.links || []).filter(function (r) { return !r.hide && (r.audience || 'student') === who; });
  }
  function link(r, cls) {
    var href = r.href || (r.files && r.files[0] && r.files[0].href) || '#';
    return '<a class="' + (cls || 'res') + '" href="' + esc(href) + '" target="_blank" rel="noopener" title="' +
      esc(r.name || r.label) + '">' + esc(r.label) + '</a>';
  }
  /* ---------- file buttons (AP Statistics) ---------- */
  var ICON = {
    page: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    video: '<rect x="3" y="5.5" width="18" height="13" rx="4"/><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor"/>',
    brain: '<path d="M12 5.5v13"/><path d="M12 5.5a2.8 2.8 0 0 0-5.2-1 3 3 0 0 0-2 4.8 3.2 3.2 0 0 0 .5 5.2A3 3 0 0 0 9 19a3 3 0 0 0 3-.5"/><path d="M12 5.5a2.8 2.8 0 0 1 5.2-1 3 3 0 0 1 2 4.8 3.2 3.2 0 0 1-.5 5.2A3 3 0 0 1 15 19a3 3 0 0 1-3-.5"/><path d="M8 10.2a2 2 0 0 0 2 1.3M16 10.2a2 2 0 0 1-2 1.3M8.2 15a2 2 0 0 1 2-1M15.8 15a2 2 0 0 0-2-1"/>'
  };
  function icon(kind) {
    return '<svg class="ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[kind] + '</svg>';
  }
  function kindOf(href, ext) {
    if (/youtube\.com|youtu\.be/i.test(href)) return 'video';
    if (/broth11\.github\.io/i.test(href)) return 'brain';
    if (/^(link|url|web)$/i.test(ext || '')) return 'link';
    if (ext) return 'page';
    return /^https?:/i.test(href) ? 'link' : 'page';
  }
  function fileButtons(r) {
    var files = r.files || [];
    if (!files.length) {
      var h = r.href || '#';
      return '<a class="fbtn" href="' + esc(h) + '" target="_blank" rel="noopener" title="' + esc(r.name || r.label) + '">' +
        icon(kindOf(h, '')) + '<span class="fl">' + esc(r.label) + '</span></a>';
    }
    return files.map(function (f) {
      var many = files.length > 1;
      return '<a class="fbtn" href="' + esc(f.href) + '" target="_blank" rel="noopener" title="' + esc((r.name || r.label) + (many ? ' (' + f.ext + ')' : '')) + '">' +
        icon(kindOf(f.href, f.ext)) + '<span class="fl">' + esc(r.label) + (many ? ' <em>' + esc(f.ext) + '</em>' : '') + '</span></a>';
    }).join('');
  }
  function resRow(r) {
    if (AP) return fileButtons(r);
    var extra = (r.files || []).map(function (f, i) {
      return '<a class="ext' + (i ? '' : ' is-main') + '" href="' + esc(f.href) + '" target="_blank" rel="noopener">' + esc(f.ext) + '</a>';
    }).join('');
    return '<li class="resrow">' + link(r, 'res') + '<span class="exts">' + (extra || '<span class="ext">link</span>') + '</span></li>';
  }
  function resPair(l) {
    return STUDENT ? resBlock(l, 'student', '')
      : resBlock(l, 'student', 'Student facing') + resBlock(l, 'teacher', 'Teacher facing');
  }
  function resBlock(l, who, title) {
    var rs = res(l, who);
    return '<div class="resblock">' + (title ? '<h4>' + title + '</h4>' : '') +
      (rs.length ? (AP ? '<div class="reslist fbtns">' + rs.map(resRow).join('') + '</div>' : '<ul class="reslist">' + rs.map(resRow).join('') + '</ul>') : '<p class="none">Nothing here yet</p>') + '</div>';
  }
  function list(arr, cls) {
    if (!arr.length) return '<p class="none">' + EMPTY + '</p>';
    return '<ul class="' + (cls || 'pts') + '">' + arr.map(function (x) { return '<li>' + fmt(text(x)) + '</li>'; }).join('') + '</ul>';
  }
  function ekHtml(s, open) {
    if (!s.ek || !s.ek.length) return '';
    var n = s.ek.reduce(function (a, lo) { return a + lo.eks.length; }, 0);
    return '<details class="ek"' + (open ? ' open' : '') + '><summary>Essential knowledge (' + n + ')</summary>' +
      s.ek.map(function (lo) {
        return '<div class="lo"><b>' + esc(lo.code) + '</b> ' + esc(lo.text) + '</div><ul class="eks">' +
          lo.eks.map(function (e) {
            return '<li><span class="ekc">' + esc(e.code) + '</span>' +
              (e.img ? '<img src="' + e.img + '" alt="' + esc(e.code) + '">' : '<span>' + esc(e.text) + '</span>') + '</li>';
          }).join('') + '</ul>';
      }).join('') + '</details>';
  }
  function stdList(arr, open) {
    if (!arr.length) return '<p class="none">' + EMPTY + '</p>';
    return '<dl class="stds">' + arr.map(function (s) {
      return '<dt>' + esc(s.code || '') + '</dt><dd>' + fmt(s.text || '') + ekHtml(s, open) + '</dd>';
    }).join('') + '</dl>';
  }

  /* ---------- chrome ---------- */
  function top() {
    var here = (D.unit || {}).id;
    var units = (C.units || []).map(function (u) {
      var label = esc(u.number), tip = esc('Unit ' + u.number + (u.title ? ': ' + u.title : ''));
      if (u.id === here) return '<span class="u is-here" aria-current="page" title="' + tip + '">' + label + '</span>';
      if (u.page) return '<a class="u" href="' + ROOT + esc(u.page) + '" title="' + tip + '">' + label + '</a>';
      return '<span class="u is-off" title="' + tip + ' (no page yet)">' + label + '</span>';
    }).join('');
    return '<header class="top"><div class="wrap top-in">' +
      '<span class="course">' + esc(C.course || (D.unit || {}).course || '') + '</span>' +
      '<nav class="units" aria-label="Units">' + units + '</nav>' +
      '<button class="btn" type="button" data-act="drawer">Course resources</button></div></header>';
  }
  function mast() {
    var u = D.unit || {};
    var nRes = L.reduce(function (n, l) { return n + (l.resources || []).length; }, 0);
    var nSk = L.reduce(function (n, l) { return n + items(l, 'skills').length; }, 0);
    var codes = {};
    L.forEach(function (l) { (l.standards || []).forEach(function (s) { codes[s.code] = 1; }); });
    var quick = (D.unitResources || []).filter(function (r) { return r.group === 'This unit'; }).slice(0, 4)
      .map(function (r) { return link(r, 'res'); }).join('');
    return '<section class="mast wrap"><div class="mast-l"><p class="eyebrow">Unit ' + esc(u.number || '') + '</p>' +
      '<h1>' + esc(u.title || u.id || '') + '</h1></div>' +
      '<div class="mast-r">' + (u.overview ? '<p class="overview">' + fmt(u.overview) + '</p>' : '') +
      '<p class="stats"><span><b>' + L.length + '</b> lessons</span><span><b>' + Object.keys(codes).length +
      '</b> standards</span><span><b>' + nSk + '</b> skills</span><span><b>' + nRes + '</b> resources</span>' +
      (quick ? '<span class="quick">' + quick + '</span>' : '') + '</p></div></section>';
  }
  function lensBar() {
    var tabs = [{ key: 'overview', bar: 'Overview' }].concat(CATS).map(function (c) {
      var on = state.lens === c.key;
      return '<a class="tab' + (on ? ' is-on' : '') + '" href="#' + (c.key === 'overview' ? '' : c.key) + '"' +
        (on ? ' aria-current="true"' : '') + '>' + c.bar + '</a>';
    }).join('');
    return '<nav class="lens" aria-label="Category"><div class="wrap lens-in">' + tabs + '</div></nav>';
  }

  /* ---------- the 1-pager ---------- */
  function titleCell(l) {
    return '<a class="cell c-title" href="#' + l.id + '" style="--vt:t-' + l.id + '">' +
      '<span class="num">' + pad(l.n) + '</span><span class="ttl"><b>' + fmt(l.title || 'Lesson ' + l.n) + '</b>' +
      (l.topic ? '<i>' + fmt(l.topic) + '</i>' : '') + '</span></a>';
  }
  function overviewRow(l) {
    var std = (l.standards || []).map(function (s) { return '<span class="code">' + esc(s.code) + '</span>'; }).join('');
    var sk = items(l, 'skills');
    var skills = sk.slice(0, 3).map(function (s) { return '<span class="ln">' + fmt(text(s)) + '</span>'; }).join('') +
      (sk.length > 3 ? '<span class="more">+' + (sk.length - 3) + ' more</span>' : '');
    var ref = REF.map(function (k) {
      if (off(l, k)) return '';
      var it = items(l, k);
      return '<a class="rl" href="#' + l.id + '/' + k + '"><span class="tag">' + CAT[k].tag + '</span>' +
        '<span class="ln">' + (it.length ? fmt(text(it[0])) : '<span class="none">' + EMPTY + '</span>') + '</span>' +
        (it.length > 1 ? '<span class="ct">' + it.length + '</span>' : '') + '</a>';
    }).join('');
    function who(w, name) {
      var rs = res(l, w);
      return '<div class="who"><a class="tag" href="#' + l.id + '/resources">' + name + '</a><span class="links">' +
        (rs.length ? rs.slice(0, 3).map(function (r) { return link(r, 'res'); }).join('') : '<span class="none">none yet</span>') +
        (rs.length > 3 ? '<a class="more" href="#' + l.id + '/resources">+' + (rs.length - 3) + ' more</a>' : '') + '</span></div>';
    }
    if (AP) return '<li class="row" data-id="' + l.id + '">' + titleCell(l) +
      '<a class="cell c-std" href="#' + l.id + '/standards">' + (std || '<span class="none">none</span>') + '</a>' +
      (off(l, 'skills') ? '<span class="cell c-skills"></span>' :
        '<a class="cell c-skills" href="#' + l.id + '/skills">' + (skills || '<span class="none">' + EMPTY + '</span>') + '</a>') +
      '<a class="cell c-sum" href="#' + l.id + '">' + (l.summary ? fmt(l.summary) : '<span class="none">' + EMPTY + '</span>') + '</a></li>';
    return '<li class="row" data-id="' + l.id + '">' + titleCell(l) +
      '<a class="cell c-std" href="#' + l.id + '/standards">' + (std || '<span class="none">none</span>') + '</a>' +
      (off(l, 'skills') ? '<span class="cell c-skills"></span>' :
        '<a class="cell c-skills" href="#' + l.id + '/skills">' + (skills || '<span class="none">' + EMPTY + '</span>') + '</a>') +
      '<div class="cell c-ref">' + ref + '</div>' +
      '<div class="cell c-res">' + (STUDENT ? who('student', 'Files') : who('student', 'Student') + who('teacher', 'Teacher')) + '</div></li>';
  }
  function lensRow(l, key) {
    var body;
    if (key === 'resources') body = '<div class="pair">' + resPair(l) + '</div>';
    else if (key === 'standards') body = stdList(items(l, key), true);
    else if (off(l, key)) body = '<p class="none">' + (STUDENT ? 'Not part of this lesson' : 'Switched off for this lesson') + '</p>';
    else body = list(items(l, key), 'pts cols');
    return '<li class="row is-lens" data-id="' + l.id + '">' + titleCell(l) +
      '<div class="cell c-full" data-open="' + l.id + '/' + key + '">' + body + '</div></li>';
  }
  function board() {
    var k = state.lens, head, rows;
    if (k === 'overview') {
      if (AP) head = '<div class="row head" aria-hidden="true"><span>Lesson</span><a href="#standards">CED</a><a href="#skills">Skills</a><span>Summary</span></div>';
      else head = '<div class="row head" aria-hidden="true"><span>Lesson</span>' +
        '<a href="#standards">Standards</a><a href="#skills">Skills</a>' +
        '<span class="refhead">' + (STUDENT ? 'Summary' : 'Refresher') + ' ' + REF.map(function (k) {
          return '<a href="#' + k + '">' + CAT[k].tag.toLowerCase() + '</a>';
        }).join(' ') + '</span><a href="#resources">' + CAT.resources.bar + '</a></div>';
      rows = L.map(overviewRow).join('');
    } else {
      var total = L.reduce(function (n, l) { return n + items(l, k).length; }, 0);
      head = '<div class="row head is-lens"><span>Lesson</span><span>' + CAT[k].label +
        ' <em>' + total + ' across ' + L.length + ' lessons</em></span></div>';
      rows = L.map(function (l) { return lensRow(l, k); }).join('');
    }
    return '<main class="wrap"><div class="board" data-lens="' + k + '">' + head + '<ol class="rows">' + rows + '</ol></div>' +
      '<p class="foot">Updated ' + esc((D.updated || '').slice(0, 10)) + '. Click any cell to zoom into that lesson. ' +
      'Arrow keys move between lessons, Esc returns here.</p></main>';
  }

  /* ---------- the zoomed lesson ---------- */
  function sheet() {
    var l = byId(state.lesson);
    if (!l) return '';
    var i = L.indexOf(l), prev = L[i - 1], next = L[i + 1];
    var back = state.lens === 'overview' ? '' : state.lens;
    function sec(key, inner, cls) {
      return '<section class="sec ' + (cls || '') + (state.section === key ? ' is-focus' : '') + '" id="s-' + key + '">' +
        '<h3>' + CAT[key].label + '</h3>' + inner + '</section>';
    }
    var ext = (l.links || []).length ? '' : '';
    return '<div class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-label="Lesson ' + l.n + '"><div class="wrap sheet-in">' +
      '<div class="sheet-bar"><a class="back" href="#' + back + '" data-back><span aria-hidden="true">&larr;</span> Unit ' +
      esc((D.unit || {}).number || '') + ' ' + esc((D.unit || {}).title || '') + '</a><span class="pager">' +
      (prev ? '<a href="#' + prev.id + '" title="' + esc(prev.title) + '"><span aria-hidden="true">&lsaquo;</span> ' + pad(prev.n) + '</a>' : '<span class="off">&lsaquo;</span>') +
      (next ? '<a href="#' + next.id + '" title="' + esc(next.title) + '">' + pad(next.n) + ' <span aria-hidden="true">&rsaquo;</span></a>' : '<span class="off">&rsaquo;</span>') +
      '</span></div>' +
      '<header class="s-head" style="--vt:t-' + l.id + '"><span class="num">' + pad(l.n) + '</span><div><h2>' + fmt(l.title || '') + '</h2>' +
      (l.topic ? '<p>' + fmt(l.topic) + '</p>' : '') + (l.status ? '<p class="status">' + fmt(l.status) + '</p>' : '') + '</div></header>' +
      '<div class="s-grid"><div class="s-main"><div class="quad">' +
      REF.filter(function (k) { return !off(l, k); }).map(function (k) { return sec(k, list(items(l, k))); }).join('') + '</div>' +
      (off(l, 'skills') ? '' : sec('skills', list(items(l, 'skills'), 'pts cols'))) +
      (l.notes ? '<section class="sec"><h3>My notes</h3><p class="notes">' + fmt(l.notes) + '</p></section>' : '') + '</div>' +
      '<aside class="s-side">' + sec('standards', stdList(items(l, 'standards'))) +
      sec('resources', resPair(l) + ext) +
      '</aside></div></div></div>';
  }
  function drawer() {
    var groups = {}, order = [];
    function add(g, html) { if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(html); }
    (C.resources || []).forEach(function (r) {
      add(r.group || 'Course', '<li class="resrow"><a class="res" target="_blank" rel="noopener" href="' +
        (/^[a-z][a-z0-9+.-]*:\/\//i.test(r.href) ? esc(r.href) : ROOT + esc(r.href)) + '">' + esc(r.label) + '</a></li>');
    });
    (D.unitResources || []).forEach(function (r) { add(r.group || 'This unit', resRow(r)); });
    return '<dialog class="drawer" aria-label="Course resources"><div class="drawer-in"><div class="drawer-bar"><h2>Resources</h2>' +
      '<button class="btn" type="button" data-act="close">Close</button></div>' +
      (order.length ? order.map(function (g) {
        return '<h4>' + esc(g) + '</h4><ul class="reslist">' + groups[g].join('') + '</ul>';
      }).join('') : '<p class="none">No course resources listed yet.</p>') + '</div></dialog>';
  }

  /* ---------- drawing and motion ---------- */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function vt(fn) {
    if (document.startViewTransition && !reduce) { try { document.startViewTransition(fn); return; } catch (e) { /* draw plainly */ } }
    fn();
  }
  function drawBase() {
    app.innerHTML = top() + mast() + '<div id="lens"></div><div id="board"></div><div id="sheet"></div>' + drawer();
  }
  function draw() {
    document.getElementById('lens').innerHTML = lensBar();
    document.getElementById('board').innerHTML = board();
    document.getElementById('sheet').innerHTML = sheet();
    document.body.classList.toggle('zoomed', !!state.lesson);
    var l = state.lesson && byId(state.lesson);
    document.title = (l ? 'L' + l.n + ' ' + l.title + ' · ' : '') + ((D.unit || {}).id || '') + ' · ' + ((D.unit || {}).title || '');
    if (l) {
      var sh = document.querySelector('.sheet'), f = state.section && document.getElementById('s-' + state.section);
      sh.scrollTop = 0;
      if (f && f.getBoundingClientRect().bottom > window.innerHeight) f.scrollIntoView({ block: 'center' });
      sh.focus({ preventScroll: true });
    }
  }
  function read() {
    var h = decodeURIComponent(location.hash.replace(/^#/, '')), p = h.split('/');
    var next = { lens: state.lens, lesson: null, section: null };
    if (byId(p[0])) { next.lesson = p[0]; next.section = CAT[p[1]] ? p[1] : null; }
    else next.lens = CAT[h] ? h : 'overview';
    return next;
  }
  function go(animate) {
    var next = read();
    var same = next.lens === state.lens && next.lesson === state.lesson && next.section === state.section;
    if (same && animate) return;
    var y = window.scrollY, keep = next.lesson || state.lesson;
    var apply = function () { state = next; draw(); if (keep) window.scrollTo(0, y); };
    if (animate) vt(apply); else apply();
  }

  drawBase();
  go(false);
  window.addEventListener('hashchange', function () { go(true); });

  document.addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    var dlg = document.querySelector('.drawer');
    if (act) { if (act.dataset.act === 'drawer') dlg.showModal(); else dlg.close(); return; }
    if (e.target === dlg) { dlg.close(); return; }
    var open = e.target.closest('[data-open]');
    if (open && !e.target.closest('a')) location.hash = open.dataset.open;
  });
  document.addEventListener('keydown', function (e) {
    if (!state.lesson || e.metaKey || e.ctrlKey || e.altKey) return;
    var i = L.indexOf(byId(state.lesson));
    if (e.key === 'Escape') { location.hash = state.lens === 'overview' ? '' : state.lens; }
    else if (e.key === 'ArrowRight' && L[i + 1]) location.hash = L[i + 1].id;
    else if (e.key === 'ArrowLeft' && L[i - 1]) location.hash = L[i - 1].id;
  });
})();

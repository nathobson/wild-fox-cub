/*
 * Wild Fox Digital — the scroll engine for published pages (and the composer's
 * preview). Everything is scrubbed to the scroll position, which Lenis smooths.
 *
 * - [data-scroll]: --p goes 0 → 1 as the element passes through the screen.
 * - [data-pin] with data-steps="n": --pin goes 0 → 1 through the pinned stretch, and
 *   each [data-step="i"] child gets --s (pin × n − i: 0 → 1 while it's current).
 * - [data-canvas]: a stack of composed stories (src/site/comp/model.ts). Each story
 *   plays as a reading sequence: its pieces of text and its lines arrive one at a
 *   time, in reading order, scrubbed to the scroll position (pieces get --r, 0 → 1,
 *   and their letters rise in turn). A story with a hold pins on screen while its
 *   sequence plays, then moves on. Each story's photograph crossfades in as the
 *   story arrives; --out frames the photo at the end.
 * - Other .line and [data-reveal] elements get .in when they reach the reading line.
 * - The header takes the tone of what's behind it; [data-accent] sets the accent.
 */
(function () {
  var root = document.documentElement;
  var SVG = 'http://www.w3.org/2000/svg';
  var PHONE = 700;
  // Pacing of the reading sequence, in screens (as PACE in src/site/comp/model.ts).
  // tempo stretches every arrival (and the gaps between them) by the same amount.
  var PACE = { lead: 0.14, piece: 0.1, reveal: 0.4, hero: 1.5, overlap: 0.3, cap: 0.45, row: 0.04, caption: 0.1, tempo: 1.6 };
  // The reading line: where on the screen the reader is, from the top.
  var READ = 0.74;

  function clamp(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function all(sel, el) {
    return [].slice.call((el || document).querySelectorAll(sel));
  }
  function el(name, cls) {
    var e = document.createElementNS(SVG, name);
    if (cls) e.setAttribute('class', cls);
    return e;
  }
  var uid = 0;

  function start() {
    var header = document.querySelector('[data-header]');
    var accent = document.querySelector('[data-accent]');
    if (accent && /^#[0-9a-f]{3,8}$/i.test(accent.dataset.accent || '')) root.style.setProperty('--accent', accent.dataset.accent);

    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var vh = innerHeight;
    var vw = innerWidth;
    var began = performance.now();

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          io.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -16% 0px' },
    );

    var tracked = all('[data-scroll]');
    tracked.forEach(function (e) {
      e.track = e.querySelector('[data-track]');
      // A track's pictures start off to the side, where lazy loading would hold them back.
      if (e.track)
        all('img', e.track).forEach(function (img) {
          img.loading = 'eager';
        });
      e.hx = all('[data-hx]', e);
    });
    // (Stories inside a canvas don't count: there the header follows the background showing.)
    var tones = all('main [data-tone]:not([data-story])');
    var comps = all('[data-canvas]').map(setupCanvas);
    all('.line,[data-reveal]').forEach(function (e) {
      if (!e.closest('[data-piece]')) io.observe(e);
    });

    /* ---- Story canvases ---- */

    function setupCanvas(c) {
      var comp = c.querySelector('[data-comp]');
      // Only the photographs use --p and --out: setting them on the stage, not the whole
      // canvas, saves restyling every letter of every story each frame.
      c.vars = c.querySelector('.wf-canvas-stage') || c;
      var stories = all('[data-story]', comp).map(function (st) {
        return {
          el: st,
          pin: st.querySelector('[data-pin-story]') || st,
          cam: st.querySelector('[data-cam]'),
          hold: +getComputedStyle(st).getPropertyValue('--hold') || 0,
          beats: (st.dataset.beats || '').split(',').filter(Boolean).map(Number),
          drift: +st.dataset.drift || 0,
          float: st.classList.contains('float'),
          pieces: all('[data-piece]', st).map(function (p) {
            splitLetters(p);
            return {
              el: p,
              id: p.dataset.piece,
              wait: +p.dataset.wait || 0,
              brackets: p.classList.contains('has-brackets'),
              hero: p.classList.contains('st-hero'),
            };
          }),
          layouts: all('.wf-comp-lines', st).map(function (svg) {
            svg.classList.add('live');
            return {
              name: svg.getAttribute('data-layout'),
              svg: svg,
              lines: all('path[data-line]', svg).map(function (p) {
                return setupLine(svg, p);
              }),
            };
          }),
          steps: [],
        };
      });
      var pieces = {};
      var storyOf = {};
      stories.forEach(function (st) {
        st.pieces.forEach(function (p) {
          pieces[p.id] = p.el;
          storyOf[p.id] = st;
        });
      });
      return {
        el: c,
        comp: comp,
        pieces: pieces,
        storyOf: storyOf,
        stories: stories,
        firstTone: (c.querySelector('[data-layer]') || c).classList.contains('paper') ? 'light' : 'dark',
        // Each background's story and tone, in order (when it changes tone, the story before fades out).
        chain: all('[data-layer]', c).map(function (layer) {
          return { story: comp.querySelector('[data-story="' + layer.dataset.story + '"]'), paper: layer.classList.contains('paper') };
        }),
        layers: all('[data-layer]', c)
          .slice(1)
          .map(function (layer) {
            return {
              el: layer,
              story: comp.querySelector('[data-story="' + layer.dataset.story + '"]'),
              fade: +layer.dataset.fade || 0,
              pull: layer.classList.contains('pull'),
              settle: layer.dataset.enter === 'settle',
            };
          }),
        end: c.querySelector('[data-canvas-end]'),
      };
    }

    function setupLine(svg, p) {
      var nodes = p.dataset.nodes ? JSON.parse(p.dataset.nodes) : null;
      var line = {
        el: p,
        nodes: nodes,
        from: p.dataset.from || (nodes && nodes[0].at && nodes[0].at.piece),
        to: p.dataset.to || (nodes && nodes[nodes.length - 1].at && nodes[nodes.length - 1].at.piece),
        dots: p.dataset.dots || 'none',
      };
      p.setAttribute('pathLength', '1');
      if (p.hasAttribute('data-dash')) {
        // Dashed: a solid stroke drawn inside a mask reveals the dashes.
        var mask = el('mask');
        mask.id = 'wf-m' + uid++;
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        line.draw = el('path', 'wf-draw');
        line.draw.setAttribute('pathLength', '1');
        mask.appendChild(line.draw);
        svg.insertBefore(mask, svg.firstChild);
        p.setAttribute('mask', 'url(#' + mask.id + ')');
        p.removeAttribute('pathLength');
      } else {
        line.draw = p;
        p.style.strokeDasharray = '1 1';
      }
      line.dotA = line.dots === 'start' || line.dots === 'both' ? svg.appendChild(el('circle')) : null;
      line.dotB = line.dots === 'end' || line.dots === 'both' ? svg.appendChild(el('circle')) : null;
      return line;
    }

    function measureCanvas(cv) {
      var W = cv.comp.getBoundingClientRect().width;
      var k = W / 100;
      var phone = W < PHONE;

      // Measured where they'd be without the camera or drift moving them.
      cv.stories.forEach(function (st) {
        if (st.cam) unset(st.cam, 'transform');
        if (st.drift) unset(st.pin, 'translate');
      });
      cv.stories.forEach(function (st) {
        st.box = (st.cam || st.pin).getBoundingClientRect();
        // How far the pin is currently stuck down its story (0 unless it's held right now).
        st.stuck = st.box.top - st.el.getBoundingClientRect().top;
        st.holdPx = st.hold * vh;
        // Where its pieces are (from the top of its pin): what gets centred, rather than the story's whole box.
        st.content = { top: Infinity, bottom: -Infinity };
        st.pieces.forEach(function (p) {
          if (!p.el.offsetParent) return;
          var r = p.el.getBoundingClientRect();
          st.content.top = Math.min(st.content.top, r.top - st.box.top);
          st.content.bottom = Math.max(st.content.bottom, r.bottom - st.box.top);
        });
        if (st.content.top === Infinity) st.content = { top: 0, bottom: st.box.height };
        // A camera story (desktop) holds a screen-sized window still at the top of the screen,
        // each stop centred on what it shows.
        st.plan =
          st.cam && !phone
            ? cameraPlan(
                st.box.height,
                st.hold,
                st.beats.map(function (b) {
                  return b * k;
                }),
                vh,
                pieceSpans(st),
              )
            : null;
        // A held story pins with its pieces in the middle of the screen (or, if they're
        // taller than the screen, with the last of them in view).
        var c = st.content;
        st.pinTop = st.plan || !st.hold ? 0 : Math.round(c.bottom - c.top <= vh * 0.9 ? vh / 2 - (c.top + c.bottom) / 2 : vh * 0.95 - c.bottom);
        if (st.hold) st.el.style.setProperty('--pin-top', st.pinTop + 'px');
        st.pinH = st.pin.offsetHeight;
        st.slack = st.el.offsetHeight - st.pinH;
      });

      cv.stories.forEach(function (st) {
        // Lines are drawn in their story's own space; free points are measured from its top.
        var box = st.box;
        // Where a piece sits relative to this story's pin. For a line that runs on into
        // another story, measured as it will be once this story's hold has released and
        // both ends scroll together (a story the line runs into is not yet held then).
        function rect(pid, cross) {
          var p = cv.pieces[pid];
          var ps = cv.storyOf[pid];
          if (!p || !ps || !p.offsetParent) return null;
          var r = p.getBoundingClientRect();
          var first = p.querySelector('.line');
          var y = r.top - box.top;
          if (cross) y = r.top - ps.stuck + (ps === st ? st.holdPx : 0) - (box.top - st.stuck + st.holdPx);
          return { x: r.left - box.left, y: y, w: r.width, h: r.height, lh: first ? first.getBoundingClientRect().height : 20 };
        }
        // Once the hold has released: the reading position (from the story's top) then.
        var released = st.plan ? st.plan.released : st.hold ? vh * READ - st.pinTop + st.holdPx : 0;
        // When the reading line reaches this height (a camera story's screen stops and starts).
        function reach(y) {
          return st.plan ? cameraRead(st.plan, y) : y;
        }
        var steps = [];
        st.pieces.forEach(function (p) {
          var r = rect(p.id);
          // (Hero-sized words take longer, zooming up into place.)
          var span = PACE.reveal * PACE.tempo * vh * (p.hero ? PACE.hero : 1);
          if (r) steps.push({ kind: 'piece', item: p, id: p.id, natural: reach(r.y - PACE.lead * vh) + p.wait * vh, x: r.x, box: r, span: span, hero: p.hero });
        });
        st.layouts.forEach(function (layout) {
          var active = (layout.name === 'phone') === phone;
          layout.active = active;
          if (!active) return;
          layout.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Math.max(box.height, 1));
          layout.lines.forEach(function (l) {
            var d;
            var cross = (l.from && cv.storyOf[l.from] && cv.storyOf[l.from] !== st) || (l.to && cv.storyOf[l.to] && cv.storyOf[l.to] !== st);
            if (l.nodes) {
              var pts = l.nodes.map(function (n) {
                var r = n.at && rect(n.at.piece, cross);
                return r ? { x: r.x + n.at.ax * r.w + n.at.dx * k, y: r.y + n.at.ay * r.h + n.at.dy * k } : { x: n.x * k, y: n.y * k };
              });
              d = 'M' + pts[0].x + ' ' + pts[0].y;
              for (var i = 1; i < l.nodes.length; i++) {
                var a = l.nodes[i - 1];
                var b = l.nodes[i];
                d += ' C' + (pts[i - 1].x + a.ox * k) + ' ' + (pts[i - 1].y + a.oy * k) + ' ' + (pts[i].x + b.ix * k) + ' ' + (pts[i].y + b.iy * k) + ' ' + pts[i].x + ' ' + pts[i].y;
              }
            } else {
              var A = rect(l.from, cross);
              var B = rect(l.to, cross);
              if (!A || !B) {
                l.el.setAttribute('d', '');
                l.samples = null;
                return;
              }
              d = flowPath(A, B);
            }
            l.el.setAttribute('d', d);
            if (l.draw !== l.el) l.draw.setAttribute('d', d);
            sample(l);
            var s = l.samples;
            var target = l.to && rect(l.to, cross);
            // A line running on out of a held story waits until the hold has released.
            steps.push({
              kind: 'line',
              item: l,
              from: l.from,
              to: l.to,
              cross: cross,
              natural: reach(s[0].t),
              floor: cross && st.hold ? released : -Infinity,
              // Where the text it runs into would naturally arrive: the line should be there by then.
              // (After a hold releases, the story's text sits the hold's length further down.)
              due: !target ? Infinity : (cross ? target.y + st.holdPx - PACE.lead * vh : reach(target.y - PACE.lead * vh)) + PACE.piece * PACE.tempo * vh,
              x: l.start.x,
              raw: Math.max(s[s.length - 1].t - s[0].t, 1),
              span: Math.max((s[s.length - 1].t - s[0].t) * PACE.tempo, 1),
            });
          });
        });
        st.steps = sequence(steps);
        if (st.float) placeHero(st);
        st.docTop = st.el.getBoundingClientRect().top + scrollY;
      });

      // Text a line runs into from another story waits for the line too (reading
      // positions differ between stories only by how far apart their tops are).
      cv.stories.forEach(function (st) {
        st.steps.forEach(function (s) {
          if (s.kind !== 'line' || !s.cross || !s.to) return;
          var other = cv.storyOf[s.to];
          if (!other || other === st) return;
          other.steps.forEach(function (t) {
            if (t.kind === 'piece' && t.id === s.to) t.start = Math.max(t.start, s.start + s.span * 0.96 + st.docTop - other.docTop);
          });
        });
      });
    }

    /*
     * The reading order (as sequence() in src/site/comp/model.ts): by height, then
     * left to right along a row; a line straight after the piece it starts from and
     * before the piece it runs into; a caption straight after its piece. Each step starts once the one before has mostly
     * arrived, but never before it reaches the reader, nor too long after; text a line
     * runs into waits for the line to finish.
     */
    function sequence(steps) {
      var row = PACE.row * vh;
      besideHeroes(steps);
      var captions = findCaptions(steps);
      var order = steps
        .filter(function (s) {
          return !s.parent;
        })
        .sort(function (a, b) {
        return Math.abs(a.natural - b.natural) < row ? a.x - b.x : a.natural - b.natural;
      });
      function find(id) {
        for (var i = 0; i < order.length; i++) if (order[i].kind === 'piece' && order[i].id === id) return order[i];
        return null;
      }
      function move(item, to) {
        order.splice(order.indexOf(item), 1);
        order.splice(to, 0, item);
      }
      var lines = order.filter(function (s) {
        return s.kind === 'line';
      });
      lines.forEach(function (line) {
        var from = find(line.from);
        if (!from) return;
        line.natural = Math.min(line.natural, from.natural);
        var fi = order.indexOf(from);
        move(line, fi + (fi > order.indexOf(line) ? 0 : 1));
      });
      lines.forEach(function (line) {
        var to = find(line.to);
        if (to && order.indexOf(to) < order.indexOf(line)) move(to, order.indexOf(line));
      });
      // Captions go straight after their piece (and after any caption already there), top first.
      captions
        .sort(function (a, b) {
          return a.box.y - b.box.y;
        })
        .forEach(function (c) {
          var anchor = c.parent.tail || c.parent;
          order.splice(order.indexOf(anchor) + 1, 0, c);
          c.natural = Math.min(c.natural, c.parent.natural);
          c.parent.tail = c;
        });
      // Each step holds the next back by about one piece's worth (a line holds back the text it runs into until it arrives).
      var after = -Infinity;
      var lineEnds = {};
      order.forEach(function (s) {
        var start = Math.max(Math.min(Math.max(s.natural, after), s.natural + PACE.cap * PACE.tempo * vh), s.floor === undefined ? -Infinity : s.floor);
        // A line draws faster if it must, to reach its text by the time that text reaches the reader.
        if (s.kind === 'line' && s.due < Infinity) s.span = Math.max(Math.min(s.span, s.due - start), s.span * 0.35);
        s.start = s.kind === 'piece' && lineEnds[s.id] !== undefined ? Math.max(start, lineEnds[s.id]) : start;
        var hold = s.kind === 'line' ? Math.min(s.span, PACE.piece * PACE.tempo * vh) : PACE.piece * PACE.tempo * vh;
        // (A line running on into another story doesn't hold back the rest of its own.)
        if (!(s.kind === 'line' && s.cross)) after = s.start + hold * (1 - PACE.overlap);
        if (s.kind === 'line' && s.to) lineEnds[s.to] = Math.max(lineEnds[s.to] === undefined ? -Infinity : lineEnds[s.to], s.start + s.span * 0.96);
      });
      return order;
    }

    // Smaller text set beside hero-sized words (level with them) arrives as they finish arriving.
    function besideHeroes(steps) {
      var heroes = steps.filter(function (s) {
        return s.hero && s.box;
      });
      steps.forEach(function (s) {
        if (s.kind !== 'piece' || s.hero || !s.box) return;
        heroes.forEach(function (h) {
          if (s.box.y < h.box.y + h.box.h && s.box.y + s.box.h > h.box.y) s.natural = Math.max(s.natural, h.natural + h.span * 0.8);
        });
      });
    }

    // A piece just under another and overlapping it is its caption (sets .parent); hero-sized words never are.
    function findCaptions(steps) {
      var pieces = steps.filter(function (s) {
        return s.kind === 'piece';
      });
      return pieces.filter(function (b) {
        // (Hero-sized words are never a caption.)
        if (b.hero) return false;
        var best = null;
        var bestGap = Infinity;
        pieces.forEach(function (a) {
          if (a === b) return;
          var gap = b.box.y - (a.box.y + a.box.h);
          var overlap = Math.min(a.box.x + a.box.w, b.box.x + b.box.w) - Math.max(a.box.x, b.box.x);
          if (gap > -0.01 * vh && gap < PACE.caption * vh && overlap > 0.3 * Math.min(a.box.w, b.box.w) && gap < bestGap) {
            best = a;
            bestGap = gap;
          }
        });
        b.parent = best;
        return !!best;
      });
    }

    // The phone flow's line between two pieces: down from under the first, then across.
    function flowPath(a, b) {
      var sx = a.x + 1;
      var sy = a.y + a.h + 12;
      if (b.x - sx > 40) {
        var ex = b.x - 14;
        var ey = b.y + b.lh * 0.55;
        return 'M' + sx + ' ' + sy + ' C' + sx + ' ' + (sy + (ey - sy) * 0.9) + ' ' + (sx + (ex - sx) * 0.1) + ' ' + ey + ' ' + ex + ' ' + ey;
      }
      var x2 = b.x + 1;
      var y2 = b.y - 14;
      var mid = (sy + y2) / 2;
      return Math.abs(sx - x2) < 4 ? 'M' + sx + ' ' + sy + ' L' + x2 + ' ' + y2 : 'M' + sx + ' ' + sy + ' C' + sx + ' ' + mid + ' ' + x2 + ' ' + mid + ' ' + x2 + ' ' + y2;
    }

    /*
     * A line's tip moves with the scrolling: going down it keeps pace with the reader;
     * going across it takes half as much scrolling per pixel.
     */
    function sample(l) {
      var p = l.el;
      var len = p.getTotalLength();
      var n = Math.max(16, Math.min(240, Math.round(len / 8)));
      var prev = p.getPointAtLength(0);
      var time = prev.y;
      l.samples = [{ t: time, f: 0 }];
      l.start = prev;
      for (var i = 1; i <= n; i++) {
        var pt = p.getPointAtLength((len * i) / n);
        time += Math.abs(pt.y - prev.y) + Math.abs(pt.x - prev.x) * 0.5;
        l.samples.push({ t: time, f: i / n });
        prev = pt;
      }
      l.end = prev;
      if (l.dotA) place(l.dotA, l.start, l.el);
      if (l.dotB) place(l.dotB, l.end, l.el);
    }

    function place(dot, pt, path) {
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', (+path.dataset.weight || 1) + 1.6);
    }

    function progress(l, t) {
      var s = l.samples;
      if (t <= s[0].t) return 0;
      if (t >= s[s.length - 1].t) return 1;
      var lo = 0;
      var hi = s.length - 1;
      while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (s[mid].t <= t) lo = mid;
        else hi = mid;
      }
      var a = s[lo];
      var b = s[hi];
      return a.f + ((b.f - a.f) * (t - a.t)) / (b.t - a.t || 1);
    }

    /*
     * A camera story's plan (as cameraPlan in src/site/comp/model.ts): the screen holds
     * still at each stop (the top, each beat, the end), sharing the hold between them,
     * and glides on between them; while it's still, the reading line sweeps down what's
     * on screen. Positions count from where the story's top passes the reading line.
     */
    function cameraPlan(height, hold, beats, screen, spans) {
      var end = height - screen;
      if (!beats.length || hold <= 0 || end < screen * 0.05) return null;
      var stops = [0];
      beats
        .slice()
        .sort(function (a, b) {
          return a - b;
        })
        .forEach(function (b) {
          if (b > stops[stops.length - 1] + screen * 0.1 && b < end - screen * 0.1) stops.push(b);
        });
      stops.push(end);
      stops = centreStops(stops, spans || [], screen, end);
      var still = (hold * screen) / stops.length;
      var r0 = READ * screen;
      var segs = [];
      // (Before it pins, the content already sits where the first stop puts it.)
      var q = [[r0, r0 + stops[0]]];
      var r = r0;
      var sweep = 0;
      stops.forEach(function (stop, i) {
        var next = stops[i + 1];
        sweep = next === undefined ? screen * 0.95 : Math.min(screen * 0.95, next - stop + r0);
        q.push([r, stop + r0], [r + still, stop + sweep]);
        segs.push({ r0: r, r1: r + still, c0: stop, c1: stop });
        r += still;
        if (next === undefined) return;
        segs.push({ r0: r, r1: r + next - stop, c0: stop, c1: next });
        r += next - stop;
      });
      q.push([r + sweep - r0, end + sweep]);
      return { stops: stops, segs: segs, q: q, released: r, hold: hold * screen };
    }

    // Each stop moves to centre the pieces it shows (those whose middle is in its screen), in order.
    function centreStops(stops, spans, screen, end) {
      var out = [];
      stops.forEach(function (stop) {
        var top = Infinity;
        var bottom = -Infinity;
        spans.forEach(function (s) {
          var mid = (s.top + s.bottom) / 2;
          if (mid < stop || mid > stop + screen) return;
          top = Math.min(top, s.top);
          bottom = Math.max(bottom, s.bottom);
        });
        var at = top === Infinity || bottom - top > screen * 0.9 ? stop : (top + bottom) / 2 - screen / 2;
        // (The first may sit above the story's top; the last stays at its end, where it lets go.)
        at = Math.max(-screen * 0.4, Math.min(end, at));
        if (!out.length || at > out[out.length - 1] + screen * 0.1) out.push(at);
      });
      out[out.length - 1] = end;
      return out;
    }

    // A story's pieces, top to bottom (from the top of its pin).
    function pieceSpans(st) {
      return st.pieces
        .filter(function (p) {
          return p.el.offsetParent;
        })
        .map(function (p) {
          var r = p.el.getBoundingClientRect();
          return { top: r.top - st.box.top, bottom: r.bottom - st.box.top };
        });
    }

    function cameraRead(plan, y) {
      var q = plan.q;
      if (y <= q[0][1]) return y + q[0][0] - q[0][1];
      for (var i = 1; i < q.length; i++) {
        var a = q[i - 1];
        var b = q[i];
        if (y <= b[1]) return b[1] > a[1] ? a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) : b[0];
      }
      return y + plan.hold;
    }

    function cameraAt(plan, r) {
      for (var i = 0; i < plan.segs.length; i++) {
        var s = plan.segs[i];
        if (r > s.r1) continue;
        if (r <= s.r0) return s.c0;
        return s.c0 + (s.c1 - s.c0) * inOut((r - s.r0) / (s.r1 - s.r0));
      }
      return plan.stops[plan.stops.length - 1];
    }

    // Each step eases in and out over its span (cubic), following the scroll directly.
    function inOut(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2;
    }

    // Splits a piece's words into letters (.c, numbered by --i; --cn counts them), so they rise one by one.
    function splitLetters(p) {
      var text = p.querySelector('.wf-piece-text');
      if (text)
        text.setAttribute(
          'aria-label',
          all('.line', text)
            .map(function (l) {
              return l.textContent.trim();
            })
            .join(' ')
            .replace(/\s+/g, ' '),
        );
      var n = 0;
      all('.w', p).forEach(function (w) {
        if (text) w.setAttribute('aria-hidden', 'true');
        var chars = Array.from(w.textContent);
        w.textContent = '';
        chars.forEach(function (ch) {
          var c = document.createElement('span');
          c.className = 'c';
          c.style.setProperty('--i', n++);
          c.textContent = ch;
          w.appendChild(c);
        });
      });
      p.style.setProperty('--cn', n);
    }

    /*
     * A hero (a story that plays on its own) isn't a reading sequence: when it arrives,
     * every letter floats out from the middle of the hero into place at once, those
     * nearest the middle a little ahead (the CSS animates it; this says from where and
     * when). Offsets ignore transforms, so it measures the letters where they rest.
     */
    // A hero starts once its fonts are in and the page has been drawn without it (so it has somewhere to float from).
    var heroReady = !document.fonts;
    if (document.fonts)
      document.fonts.ready.then(function () {
        heroReady = true;
        resize();
      });

    function placeHero(st) {
      var cx = st.pin.offsetWidth / 2;
      var cy = st.pin.offsetHeight / 2;
      var far = Math.hypot(cx, cy) || 1;
      var n = 0;
      st.pieces.forEach(function (p) {
        all('.c', p.el).forEach(function (c) {
          var x = p.el.offsetLeft + c.offsetLeft + c.offsetWidth / 2;
          var y = p.el.offsetTop + c.offsetTop + c.offsetHeight / 2;
          c.style.setProperty('--hx', ((cx - x) * 0.16).toFixed(1) + 'px');
          c.style.setProperty('--hy', ((cy - y) * 0.16).toFixed(1) + 'px');
          c.style.setProperty('--hd', (Math.hypot(x - cx, y - cy) / far * 0.6 + ((n++ * 7) % 11) / 11 * 0.08).toFixed(2) + 's');
        });
      });
    }

    function frameCanvas(cv, intro, now) {
      var box = cv.comp.getBoundingClientRect();
      if (box.bottom < -vh || box.top > vh * 2) {
        if (cv.end) set(cv.el.vars, '--out', box.bottom < 0 ? '1' : '0');
        cv.box = null;
        return;
      }
      cv.stories.forEach(function (st) {
        var top = st.el.getBoundingClientRect().top;
        if (top > vh * 2 || top + st.el.offsetHeight < -vh) return;
        // The reading position follows the scroll, not the story's text: while a held
        // story is pinned, its sequence carries on playing. As the page opens, it sweeps
        // down to where it is, so the first screen plays through in order too.
        var read = vh * READ - top;
        read = intro < 1 ? Math.min(read, -top - vh * 0.1 + (read + top + vh * 0.1) * intro) : read;
        if (st.plan) set(st.cam, 'transform', 'translate3d(0,' + (-cameraAt(st.plan, read)).toFixed(1) + 'px,0)');
        else if (st.cam) set(st.cam, 'transform', 'none');
        if (st.drift) {
          // Rises early and lingers, then lifts away: lifted by how far its pin is from the middle of the screen.
          var at = top + Math.max(0, Math.min(st.pinTop - top, st.slack));
          var d = at + st.pinH / 2 - vh / 2;
          var soft = vh * 0.15;
          set(st.pin, 'translate', '0 ' + (-st.drift * 0.5 * (Math.sqrt(d * d + soft * soft) - soft)).toFixed(1) + 'px');
        }
        if (st.float) {
          // A hero plays once it's on screen (and stays played); its lines draw as it does.
          if (!st.played && (reduce || (heroReady && now - began > 400 && top < vh * 0.85))) {
            st.played = true;
            set(st.el, 'data-played', '');
          }
          st.steps.forEach(function (s) {
            if (s.kind !== 'line') return;
            set(s.item.draw, 'stroke-dashoffset', st.played ? '0' : '1');
            if (s.item.dotA) set(s.item.dotA, 'opacity', st.played ? '1' : '0');
            if (s.item.dotB) set(s.item.dotB, 'opacity', st.played ? '1' : '0');
          });
          return;
        }
        st.steps.forEach(function (s) {
          if (s.kind === 'piece') {
            var p = s.item;
            var r = reduce ? 1 : inOut(clamp((read - s.start) / s.span));
            set(p.el, '--r', r.toFixed(4));
            // Brackets sweep on down into place for a while after the words have risen.
            if (p.brackets) {
              var b = reduce ? 1 : clamp((read - s.start) / (s.span * 2.6));
              set(p.el, '--k', (1 - Math.pow(1 - b, 3)).toFixed(4));
            }
          } else {
            var l = s.item;
            var f = reduce ? 1 : progress(l, l.samples[0].t + inOut(clamp((read - s.start) / s.span)) * s.raw);
            set(l.draw, 'stroke-dashoffset', (1 - f).toFixed(4));
            if (l.dotA) set(l.dotA, 'opacity', f > 0.002 ? '1' : '0');
            if (l.dotB) set(l.dotB, 'opacity', f > 0.985 ? '1' : '0');
          }
        });
      });
      // Each story's photo has fully faded in when the story's top reaches the middle of the screen.
      // The header takes the tone of the background that's (mostly) showing.
      cv.tone = cv.firstTone;
      cv.box = box;
      cv.layers.forEach(function (layer, i) {
        if (!layer.story) return;
        var span = Math.max(layer.fade * vh, 1);
        var at = layer.story.getBoundingClientRect();
        var o = clamp((vh * 0.5 - at.top + span) / span);
        set(layer.el, 'opacity', o.toFixed(3));
        if (o >= 0.5) cv.tone = layer.el.classList.contains('paper') ? 'light' : 'dark';
        // Going from paper to photo (or back), the story before fades out as the new background fades in,
        // so its text never sits on a background of its own colour.
        var before = cv.chain[i];
        if (before && before.story && before.paper !== cv.chain[i + 1].paper) set(before.story, '--gone', o.toFixed(3));
        // A settling photo eases from slightly zoomed in to rest as it fades in.
        if (layer.settle) set(layer.el, '--settle', (1 - inOut(o)).toFixed(4));
        // Pulls back as the story leaves, until the next photo has faded in over it.
        if (layer.pull) set(layer.el, '--leave', clamp((vh * 1.6 - at.bottom) / (vh * 1.1)).toFixed(4));
      });
      cv.out = cv.end ? clamp(1 - cv.end.getBoundingClientRect().top / vh) : 0;
      if (cv.end) set(cv.el.vars, '--out', cv.out.toFixed(4));
    }

    /* ---- Frame loop: every animation frame (Lenis glides the scroll between them) ---- */

    // A frame measures everything first and writes after: reading layout after a style
    // change would make the browser restyle mid-frame. Unchanged values aren't rewritten.
    var writes = [];
    function set(el, prop, value) {
      var key = '_wf' + prop;
      if (el[key] === value) return;
      el[key] = value;
      writes.push(el, prop, value);
    }
    // Takes a value off the page (to measure without it); the next frame writes it again.
    function unset(el, prop) {
      el.style.removeProperty(prop);
      el['_wf' + prop] = undefined;
    }
    function flush() {
      for (var i = 0; i < writes.length; i += 3) {
        if (writes[i + 1].lastIndexOf('data-', 0) === 0) writes[i].setAttribute(writes[i + 1], writes[i + 2]);
        else writes[i].style.setProperty(writes[i + 1], writes[i + 2]);
      }
      writes.length = 0;
    }

    function frame(now) {
      var t = clamp(((now || performance.now()) - began) / 1800);
      var intro = 1 - (1 - t) * (1 - t) * (1 - t);
      tracked.forEach(function (e) {
        var r = e.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) return;
        set(e.vars || e, '--p', clamp((vh - r.top) / (vh + r.height)).toFixed(4));
        // Pictures sliding across ride a wave: high at the edges of the screen, low in the middle.
        e.hx.forEach(function (h) {
          var b = h.getBoundingClientRect();
          if (b.right > -vw && b.left < vw * 2) set(h, '--wy', (Math.sin(Math.PI * clamp((b.left + b.width / 2) / vw)) * vh * 0.24).toFixed(1) + 'px');
        });
        if (!e.hasAttribute('data-pin')) return;
        var span = r.height - vh;
        var q = span > 0 ? clamp(-r.top / span) : 1;
        var n = +e.dataset.steps || 1;
        set(e, '--pin', q.toFixed(4));
        all('[data-step]', e).forEach(function (s) {
          set(s, '--s', (q * n - +s.dataset.step).toFixed(4));
        });
      });
      comps.forEach(function (cv) {
        frameCanvas(cv, reduce ? 1 : intro, now || performance.now());
      });
      if (header) {
        var hy = header.offsetHeight / 2;
        var tone = '';
        tones.forEach(function (tn) {
          var b = tn.getBoundingClientRect();
          if (b.top <= hy && b.bottom > hy) tone = tn.dataset.tone;
        });
        var over = '';
        comps.forEach(function (cv) {
          // (Once its photo is framing out onto the light page, the page's tone applies.)
          if (cv.out > 0.3) {
            var c = cv.el.getBoundingClientRect();
            if (c.top <= hy && c.bottom > hy) tone = cv.end.dataset.tone || tone;
          } else if (cv.box && cv.tone && cv.box.top <= hy && cv.box.bottom > hy) {
            tone = cv.tone;
            over = 'canvas';
          }
        });
        if (tone) set(header, 'data-tone', tone);
        set(header, 'data-over', over);
      }
      flush();
    }

    // A section with a sliding track is as long as the track has to slide (re-measured as its pictures load).
    function sizeTrack(e) {
      if (e.track && !reduce) e.style.height = Math.round(vh + Math.max(0, e.track.offsetWidth - e.clientWidth)) + 'px';
    }
    if (window.ResizeObserver)
      tracked.forEach(function (e) {
        if (e.track)
          new ResizeObserver(function () {
            sizeTrack(e);
          }).observe(e.track);
      });

    function resize() {
      vh = innerHeight;
      vw = innerWidth;
      tracked.forEach(sizeTrack);
      comps.forEach(measureCanvas);
      frame();
    }

    var lenis = null;
    if (!reduce && window.Lenis) {
      lenis = window.lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true });
      all('a[href*="#"]').forEach(function (a) {
        var u = new URL(a.href);
        if (u.pathname !== location.pathname || !u.hash) return;
        a.addEventListener('click', function (e) {
          var t = document.querySelector(u.hash);
          if (!t) return;
          e.preventDefault();
          lenis.scrollTo(t, { duration: 1.8 });
          history.replaceState(null, '', u.hash);
        });
      });
    }
    (function raf(t) {
      if (lenis) lenis.raf(t);
      frame(t);
      requestAnimationFrame(raf);
    })(performance.now());

    addEventListener('resize', resize);
    root.classList.add('wf-ready');
    if (!reduce) root.classList.add('wf-motion');
    resize();
    if (document.fonts) document.fonts.ready.then(resize);
    addEventListener('load', resize);
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();

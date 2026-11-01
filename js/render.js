// レーダー画面の描画 (Canvas 2D)
window.ATC = window.ATC || {};
(function (ATC) {
  'use strict';
  const G = ATC.geo;
  const K = ATC.consts;

  const COL = {
    sea: '#15263a', land: '#1e3248', coast: '#2c4661', city: '#46607c',
    outside: 'rgba(5, 10, 20, 0.45)', boundary: 'rgba(160, 190, 220, 0.25)',
    ring: 'rgba(255, 255, 255, 0.045)',
    fix: '#8ea6bf', vor: '#a8cdf0', fixHi: '#59c9ff',
    runway: '#dfe7ef', approach: 'rgba(255, 214, 64, 0.8)', cone: 'rgba(255, 214, 64, 0.06)',
    arr: '#ffc53d', dep: '#59c9ff', ovf: '#8be08f', sel: '#ffffff', warn: '#ff9f40', viol: '#ff4848',
    route: 'rgba(255, 255, 255, 0.35)', draft: '#c08bff', relNear: '#ffe066', relFar: '#7f93a8', routeAll: 'rgba(255, 255, 255, 0.12)', direct: 'rgba(89, 201, 255, 0.85)',
  };
  const FONT = '11px Consolas, "Courier New", monospace';
  const SMALL = '10px Consolas, "Courier New", monospace';
  // 機首が上を向いた飛行機の右半分 (左右対称に描く)
  const PLANE = [[0, -10], [1.6, -7], [1.6, -2.5], [9.5, 2], [9.5, 3.6], [1.6, 1.6], [1.2, 6.5], [4.2, 9], [4.2, 10], [0, 9]];

  const pad3 = (n) => String(Math.max(0, Math.round(n))).padStart(3, '0');
  const SHADOW_TOP_FT = 15000;   // 影のずれ・機体の大きさが最大になる高度
  const SHADOW_MAX_PX = 20;      // 影のずれの最大 (画面上の px)
  const SHADOW_SCALE = 0.95;     // 地面の影の大きさ (機体の大きさに対する比)
  const altRatio = (ac) => Math.max(0, Math.min(1, ac.alt / SHADOW_TOP_FT));

  // 選択機のまわりに出す操作リング (半径はpx)
  //   内側の輪 = 方位 / 外側の右の弧 = 高度 (上ほど高い) / 外側の左の弧 = 速度 (上ほど速い)
  const WID = { h1: 46, h2: 80, a1: 92, a2: 118, from: 25, to: 155 };
  const ALT_STEPS = Array.from({ length: 14 }, (_, i) => 15000 - i * 1000);
  const SPD_STEPS = Array.from({ length: 15 }, (_, i) => 300 - i * 10);
  const ARC = WID.to - WID.from;
  const stepAt = (t, steps) => steps[Math.max(0, Math.min(steps.length - 1, Math.round(t * (steps.length - 1))))];
  const altAngle = (v) => WID.from + Math.max(0, Math.min(1, (15000 - v) / 13000)) * ARC;
  const spdAngle = (v) => 360 - WID.from - Math.max(0, Math.min(1, (300 - v) / 140)) * ARC;
  const rad = (compass) => (compass - 90) * G.DEG;   // 方位(上=0、時計回り) → canvasの角度

  class Renderer {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.game = game;
      const P = (pt) => game.proj.toXY(pt[1], pt[0]);
      this.land = (game.map.land || []).map((poly) => poly.map(P));
      this.water = (game.map.water || []).map((poly) => poly.map(P));
      this.cities = (game.map.cities || []).map((c) => ({ name: c.name, ...game.proj.toXY(c.lat, c.lon) }));
      this.resize();
      this.fit();
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      this.dpr = dpr;
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.canvas.width = Math.round(this.W * dpr);
      this.canvas.height = Math.round(this.H * dpr);
      this.canvas.style.width = this.W + 'px';
      this.canvas.style.height = this.H + 'px';
      if (this.view) this.view.scale = Math.max(this.view.scale, this.minScale());
    }

    minScale() {
      const e = this.game.extent;
      return Math.min(this.W / (e.maxX - e.minX), this.H / (e.maxY - e.minY)) * 0.6;
    }

    fit() {
      const e = this.game.extent;
      const top = 56, bottom = 64;
      const scale = Math.min(this.W / (e.maxX - e.minX), (this.H - top - bottom) / (e.maxY - e.minY));
      this.view = { cx: (e.minX + e.maxX) / 2, cy: (e.minY + e.maxY) / 2 + (top - bottom) / 2 / scale, scale };
    }

    toScreen(p) {
      const v = this.view;
      return { x: this.W / 2 + (p.x - v.cx) * v.scale, y: this.H / 2 - (p.y - v.cy) * v.scale };
    }

    toWorld(sx, sy) {
      const v = this.view;
      return { x: v.cx + (sx - this.W / 2) / v.scale, y: v.cy - (sy - this.H / 2) / v.scale };
    }

    zoomAt(sx, sy, factor) {
      const w = this.toWorld(sx, sy);
      const v = this.view;
      v.scale = Math.max(this.minScale(), Math.min(v.scale * factor, 400));
      v.cx = w.x - (sx - this.W / 2) / v.scale;
      v.cy = w.y + (sy - this.H / 2) / v.scale;
    }

    panBy(dx, dy) {
      this.view.cx -= dx / this.view.scale;
      this.view.cy += dy / this.view.scale;
    }

    hitAircraft(sx, sy, iconOnly) {
      let best = null, bestD = 16;
      for (const ac of this.game.aircraft) {
        if (!ac._s) continue;
        const d = Math.hypot(ac._s.x - sx, ac._s.y - sy);
        if (d < bestD) { best = ac; bestD = d; }
        const r = ac._label;
        if (!best && !iconOnly && r && sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) best = ac;
      }
      return best;
    }

    // 操作リング上の位置 → { type: 'hdg' | 'alt' | 'spd', value }
    widgetHit(ac, sx, sy) {
      if (!ac || !ac._s) return null;
      const dx = sx - ac._s.x, dy = sy - ac._s.y;
      const r = Math.hypot(dx, dy);
      const ang = G.norm360(Math.atan2(dx, -dy) / G.DEG);
      if (r >= WID.h1 && r <= WID.h2) return { type: 'hdg', value: Math.round(ang / 5) * 5 || 360 };
      if (r >= WID.a1 && r <= WID.a2) {
        if (ang >= WID.from && ang <= WID.to) return { type: 'alt', value: stepAt((ang - WID.from) / ARC, ALT_STEPS) };
        if (ang >= 360 - WID.to && ang <= 360 - WID.from) return { type: 'spd', value: stepAt((360 - WID.from - ang) / ARC, SPD_STEPS) };
      }
      return null;
    }

    hitFix(sx, sy, radius) {
      let best = null, bestD = radius || 12;
      for (const f of Object.values(this.game.fixes)) {
        const s = this.toScreen(f);
        const d = Math.hypot(s.x - sx, s.y - sy);
        if (d < bestD) { best = f; bestD = d; }
      }
      return best;
    }

    path(pts, close) {
      const ctx = this.ctx;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const s = this.toScreen(p);
        if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y);
      });
      if (close) ctx.closePath();
    }

    draw(selected, routeMode, now, hover, draft, prefs) {
      prefs = prefs || {};
      const ctx = this.ctx, g = this.game;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = COL.sea;
      ctx.fillRect(0, 0, this.W, this.H);

      this.drawMap();
      this.drawApproaches();
      this.drawRunways();
      this.drawFixes(selected);
      this.drawRoutes(selected, routeMode);
      if (draft && draft.ac === selected) this.drawDraft(draft);
      const blink = Math.floor(now / 400) % 2 === 0;
      const flying = g.aircraft.filter((ac) => ac.state !== 'waiting');
      for (const ac of g.aircraft) if (ac.state === 'waiting') { ac._s = null; ac._label = null; }
      // 影はすべての機体より下に描く
      const shadow = prefs.altView === 'shadow';
      if (shadow) for (const ac of flying) this.drawShadow(ac);
      const relTo = prefs.relAlt && selected && selected.state === 'air' ? selected : null;
      const tags = [];
      for (const ac of flying) {
        const rel = relTo && ac !== relTo && ac.state === 'air' ? ac.alt - relTo.alt : null;
        this.drawAircraft(ac, ac === selected, blink, { shadow, rel });
        if (rel != null) tags.push([ac._s, rel]);
      }
      if (selected && selected._s) this.drawWidget(selected, hover);
      // 高度差のタグは操作リングに隠れないよう最後に描く (リングの近くの機体ほど大事なので)
      for (const [s, rel] of tags) this.drawRelTag(s, rel);
      this.drawScale();
    }

    drawWidget(ac, hover) {
      const ctx = this.ctx, c = ac._s;
      const at = (a, r) => ({ x: c.x + r * Math.sin(a * G.DEG), y: c.y - r * Math.cos(a * G.DEG) });
      // 方位の輪は下の地図が透ける。高度・速度の弧は目盛りを読みやすいよう不透過
      const band = (r1, r2, a0, a1, opaque) => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r2, rad(a0), rad(a1));
        ctx.arc(c.x, c.y, r1, rad(a1), rad(a0), true);
        ctx.closePath();
        ctx.fillStyle = opaque ? '#0c1a2b' : 'rgba(10, 22, 38, 0.72)';
        ctx.strokeStyle = opaque ? '#3d5671' : 'rgba(140, 170, 200, 0.4)';
        ctx.fill();
        ctx.stroke();
      };
      const tick = (a, r1, r2, color, width) => {
        const p = at(a, r1), q = at(a, r2);
        ctx.strokeStyle = color;
        ctx.lineWidth = width || 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        ctx.lineWidth = 1;
      };
      // 縁から内向きの三角形マーカー
      const marker = (a, r, color, inward) => {
        const s = inward ? -1 : 1;
        const tip = at(a, r), b1 = at(a - 4, r + s * 9), b2 = at(a + 4, r + s * 9);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.closePath(); ctx.fill();
      };
      const text = (s, p, color, font) => {
        ctx.font = font || SMALL;
        ctx.fillStyle = color || COL.fix;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s, p.x, p.y);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      };
      // 他の機体や Fix に重なっている所ではプレビューを出さない (クリックもそちらが優先)
      const hit = hover && hover.widget ? this.widgetHit(ac, hover.x, hover.y) : null;
      const HI = COL.dep;

      ctx.save();
      // ---- 方位の輪
      band(WID.h1, WID.h2, 0, 360);
      for (let a = 0; a < 360; a += 5) {
        const len = a % 30 === 0 ? 9 : a % 10 === 0 ? 6 : 3;
        tick(a, WID.h2 - len, WID.h2, 'rgba(180, 200, 220, 0.7)');
        if (a % 30 === 0) text(String(a / 10 || 36).padStart(2, '0'), at(a, WID.h1 + 10), '#a9bdd2');
      }
      const hdgTarget = ac.directs.length ? G.bearing(ac, ac.directs[0]) : ac.tHdg;
      const d = G.angleDiff(ac.hdg, hdgTarget);
      if (Math.abs(d) > 1) {
        const left = ac.turnDir ? ac.turnDir < 0 : d < 0;
        ctx.strokeStyle = HI;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(c.x, c.y, WID.h2 - 1.5, rad(left ? hdgTarget : ac.hdg), rad(left ? ac.hdg : hdgTarget));
        ctx.stroke();
        ctx.lineWidth = 1;
        marker(hdgTarget, WID.h2, HI, true);
      }
      marker(ac.hdg, WID.h2, '#ffffff', true);

      // ---- 高度・速度の弧
      // 白 = 現在値、水色 = 指示値。指示値は常に表示し、現在値と同じなら水色が上に重なる
      band(WID.a1, WID.a2, WID.from, WID.to, true);
      band(WID.a1, WID.a2, 360 - WID.to, 360 - WID.from, true);
      // ILS 上では高度は指示できないので目盛りを薄く表示 (速度は 5NM までの指示ができる)
      ctx.globalAlpha = ac.ils ? 0.35 : 1;
      for (const v of ALT_STEPS) {
        const a = altAngle(v), major = v % 2000 === 0;
        tick(a, WID.a2 - (major ? 7 : 4), WID.a2, 'rgba(180, 200, 220, 0.7)');
        if (major) text(String(v / 1000), at(a, WID.a1 + 9), '#a9bdd2');
      }
      text('ALT', at(WID.from - 7, (WID.a1 + WID.a2) / 2), '#a9bdd2');
      marker(altAngle(ac.alt), WID.a1, '#ffffff', false);
      marker(altAngle(ac.tAlt), WID.a1, HI, false);
      ctx.globalAlpha = 1;
      for (const v of SPD_STEPS) {
        const a = spdAngle(v), major = v % 20 === 0;
        tick(a, WID.a2 - (major ? 7 : 4), WID.a2, 'rgba(180, 200, 220, 0.7)');
        if (major) text(String(v), at(a, WID.a1 + 11), '#a9bdd2', '9px Consolas, monospace');
      }
      text('SPD', at(360 - WID.from + 7, (WID.a1 + WID.a2) / 2), '#a9bdd2');
      marker(spdAngle(ac.spd), WID.a1, '#ffffff', false);
      marker(spdAngle(ac.spdTarget || ac.tSpd), WID.a1, HI, false);

      // ---- マウスを乗せている所のプレビュー
      if (hit) {
        let label;
        if (hit.type === 'hdg') {
          let dd = G.angleDiff(ac.hdg, hit.value);
          if (hover.shift) dd = dd > 0 ? dd - 360 : dd + 360;
          tick(hit.value, WID.h1, WID.h2, HI, 3);
          label = `${dd < 0 ? 'L' : 'R'}${Math.abs(Math.round(dd))} → ${ATC.commands.fmtHdg(hit.value)}`;
        } else if (hit.type === 'alt') {
          tick(altAngle(hit.value), WID.a1, WID.a2, HI, 3);
          const verb = hit.value > ac.alt + 50 ? 'C' : hit.value < ac.alt - 50 ? 'D' : '=';
          label = `${verb} ${ATC.fmtAlt(hit.value)}`;
        } else {
          tick(spdAngle(hit.value), WID.a1, WID.a2, HI, 3);
          label = `S ${hit.value}`;
        }
        ctx.font = FONT;
        const w = ctx.measureText(label).width + 12;
        const x = hover.x + 14, y = hover.y - 26;
        ctx.fillStyle = 'rgba(10, 22, 38, 0.92)';
        ctx.strokeStyle = HI;
        ctx.fillRect(x, y, w, 18);
        ctx.strokeRect(x, y, w, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x + 6, y + 13);
      }
      ctx.restore();
    }

    drawMap() {
      const ctx = this.ctx, g = this.game;
      ctx.fillStyle = COL.land;
      ctx.strokeStyle = COL.coast;
      ctx.lineWidth = 1;
      for (const poly of this.land) { this.path(poly, true); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = COL.sea;
      for (const poly of this.water) { this.path(poly, true); ctx.fill(); ctx.stroke(); }

      ctx.fillStyle = COL.city;
      ctx.font = '12px "Yu Gothic UI", "Meiryo", sans-serif';
      ctx.textAlign = 'center';
      for (const c of this.cities) {
        const s = this.toScreen(c);
        ctx.fillText(c.name, s.x, s.y);
      }
      ctx.textAlign = 'left';

      // 距離の目安になる同心円 (最初の空港を中心に10NMごと)
      const apt = Object.values(g.airports)[0];
      const c = this.toScreen(apt);
      ctx.strokeStyle = COL.ring;
      for (let r = 10; r <= 100; r += 10) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * this.view.scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 管制空域の外側を暗くする
      const e = g.extent;
      const a = this.toScreen({ x: e.minX, y: e.maxY }), b = this.toScreen({ x: e.maxX, y: e.minY });
      ctx.beginPath();
      ctx.rect(0, 0, this.W, this.H);
      ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.fillStyle = COL.outside;
      ctx.fill('evenodd');
      ctx.strokeStyle = COL.boundary;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.setLineDash([]);
    }

    drawApproaches() {
      const ctx = this.ctx, g = this.game;
      ctx.font = SMALL;
      for (const code of Object.keys(g.config.airports)) {
        const labeled = new Set();   // 平行滑走路は高度の数字を片方だけに出す
        for (const rw of g.activeArrivalRunways(code)) {
          const showAlt = !labeled.has(rw.course);
          labeled.add(rw.course);
          const back = rw.course + 180, side = rw.course + 90;
          // ILS を自動捕捉できる範囲
          const near = [], far = [];
          for (const d of [2, K.CAPTURE_MAX_NM]) {
            const c = G.offset(rw, back, d), w = 0.6 + d * 0.08;
            near.push(G.offset(c, side, w));
            far.push(G.offset(c, side, -w));
          }
          ctx.fillStyle = COL.cone;
          this.path([near[0], near[1], far[1], far[0]], true);
          ctx.fill();

          ctx.strokeStyle = COL.approach;
          ctx.lineWidth = 1.5;
          this.path([rw, G.offset(rw, back, 16)]);
          ctx.stroke();
          ctx.lineWidth = 1;

          // 降下パス上の高度 (百ft単位)
          ctx.fillStyle = COL.approach;
          for (const d of [4, 8, 12, 16]) {
            const p = this.toScreen(G.offset(rw, back, d));
            const t1 = this.toScreen(G.offset(G.offset(rw, back, d), side, 0.4));
            const t2 = this.toScreen(G.offset(G.offset(rw, back, d), side, -0.4));
            ctx.strokeStyle = COL.approach;
            ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.stroke();
            if (showAlt && this.view.scale > 5) ctx.fillText(pad3((rw.elev + d * K.GS_FT_PER_NM) / 100), p.x + 6, p.y + 3);
          }
        }
      }
    }

    drawRunways() {
      const ctx = this.ctx, g = this.game;
      ctx.strokeStyle = COL.runway;
      ctx.lineWidth = Math.max(2.5, this.view.scale * 0.03);
      ctx.lineCap = 'round';
      for (const rw of Object.values(g.runways)) {
        const a = this.toScreen(rw), b = this.toScreen(rw.far);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.lineWidth = 1;
      ctx.font = '12px "Yu Gothic UI", "Meiryo", sans-serif';
      ctx.fillStyle = COL.runway;
      for (const apt of Object.values(g.airports)) {
        const s = this.toScreen(apt);
        ctx.fillText(`${apt.name} ${apt.short}`, s.x + 14, s.y + 22);
      }
    }

    drawFixes(selected) {
      const ctx = this.ctx;
      const hi = new Set();
      if (selected) {
        for (const f of selected.directs) hi.add(f.name);
        if (selected.exit) hi.add(selected.exit.name);
      }
      ctx.font = SMALL;
      ctx.lineWidth = 1;
      for (const f of Object.values(this.game.fixes)) {
        const s = this.toScreen(f);
        const color = hi.has(f.name) ? COL.fixHi : f.type === 'vor' ? COL.vor : COL.fix;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (f.type === 'vor') {
          for (let i = 0; i < 6; i++) {
            const a = Math.PI / 3 * i;
            const x = s.x + Math.cos(a) * 5, y = s.y + Math.sin(a) * 5;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
        } else {
          ctx.moveTo(s.x, s.y - 5); ctx.lineTo(s.x + 4.5, s.y + 3.5); ctx.lineTo(s.x - 4.5, s.y + 3.5);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillText(f.name, s.x + 7, s.y + 4);
      }
    }

    drawRoutes(selected, mode) {
      const ctx = this.ctx, g = this.game;
      ctx.setLineDash([5, 5]);
      if (mode === 'all') {
        ctx.strokeStyle = COL.routeAll;
        for (const s of g.arrStreams) { this.path(s.ref); ctx.stroke(); }
        for (const s of g.depStreams) {
          for (const route of Object.values(s.byRwy)) { this.path([g.airports[s.apt], ...route]); ctx.stroke(); }
        }
        for (const s of g.ovfStreams) { this.path(s.plan); ctx.stroke(); }
      }
      if (selected && mode !== 'off') {
        ctx.strokeStyle = COL.route;
        ctx.lineWidth = 1.5;
        this.path(selected.ref);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      ctx.setLineDash([]);
      if (selected && selected.directs.length && selected.state !== 'waiting') {
        ctx.strokeStyle = COL.direct;
        this.path([selected, ...selected.directs]);
        ctx.stroke();
      }
    }

    // 組み立て中の新しい経路 (紫の破線と、通る順の番号)
    drawDraft(draft) {
      const ctx = this.ctx;
      ctx.strokeStyle = COL.draft;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      this.path([draft.ac, ...draft.fixes]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.font = 'bold 11px Consolas, monospace';
      draft.fixes.forEach((f, i) => {
        const s = this.toScreen(f);
        ctx.fillStyle = COL.draft;
        ctx.beginPath(); ctx.arc(s.x - 10, s.y - 10, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#10131c';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), s.x - 10, s.y - 6);
        ctx.textAlign = 'left';
      });
    }

    // 立体表示の影 (FlightRadar24 風): 機体は本当の位置のまま、地面に落ちた柔らかい影を右下へずらす。
    // 高いほど影は遠く・大きくぼやけて薄く、低いほど真下にくっきり濃く
    drawShadow(ac) {
      const ctx = this.ctx;
      const s = this.toScreen(ac);
      const h = altRatio(ac);
      const off = 2 + h * SHADOW_MAX_PX;
      ctx.save();
      // 暗い地図の上でも分かるよう、明るい地図の FlightRadar24 より濃いめにする
      ctx.globalAlpha = 0.95 - h * 0.35;
      ctx.filter = `blur(${(0.8 + h * 3).toFixed(1)}px)`;
      ctx.translate(s.x + off * 0.8, s.y + off);
      ctx.rotate(ac.hdg * G.DEG);
      ctx.scale(SHADOW_SCALE, SHADOW_SCALE);
      this.planePath();
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
    }

    planePath() {
      const ctx = this.ctx;
      ctx.beginPath();
      PLANE.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      for (let i = PLANE.length - 2; i > 0; i--) ctx.lineTo(-PLANE[i][0], PLANE[i][1]);
      ctx.closePath();
    }

    // 選択機との高度差のタグ (百ft 単位)。1000ft 未満は赤、2000ft 未満は黄、それ以上は灰色
    drawRelTag(s, rel) {
      const ctx = this.ctx;
      const abs = Math.abs(rel);
      const text = `${rel >= 0 ? '+' : '−'}${String(Math.round(abs / 100)).padStart(2, '0')}`;
      const color = abs < 1000 ? COL.viol : abs < 2000 ? COL.relNear : COL.relFar;
      ctx.font = 'bold 11px Consolas, monospace';
      const w = ctx.measureText(text).width + 6;
      const x = s.x - 16 - w, y = s.y - 7;
      ctx.fillStyle = 'rgba(8, 16, 28, 0.85)';
      ctx.fillRect(x, y, w, 14);
      ctx.strokeStyle = color;
      ctx.strokeRect(x, y, w, 14);
      ctx.fillStyle = color;
      ctx.fillText(text, x + 3, y + 11);
    }

    drawAircraft(ac, isSel, blink, opt) {
      opt = opt || {};
      const ctx = this.ctx, g = this.game;
      const s = this.toScreen(ac);
      ac._s = s;
      let color = ac.kind === 'arr' ? COL.arr : ac.kind === 'ovf' ? COL.ovf : COL.dep;
      if (ac.alert === 'warn') color = COL.warn;
      if (ac.alert === 'viol' && blink) color = COL.viol;
      // 選択機と高度が大きく離れた機体は薄く (高度差の表示がオンの時)
      const faded = opt.rel != null && Math.abs(opt.rel) >= 3000 && !ac.alert;
      ctx.save();
      if (faded) ctx.globalAlpha = 0.4;

      ctx.fillStyle = color;
      for (const p of ac.trail) {
        const t = this.toScreen(p);
        ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
      }

      // 1分後の予測位置への線
      const gs = ac.spd * (1 + ac.alt / 1000 * 0.016);
      const lead = this.toScreen(G.offset(ac, ac.hdg, gs / 60));
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(lead.x, lead.y); ctx.stroke();
      ctx.globalAlpha = 1;

      if (ac.alert) {
        ctx.strokeStyle = ac.alert === 'viol' ? COL.viol : COL.warn;
        if (ac.alert === 'warn') ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, K.SEP_NM / 2 * this.view.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (isSel) {
        ctx.strokeStyle = COL.sel;
        ctx.beginPath(); ctx.arc(s.x, s.y, 15, 0, Math.PI * 2); ctx.stroke();
      }

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(ac.hdg * G.DEG);
      // 立体表示では高い機体ほど大きく (手前に浮いて見える)。細い暗い縁取りで輪郭をはっきりさせる
      const k = opt.shadow ? 0.85 + 0.75 * altRatio(ac) : 1;
      ctx.scale(k, k);
      this.planePath();
      ctx.fillStyle = isSel ? COL.sel : color;
      ctx.fill();
      if (opt.shadow) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      ctx.restore();

      // データブロック
      const arrow = ac.tAlt > ac.alt + 50 ? '↑' : ac.tAlt < ac.alt - 50 ? '↓' : ' ';
      const altPart = arrow === ' ' ? `${pad3(ac.alt / 100)}  ` : `${pad3(ac.alt / 100)}${arrow}${pad3(ac.tAlt / 100)} `;
      const spdPart = pad3(ac.spd);
      const altLine = altPart + spdPart;
      let nav;
      if (ac.state === 'takeoff') nav = `RWY${ac.rwy.id} ROLL`;
      else if (ac.ils) nav = `ILS ${ac.ils.id}`;
      else if (ac.hold) nav = `HOLD ${ac.hold.fix.name}`;
      else if (ac.approach && (!ac.directs.length || / (FAF|BASE)$/.test(ac.directs[0].name))) nav = `APP ${ac.approach.id}`;
      else if (ac.directs.length) nav = `>${ac.directs[0].name}`;
      else nav = `H${ATC.commands.fmtHdg(ac.tHdg)}`;
      // 出口の高度: 下限だけなら "SEKID130"、上限もある通過機は "HEIAN090-130"
      const dest = ac.kind === 'arr' ? g.airports[ac.dest].short
        : `${ac.exit.name}${pad3(ac.exitAlt / 100)}${ac.exitAltMax != null ? '-' + pad3(ac.exitAltMax / 100) : ''}`;
      const lines = [`${ac.cs}`, altLine, `${nav} ${dest}`];

      ctx.font = FONT;
      const w = Math.max(...lines.map((t) => ctx.measureText(t).width));
      // 選択機は操作リングに重ならないよう真上に出す
      // 大きく描いた機体ほどデータブロックを外へ (アイコンに重ならないように)
      const lx = isSel ? s.x - w / 2 : s.x + 4 + 10 * k;
      const ly = isSel ? s.y - WID.a2 - 46 : s.y - 28 - 10 * k;
      const base = isSel ? COL.sel : color;
      ctx.fillStyle = base;
      ctx.fillText(lines[0], lx, ly + 10);
      ctx.fillText(altPart, lx, ly + 22);
      // ILS に乗れない速さなら速度の数字だけオレンジ
      ctx.fillStyle = g.tooFastForIls(ac) ? COL.warn : base;
      ctx.fillText(spdPart, lx + ctx.measureText(altPart).width, ly + 22);
      ctx.fillStyle = base;
      ctx.fillText(lines[2], lx, ly + 34);
      ac._label = { x: lx - 2, y: ly - 2, w: w + 4, h: 40 };
      ctx.restore();
    }

    drawScale() {
      const ctx = this.ctx;
      const len = 10 * this.view.scale;
      const x = this.W - len - 30, y = this.H - 24;
      ctx.strokeStyle = 'rgba(220,230,240,0.6)';
      ctx.fillStyle = 'rgba(220,230,240,0.7)';
      ctx.beginPath();
      ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + len, y); ctx.lineTo(x + len, y - 4);
      ctx.stroke();
      ctx.font = SMALL;
      ctx.textAlign = 'center';
      ctx.fillText('10 NM', x + len / 2, y - 6);
      ctx.textAlign = 'left';
    }
  }

  ATC.Renderer = Renderer;
})(window.ATC);

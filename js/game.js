// シミュレーション本体: 機体の運動、出現、ILS、間隔チェック、得点
window.ATC = window.ATC || {};
(function (ATC) {
  'use strict';
  const G = ATC.geo;

  const K = ATC.consts = {
    GS_FT_PER_NM: 318,   // 3° グライドスロープで 1NM あたりに下がる高度
    FAF_NM: 12,          // 最終進入フィックスまでの距離
    CAPTURE_MAX_NM: 25,  // ILS を捕捉できる最遠距離
    CAPTURE_ANGLE: 60,   // ILS を捕捉できる進入角
    CAPTURE_MARGIN_FT: 600,
    SEP_NM: 3,
    SEP_FT: 1000,
    EXIT_RADIUS_NM: 3,
    MATCH_ZERO_NM: 5,    // 平均でこれだけ経路から外れると航跡一致 0%
    LOW_ALT: 10000,      // これ未満は 250kt 以下
    LOW_ALT_SPD: 250,
    HOLD_SPD: 230,
    ILS_MAX_SPD: 210,    // これより速いと ILS に乗れない
    APP_SPD_UNTIL_NM: 5, // ILS 上の指示速度はここまで。以降は進入速度へ減速
    VAPP: 145,           // 最終進入速度
    STABLE_NM: 3,        // ここで STABLE_SPD を超えていたら不安定進入として復行
    STABLE_SPD: 170,
    FLOW_HOLD_PER_RWY: 2,  // 滑走路1本あたり、これだけ待機していたら新しい到着機を止める (流量制御)
  };

  const AIRLINES = [
    { code: 'JAL', types: ['B738', 'B788', 'B789', 'A359', 'B763'] },
    { code: 'ANA', types: ['B738', 'B788', 'B789', 'B772', 'A321'] },
    { code: 'SKY', types: ['B738'] },
    { code: 'ADO', types: ['B738', 'B763'] },
    { code: 'SNJ', types: ['B738'] },
    { code: 'SFJ', types: ['A320'] },
    { code: 'APJ', types: ['A320', 'A321'] },
    { code: 'JJP', types: ['A320', 'A321'] },
    { code: 'KAL', types: ['B772', 'A333', 'B738'] },
    { code: 'AAR', types: ['A321', 'A359'] },
    { code: 'CPA', types: ['A359', 'A333'] },
    { code: 'EVA', types: ['B789', 'A321'] },
    { code: 'UAL', types: ['B789', 'B772'] },
    { code: 'DAL', types: ['A359', 'B763'] },
    { code: 'SIA', types: ['A359', 'B78X'] },
  ];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);

  // 重みつきシャッフル: 重みが大きいものほど先頭に来やすい
  function weightedOrder(list) {
    return list
      .map((item) => ({ item, k: Math.pow(Math.random(), 1 / (item.weight || 1)) }))
      .sort((a, b) => b.k - a.k)
      .map((e) => e.item);
  }

  // 保存時にマップの物への参照として扱う機体の項目
  const SAVE_REFS = ['rwy', 'ils', 'approach', 'exit'];
  const SAVE_LISTS = ['directs', 'plan', 'ref'];

  const PARITY_TEXT = { odd: '奇数高度 (東行き)', even: '偶数高度 (西行き)' };
  // 1000ft 単位の高度で、千の位が奇数か偶数か
  function parityOk(alt, parity) {
    const k = Math.round(alt / 1000);
    return Math.abs(alt - k * 1000) <= 50 && (k % 2 === 1) === (parity === 'odd');
  }

  function fmtAlt(v) { return v >= 14000 ? 'FL' + Math.round(v / 100) : String(Math.round(v / 100) * 100); }

  function makeAircraft(p) {
    return Object.assign({
      state: 'air',          // waiting | takeoff | air
      alt: 0, tAlt: 0, spd: 0, tSpd: 0, hdg: 0, turnDir: 0,
      plan: [],              // 飛行計画上の経路 (STAR / SID)。指示がなければ順に飛ぶ
      directs: [],           // いま実際に向かっている Fix の列
      ils: null, gaCooldown: 0,
      hold: null,            // ホールディング中の状態
      approach: null,        // 進入許可を出した滑走路
      autoFinal: false,      // 進入許可後に経路が尽きたら、自分で最終進入コースへ向かう
      initTurn: 0,           // 離陸後の最初の旋回方向 (1 = 右, -1 = 左)
      routeSpdLimit: Infinity, // STAR に書かれた速度制限 (速度を指示すると解除)
      spdTarget: 0,          // 指示速度と各種制限から決まる、実際に目指す速度
      ilsSpd: 0,
      warnedSpeed: false,
      trail: [], trailT: 0, devSum: 0, devN: 0, devT: 0,
      alert: null, done: false, waitTime: 0,
    }, p, { tHdg: p.tHdg ?? p.hdg });
  }

  class Game {
    constructor(map, opts) {
      this.map = map;
      this.opts = opts;   // { configId, maxAircraft, interval }
      this.proj = G.makeProjection(map.bounds);
      const b = map.bounds;
      const sw = this.proj.toXY(b.south, b.west), ne = this.proj.toXY(b.north, b.east);
      this.extent = { minX: sw.x, minY: sw.y, maxX: ne.x, maxY: ne.y };

      this.fixes = {};
      for (const [name, f] of Object.entries(map.fixes)) {
        this.fixes[name] = { name, type: f.type || 'fix', ...this.proj.toXY(f.lat, f.lon) };
      }

      this.airports = {};
      this.runways = {};
      for (const [code, apt] of Object.entries(map.airports)) {
        let sx = 0, sy = 0;
        for (const r of apt.runways) {
          const a = this.proj.toXY(r.thr[0], r.thr[1]);
          const far = G.offset(a, r.hdg, r.len / 1852);
          this.addRunwayEnd(code, apt, r.ids[0], a, far, r.hdg);
          this.addRunwayEnd(code, apt, r.ids[1], far, a, G.norm360(r.hdg + 180));
          sx += a.x + far.x; sy += a.y + far.y;
        }
        const n = apt.runways.length * 2;
        this.airports[code] = { code, name: apt.name, short: apt.short, elev: apt.elev, x: sx / n, y: sy / n };
      }

      this.config = map.configs[opts.configId];
      for (const [code, cfg] of Object.entries(this.config.airports)) {
        for (const id of cfg.lda || []) this.applyLda(code, id, map.airports[code].lda[id]);
      }
      // STAR の終点 (IAF) から最終進入までの進入方式の経路。進入許可を受けてから飛ぶ (許可がなければ STAR の終点で待機)
      for (const s of this.config.arrivals) {
        if (!s.approach) continue;
        const rw = this.runway(s.dest, s.rwy);
        rw.transitions = rw.transitions || {};
        rw.transitions[s.route[s.route.length - 1]] = s.approach.map((n) => this.fix(n));
        // 進入方式で高度が決まっている経路 (羽田 LDA Z: 22 側 5000ft・23 側 4000ft で、交差を高度で分ける)
        if (s.approachAlt) {
          rw.transitionAlt = rw.transitionAlt || {};
          for (const n of [s.route[s.route.length - 1], ...s.approach]) rw.transitionAlt[n] = s.approachAlt;
        }
      }
      this.arrStreams = this.config.arrivals.map((s) => {
        const rw = this.runway(s.dest, s.rwy);
        const plan = s.route.map((n) => this.fix(n));
        const app = rw.app.lda ? [rw.app] : [];
        return { ...s, plan, ref: [...plan, ...this.approachTail(rw, plan[plan.length - 1]), ...app, rw] };
      });
      // SID は滑走路ごとに経路が違うことがある。route が配列なら全滑走路共通
      this.depStreams = map.departures
        .filter((s) => this.config.airports[s.apt] && this.config.airports[s.apt].dep.length)
        .map((s) => {
          const routes = Array.isArray(s.route) ? { default: s.route } : s.route;
          const byRwy = {};
          for (const [id, names] of Object.entries(routes)) byRwy[id] = names.map((n) => this.fix(n));
          return { ...s, exitFix: this.fix(s.exit), byRwy };
        });
      // 上空通過機 (空域を横切るだけ。下の空港へは降りない)
      this.ovfStreams = (map.overflights || []).map((s) => ({ ...s, plan: s.route.map((n) => this.fix(n)), exitFix: this.fix(s.exit) }));

      this.time = 0;
      this.score = 0;
      this.stats = { landed: 0, departed: 0, passed: 0, violations: 0, lost: 0 };
      this.aircraft = [];
      this.log = [];
      this.logVersion = 0;
      this.over = null;
      this.violating = new Set();
      this.spawnTimer = 2;
      this.emit(`${map.name} ${this.config.name}。管制を開始します。`, 'sys');
    }

    fix(name) {
      const f = this.fixes[name];
      if (!f) throw new Error(`マップデータに Fix "${name}" がありません`);
      return f;
    }

    runway(apt, id) {
      const rw = this.runways[`${apt} ${id}`];
      if (!rw) throw new Error(`マップデータに滑走路 "${apt} ${id}" がありません`);
      return rw;
    }

    addRunwayEnd(code, apt, id, thr, far, course) {
      const end = { key: `${code} ${id}`, apt: code, id, x: thr.x, y: thr.y, far, course, elev: apt.elev };
      this.setFinal(end, { x: thr.x, y: thr.y, course, extra: 0 }, K.FAF_NM);
      this.runways[end.key] = end;
    }

    // 最終進入コース (app)。ふつうは滑走路の延長線そのもの。
    // LDA (羽田 22/23 など) は滑走路と角度のずれたコースで MAPt まで来て、残り (extra NM) は目で見て滑走路へ回り込む
    setFinal(end, app, fafNm) {
      end.app = app;
      end.fafNm = fafNm;
      end.faf = { name: `${end.id} FAF`, ...G.offset(app, app.course + 180, fafNm) };
      // 横から来る機体用の基点 (FAF の 3NM 外側、最終進入コースから左右へ 4NM)。ここから浅い角度で FAF へ入る
      const outer = G.offset(app, app.course + 180, fafNm + 3);
      end.bases = {
        1: { name: `${end.id} BASE`, side: 1, ...G.offset(outer, app.course + 90, 4) },
        '-1': { name: `${end.id} BASE`, side: -1, ...G.offset(outer, app.course - 90, 4) },
      };
    }

    // 運用で LDA を使う滑走路は、MAPt (進入復行点) と FAF の Fix から最終進入コースを作り直す
    applyLda(code, id, def) {
      const end = this.runway(code, id);
      const mapt = this.proj.toXY(def.mapt[0], def.mapt[1]);
      const faf = this.fix(def.faf);
      const app = { x: mapt.x, y: mapt.y, course: G.bearing(faf, mapt), extra: G.dist(mapt, end), lda: true };
      this.setFinal(end, app, G.dist(faf, mapt));
    }

    // 最終進入コースに対する位置。along = MAPt (ILS は滑走路端) までの距離、togo = 滑走路端までの降下パス上の距離
    finalFrame(p, rw) {
      const f = G.runwayFrame(p, rw.app);
      f.togo = f.along + rw.app.extra;
      return f;
    }

    // 3° の降下パスでの高度
    pathAlt(rw, togo) { return rw.elev + togo * K.GS_FT_PER_NM; }

    // 経路の最後の Fix から最終進入へつなぐ点。
    //   FAF の後ろ (進入方向から ±45° の範囲) にあれば FAF へまっすぐ。
    //   それ以外 (滑走路の横や手前で終わる経路) は、来た側の基点を経由して浅い角度で FAF へ (ダウンウインド → ベース → 最終進入)
    //   最終進入コースの上 (FAF や LDA の IF など) で終わる経路は、そのまま最終進入へ
    approachTail(rw, last) {
      if (!last) return [];
      if (rw.transitions && rw.transitions[last.name]) return rw.transitions[last.name];
      const { along, xt } = G.runwayFrame(last, rw.app);
      if (Math.abs(xt) < 1 && along > 2 && along < rw.fafNm + 8) return [];
      if (along > rw.fafNm + 2 && Math.abs(xt) <= along - rw.fafNm) return [rw.faf];
      return [rw.bases[xt >= 0 ? 1 : -1], rw.faf];
    }

    // 同じ空港のほかの滑走路の進入方式の経路にしかない Fix (進入する滑走路を切り替えたとき、そこから先を捨てる)
    foreignTransitionFixes(rw) {
      const own = new Set(Object.values(rw.transitions || {}).flat());
      const out = new Set();
      for (const r of Object.values(this.runways)) {
        if (r === rw || r.apt !== rw.apt) continue;
        for (const f of Object.values(r.transitions || {}).flat()) if (!own.has(f)) out.add(f);
      }
      return out;
    }

    depRoute(s, rw) { return s.byRwy[rw.id] || s.byRwy.default || Object.values(s.byRwy)[0]; }

    // 経路の最初の Fix から指定の方角へ伸ばし、空域の端の少し内側を出現位置にする
    entryPoint(first, from) {
      const e = this.extent, m = 3;
      let p = first;
      for (let d = 1; d < 400; d++) {
        const q = G.offset(first, from, d);
        if (q.x < e.minX + m || q.x > e.maxX - m || q.y < e.minY + m || q.y > e.maxY - m) break;
        p = q;
      }
      return p;
    }

    activeArrivalRunways(apt) {
      const cfg = this.config.airports[apt];
      return cfg ? cfg.arr.map((id) => this.runway(apt, id)) : [];
    }

    emit(text, kind) {
      this.log.push({ text, kind, t: this.time });
      if (this.log.length > 100) this.log.shift();
      this.logVersion++;
    }

    update(dt) {
      if (this.over) return;
      this.time += dt;
      this.spawnTick(dt);
      for (const ac of this.aircraft) if (!ac.done) this.step(ac, dt);
      this.checkSeparation();
      this.aircraft = this.aircraft.filter((a) => !a.done);
    }

    // ---- 出現 ----------------------------------------------------------

    spawnTick(dt) {
      this.spawnTimer -= dt;
      if (this.spawnTimer > 0) return;
      if (this.aircraft.length >= this.opts.maxAircraft) { this.spawnTimer = 5; return; }
      // 最初の1機は到着機にして、すぐ操作できるものを出す。上空通過機はマップに設定された割合で
      const r = Math.random();
      const ovfShare = this.ovfStreams.length ? this.map.overflightShare || 0.25 : 0;
      let ok;
      if (this.time >= 5 && r < ovfShare) ok = this.spawnOverflight() || this.spawnArrival();
      else if (this.time < 5 || r < ovfShare + (1 - ovfShare) * 0.55) ok = this.spawnArrival() || this.spawnDeparture();
      else ok = this.spawnDeparture() || this.spawnArrival();
      // 開始直後の10分間は間隔を長めにし、徐々に設定値へ近づける
      const ramp = 1 + 0.6 * Math.max(0, 1 - this.time / 600);
      this.spawnTimer = ok ? this.opts.interval * ramp * (0.75 + Math.random() * 0.5) : 8;
    }

    newCallsign() {
      for (let i = 0; i < 100; i++) {
        const al = pick(AIRLINES);
        const cs = al.code + (10 + Math.floor(Math.random() * 990));
        if (!this.aircraft.some((a) => a.cs === cs)) return { cs, type: pick(al.types) };
      }
      return { cs: 'JAL' + Math.floor(Math.random() * 9000 + 1000), type: 'B738' };
    }

    // 流量制御: 待機中の到着機が多い空港へは新しい到着機を出さない
    // (実際も航空交通管理センターが出発空港で待たせ、空中で待つ機体が増えすぎないようにしている)
    flowControlled(dest) {
      const holding = this.aircraft.filter((a) => a.kind === 'arr' && a.dest === dest && a.hold).length;
      return holding >= K.FLOW_HOLD_PER_RWY * Math.max(1, this.activeArrivalRunways(dest).length);
    }

    spawnArrival() {
      for (const s of weightedOrder(this.arrStreams)) {
        if (this.flowControlled(s.dest)) continue;
        const entry = this.entryPoint(s.plan[0], pick(s.from || [0]));
        for (const alt of shuffle(this.map.arrivalAlts || [11000, 12000, 13000])) {
          const blocked = this.aircraft.some((a) =>
            a.state === 'air' && G.dist(a, entry) < 10 && Math.abs(a.alt - alt) < 1500);
          if (blocked) continue;
          const { cs, type } = this.newCallsign();
          this.aircraft.push(makeAircraft({
            cs, type, kind: 'arr', dest: s.dest, entry: s.name || s.plan[0].name, entryFix: s.plan[0].name, plannedRwy: s.rwy,
            x: entry.x, y: entry.y, alt, tAlt: alt, spd: 280, tSpd: 280,
            hdg: G.bearing(entry, s.plan[0]), plan: s.plan, directs: s.plan.slice(), ref: [entry, ...s.ref],
          }));
          const star = s.name ? `${s.name} ARRIVAL` : `VIA ${s.plan.map((f) => f.name).join('-')}`;
          this.emit(`${cs} WITH YOU ${fmtAlt(alt)}, ${star}  [${this.airports[s.dest].short}行き]`, 'readback');
          return true;
        }
      }
      return false;
    }

    spawnOverflight() {
      for (const s of weightedOrder(this.ovfStreams)) {
        const entry = this.entryPoint(s.plan[0], pick(s.from || [0]));
        for (const alt of shuffle(s.alts || [20000])) {
          const blocked = this.aircraft.some((a) =>
            a.state === 'air' && G.dist(a, entry) < 10 && Math.abs(a.alt - alt) < 1500);
          if (blocked) continue;
          const { cs, type } = this.newCallsign();
          // 巡航のまま抜けていく機体 (出口の高度に上限がない) は、進む方向で奇数/偶数の高度が決まる
          const parity = s.exitAltMax ? null : this.cruiseParity(entry, s.exitFix);
          let exitAlt = s.exitAlt || 0;
          while (parity && !parityOk(exitAlt, parity)) exitAlt += 1000;
          this.aircraft.push(makeAircraft({
            cs, type, kind: 'ovf', entry: s.name || s.plan[0].name,
            x: entry.x, y: entry.y, alt, tAlt: alt, spd: 300, tSpd: 300,
            hdg: G.bearing(entry, s.plan[0]), plan: s.plan, directs: s.plan.slice(), ref: [entry, ...s.plan],
            exit: s.exitFix, exitAlt, exitAltMax: s.exitAltMax || null, parity,
          }));
          this.emit(`${cs} WITH YOU ${fmtAlt(alt)}, VIA ${s.plan.map((f) => f.name).join('-')}  [通過 ${this.exitRangeText(this.aircraft.at(-1))}]`, 'readback');
          return true;
        }
      }
      return false;
    }

    // 出口 Fix での高度の条件 (出発機は下限だけ、上空通過機は上限があることも)
    exitAltOk(ac, alt) {
      return alt >= ac.exitAlt - 50 && (ac.exitAltMax == null || alt <= ac.exitAltMax + 50) &&
        (!ac.parity || parityOk(alt, ac.parity));
    }

    exitRangeText(ac) {
      const f = (v) => fmtAlt(v);
      if (ac.exitAltMax != null) return `${ac.exit.name} を ${f(ac.exitAlt)}〜${f(ac.exitAltMax)}ft で`;
      if (ac.parity) return `${ac.exit.name} を ${f(ac.exitAlt)} 以上の${PARITY_TEXT[ac.parity]}で`;
      return `${ac.exit.name} を ${f(ac.exitAlt)}ft 以上で`;
    }

    // 出口の条件に合う高度のうち、alt にいちばん近いもの (コンピュータ管制用)
    nearestExitAlt(ac, alt) {
      const hi = ac.exitAltMax ?? ac.exitAlt + 6000;
      let best = null;
      for (let v = ac.exitAlt; v <= hi; v += 1000) {
        if (this.exitAltOk(ac, v) && (best == null || Math.abs(v - alt) < Math.abs(best - alt))) best = v;
      }
      return best ?? ac.exitAlt;
    }

    // 半円方式: 磁方位 0〜179° へ進む機体は奇数 (FL170, 190, 210…)、180〜359° は偶数 (FL180, 200…) の高度で巡航する。
    // 地図は真方位なので、偏差 (関東・中部・岡山は約 7°W) を足して磁方位にする
    cruiseParity(from, to) {
      const mag = G.norm360(G.bearing(from, to) + (this.map.magVar ?? 7));
      return mag < 180 ? 'odd' : 'even';
    }

    // 到着機が今の入口から選べる標準到着経路 (同じ空港・同じ入口の Fix から始まるもの)
    starOptions(ac) {
      if (ac.kind !== 'arr') return [];
      const first = ac.entryFix || (this.arrStreams.find((s) => s.name === ac.entry) || {}).plan?.[0]?.name;
      return this.arrStreams.filter((s) => s.name && s.dest === ac.dest && s.plan[0].name === first);
    }

    // 標準到着経路を切り替える。今いる場所に近い Fix から新しい経路に乗る
    assignStar(ac, s) {
      const plan = s.plan;
      let i = 0;
      for (let k = 1; k < plan.length; k++) if (G.dist(ac, plan[k]) < G.dist(ac, plan[i])) i = k;
      if (i < plan.length - 1 && G.dist(ac, plan[i + 1]) < G.dist(plan[i], plan[i + 1])) i++;
      const rw = this.runway(s.dest, s.rwy);
      if (ac.approach && ac.approach !== rw) { ac.approach = null; ac.autoFinal = false; }
      ac.plan = plan.slice();
      ac.hold = null;
      ac.autoFinal = false;
      ac.turnDir = 0;
      ac.directs = [...plan.slice(i), ...(ac.approach ? this.approachTail(rw, plan[plan.length - 1]) : [])];
      ac.entry = s.name;
      ac.plannedRwy = s.rwy;
      ac.ref = [ac.ref[0], ...s.ref];
    }

    spawnDeparture() {
      for (const s of weightedOrder(this.depStreams)) {
        for (const id of shuffle(this.config.airports[s.apt].dep)) {
          const rw = this.runway(s.apt, id);
          if (this.aircraft.filter((a) => a.state === 'waiting' && a.rwy === rw).length >= 2) continue;
          const { cs, type } = this.newCallsign();
          const route = this.depRoute(s, rw);
          this.aircraft.push(makeAircraft({
            cs, type, kind: 'dep', origin: s.apt, rwy: rw, state: 'waiting',
            x: rw.x, y: rw.y, alt: rw.elev, tAlt: this.map.departureAlt.initial, spd: 0, tSpd: 280,
            hdg: rw.course, exit: s.exitFix, exitAlt: s.exitAlt || this.map.departureAlt.exit,
            initTurn: { R: 1, L: -1 }[(s.turn || {})[rw.id]] || 0,
            plan: route, directs: route.slice(),
            ref: [rw, rw.far, G.offset(rw.far, rw.course, 4), ...route],
          }));
          const sid = s.name ? `${s.name} DEPARTURE` : `VIA ${route.map((f) => f.name).join('-')}`;
          this.emit(`${cs} READY RWY ${id}, ${sid}  [${this.airports[s.apt].short}発]`, 'readback');
          return true;
        }
      }
      return false;
    }

    // ---- 運動 ----------------------------------------------------------

    step(ac, dt) {
      if (ac.state === 'waiting') { ac.waitTime += dt; return; }
      if (ac.state === 'takeoff') {
        ac.spd = Math.min(ac.spd + 3.5 * dt, 170);
        this.move(ac, dt);
        if (ac.spd >= 150) {
          ac.state = 'air';
          this.emit(`${ac.cs} AIRBORNE`, 'sys');
        }
        return;
      }

      ac.gaCooldown = Math.max(0, ac.gaCooldown - dt);
      if (ac.ils) {
        this.flyIls(ac);
        if (ac.done) return;
      } else {
        if (ac.hold) this.flyHold(ac, dt);
        else if (ac.directs.length) {
          const f = ac.directs[0];
          if (G.dist(ac, f) < 1.2) {
            ac.directs.shift();
            // 経路の終点 (許可限界点) まで来て、その先の許可がなければ待機する
            const last = ac.plan[ac.plan.length - 1];
            if (!ac.directs.length && ac.kind === 'arr') {
              if (ac.approach) { ac.autoFinal = true; ac.finalPhase = null; }
              else if (f === last && this.fixes[f.name]) this.enterHold(ac, f);
            }
          } else {
            ac.tHdg = G.bearing(ac, f);
            // SID の最初の旋回は AIP の指定方向へ。向きが合ったら以降は近い方へ
            if (ac.initTurn && Math.abs(G.angleDiff(ac.hdg, ac.tHdg)) < 5) ac.initTurn = 0;
            ac.turnDir = ac.initTurn || 0;
          }
        } else if (ac.autoFinal && ac.approach) this.steerToFinal(ac);
        if (ac.kind === 'arr' && ac.gaCooldown <= 0 && !ac.hold) this.tryCapture(ac);
        if (ac.approach && !ac.ils) this.checkMissedApproach(ac);
      }

      // 離陸直後は滑走路方位を維持
      const canTurn = !(ac.kind === 'dep' && ac.alt < ac.rwy.elev + 400);
      if (canTurn) {
        let d = G.angleDiff(ac.hdg, ac.tHdg);
        if (ac.turnDir < 0 && d > 0.5) d -= 360;
        if (ac.turnDir > 0 && d < -0.5) d += 360;
        const rate = 3 * dt;   // 標準旋回 3°/秒
        if (Math.abs(d) <= rate) { ac.hdg = ac.tHdg; ac.turnDir = 0; }
        else ac.hdg = G.norm360(ac.hdg + Math.sign(d) * rate);
      }

      if (ac.alt < ac.tAlt) ac.alt = Math.min(ac.tAlt, ac.alt + (ac.alt < 10000 ? 3000 : 2000) / 60 * dt);
      else if (ac.alt > ac.tAlt) ac.alt = Math.max(ac.tAlt, ac.alt - (ac.ils ? 1500 : 2000) / 60 * dt);

      ac.spdTarget = this.speedTarget(ac);
      if (ac.spd < ac.spdTarget) ac.spd = Math.min(ac.spdTarget, ac.spd + 2 * dt);
      else if (ac.spd > ac.spdTarget) ac.spd = Math.max(ac.spdTarget, ac.spd - 1.5 * dt);

      this.move(ac, dt);

      ac.trailT += dt;
      if (ac.trailT >= 4) {
        ac.trailT = 0;
        ac.trail.push({ x: ac.x, y: ac.y });
        if (ac.trail.length > 8) ac.trail.shift();
      }
      ac.devT += dt;
      if (ac.devT >= 2) {
        ac.devT = 0;
        ac.devSum += G.distToPolyline(ac, ac.ref);
        ac.devN++;
      }

      if (ac.exit && G.dist(ac, ac.exit) < K.EXIT_RADIUS_NM && this.exitAltOk(ac, ac.alt)) {
        this.finish(ac, true);
        return;
      }
      const e = this.extent, m = 0.5;
      if (ac.x < e.minX - m || ac.x > e.maxX + m || ac.y < e.minY - m || ac.y > e.maxY + m) {
        const why = ac.exit && G.dist(ac, ac.exit) < 8 ? '出口の高度が合わないまま空域を離脱' : '空域外へ逸脱';
        this.finish(ac, false, why);
      }
    }

    // 指示を出した直後に目標速度を計算し直す (一時停止中でも表示に反映されるように)
    refreshTargets(ac) {
      if (ac.ils) {
        const { togo } = this.finalFrame(ac, ac.ils);
        ac.ilsSpd = togo > K.APP_SPD_UNTIL_NM && !ac.visual ? Math.min(ac.tSpd, K.ILS_MAX_SPD) : K.VAPP;
      }
      if (ac.state !== 'waiting') ac.spdTarget = this.speedTarget(ac);
    }

    // 指示速度に、高度・STAR・待機・進入の各制限をかけた速度
    speedTarget(ac) {
      if (ac.ils) return ac.ilsSpd;
      const limits = this.map.speedLimits || {};
      const next = ac.directs[0];
      if (next && limits[next.name] && G.dist(ac, next) < 20) {
        ac.routeSpdLimit = Math.min(ac.routeSpdLimit, limits[next.name]);
      }
      let v = Math.min(ac.tSpd, ac.routeSpdLimit);
      // 10000ft 未満へ降りる機体は、その少し上から減速しておく
      if (ac.alt < K.LOW_ALT || (ac.tAlt < K.LOW_ALT && ac.alt < K.LOW_ALT + 1500)) v = Math.min(v, K.LOW_ALT_SPD);
      if (ac.hold) v = Math.min(v, K.HOLD_SPD);
      // 進入許可を受けた機体は滑走路に近づくと自分で ILS に乗れる速度まで落とす
      if (ac.approach && G.dist(ac, ac.approach) < 25) v = Math.min(v, K.ILS_MAX_SPD);
      return v;
    }

    move(ac, dt) {
      const gs = ac.spd * (1 + ac.alt / 1000 * 0.016);   // 高度が上がるほど対地速度が増える
      const u = G.unit(ac.hdg);
      ac.x += u.x * gs * dt / 3600;
      ac.y += u.y * gs * dt / 3600;
    }

    // ---- ホールディング (右旋回、アウトバウンド1分) ------------------

    enterHold(ac, fix) {
      ac.hold = { fix, inbound: ac.hdg, phase: 'turnOut', t: 0 };
      ac.tHdg = G.norm360(ac.hdg + 180);
      ac.turnDir = 1;
      this.emit(`${ac.cs} HOLDING AT ${fix.name}`, 'warn');
    }

    flyHold(ac, dt) {
      const h = ac.hold;
      const turned = ac.turnDir === 0 && Math.abs(G.angleDiff(ac.hdg, ac.tHdg)) < 1;
      if (h.phase === 'turnOut' && turned) {
        h.phase = 'outbound';
        h.t = 0;
      } else if (h.phase === 'outbound') {
        h.t += dt;
        if (h.t >= 60) { h.phase = 'turnIn'; ac.tHdg = h.inbound; ac.turnDir = 1; }
      } else if (h.phase === 'turnIn' && turned) {
        h.phase = 'inbound';
      } else if (h.phase === 'inbound') {
        if (G.dist(ac, h.fix) < 1.2) {
          h.phase = 'turnOut';
          ac.tHdg = G.norm360(h.inbound + 180);
          ac.turnDir = 1;
        } else {
          ac.tHdg = G.bearing(ac, h.fix);
          ac.turnDir = 0;
        }
      }
    }

    // ---- ILS ----------------------------------------------------------

    fafAltitude(rw) { return Math.floor(this.pathAlt(rw, rw.fafNm + rw.app.extra) / 100) * 100; }

    // 進入許可を出したときに降りる高度。経路が最終進入コースの上 (LDA Y の TAYAS など FAF より内側) で終わるなら、
    // その Fix での降下パスの高度まで
    clearedAltitude(ac, rw) {
      const real = (f) => f && !/ (FAF|BASE)$/.test(f.name);
      const route = ac.directs.filter(real);
      const last = route[route.length - 1] || (ac.hold && ac.hold.fix);
      const end = last && [last, ...this.approachTail(rw, last)].filter(real).pop();
      let alt = this.fafAltitude(rw);
      if (end && !this.approachTail(rw, end).length) {
        alt = Math.min(alt, Math.floor(this.pathAlt(rw, this.finalFrame(end, rw).togo) / 100) * 100);
      }
      return Math.max(2000, alt);
    }

    // 進入方式の経路に決まった高度があれば、その高度 (なければ null)
    publishedAltitude(ac, rw) {
      if (!rw.transitionAlt) return null;
      const f = [ac.hold && ac.hold.fix, ...ac.directs].find((x) => x && rw.transitionAlt[x.name]);
      return f ? rw.transitionAlt[f.name] : null;
    }

    // 進入許可で指示する高度。決まった高度がある経路はその高度を保つ (低ければ上げる)。ほかは今より下げるだけ
    approachTargetAlt(ac, rw) {
      return this.publishedAltitude(ac, rw) ?? Math.min(ac.tAlt, this.clearedAltitude(ac, rw));
    }

    // 進入許可があれば、角度や横ずれが多少大きくても自分で最終進入コースに乗る
    tryCapture(ac) {
      const rws = ac.approach ? [ac.approach] : this.activeArrivalRunways(ac.dest);
      for (const rw of rws) {
        const cleared = ac.approach === rw;
        const { along, xt, togo } = this.finalFrame(ac, rw);
        if (along < 2 || along > K.CAPTURE_MAX_NM) continue;
        if (Math.abs(xt) > 0.6 + along * 0.08 + (cleared ? 1.5 : 0)) continue;
        if (Math.abs(G.angleDiff(ac.hdg, rw.app.course)) > (cleared ? 120 : K.CAPTURE_ANGLE)) continue;
        if (ac.alt > this.pathAlt(rw, togo) + K.CAPTURE_MARGIN_FT) continue;
        if (ac.spd > K.ILS_MAX_SPD + 2) {
          if (!ac.warnedSpeed) {
            ac.warnedSpeed = true;
            this.emit(`${ac.cs} 速度が速くILSに乗れません (${K.ILS_MAX_SPD}kt以下に)`, 'warn');
          }
          continue;
        }
        ac.ils = rw;
        ac.visual = false;
        ac.tSpd = Math.min(ac.tSpd, Math.round(ac.spd));   // 乗った時の速度を維持して 5NM まで
        ac.directs = [];
        this.emit(`${ac.cs} ESTABLISHED ${rw.app.lda ? 'LDA' : 'ILS'} RWY ${rw.id}`, 'readback');
        return;
      }
    }

    // 進入許可を受けて経路を飛び終えた機体は、自分で最終進入コースへ向かう
    // (近すぎれば一度離れてから、45° で会合する。高度は降下パスの少し下まで下げておく)
    // 45° で寄せると横ずれの分だけ滑走路に近づくので、その分も離れてから向きを変える。
    // 一度向きを変えたら、滑走路の真上に来るまでは離れる方へ戻らない (行ったり来たりしないように)
    // 高すぎる機体は、降下パスより低くなれる距離まで離れてから向きを変える (高度処理)。
    // 向きを変えた後でも、近いのに高すぎると分かったらもう一度離れる (中止する前に)
    steerToFinal(ac) {
      const rw = ac.approach;
      const { along, xt, togo } = this.finalFrame(ac, rw);
      const tooHigh = ac.alt > this.pathAlt(rw, togo) + K.CAPTURE_MARGIN_FT;
      // 向きを変える距離は滑走路端までの距離 (togo) で測る。LDA は MAPt から先の目視の分だけ短いコースでも乗れる
      const turnInAt = Math.max(8 + Math.abs(xt), (ac.alt - rw.elev) / K.GS_FT_PER_NM + 1);
      if (ac.finalPhase !== 'in' && togo >= turnInAt && along >= 2) ac.finalPhase = 'in';
      else if (ac.finalPhase === 'in' && (along < 2 || (togo < 8 && tooHigh))) ac.finalPhase = 'out';
      // 寄せる角度は横ずれに比例 (最大 45°)。延長線の遠くで横切っても行ったり来たりせず、線に乗って近づく
      ac.tHdg = ac.finalPhase === 'in'
        ? G.norm360(rw.app.course - Math.max(-45, Math.min(45, xt * 15)))
        : G.norm360(rw.app.course + 180);
      ac.turnDir = 0;
      const below = this.pathAlt(rw, Math.max(along, 10) + rw.app.extra) - 300;
      ac.tAlt = Math.min(ac.tAlt, Math.max(2000, Math.floor(below / 100) * 100));
    }

    // 進入許可を出したのに高すぎる・ずれすぎで乗れないまま滑走路に近づいたら進入をやめる
    checkMissedApproach(ac) {
      if (ac.directs.length) return;   // まだ経路をたどって FAF へ向かっている途中
      const { along, xt } = this.finalFrame(ac, ac.approach);
      if (along > 2 || along < -1 || Math.abs(xt) > 4) return;
      if (Math.abs(G.angleDiff(ac.hdg, ac.approach.app.course)) > 90) return;   // 空港の上を横切るだけなら対象外
      ac.approach = null;
      ac.autoFinal = false;
      ac.warnedSpeed = false;
      ac.directs = [];
      ac.tAlt = Math.max(3000, Math.round(ac.alt / 1000) * 1000);
      ac.gaCooldown = 60;
      this.emit(`${ac.cs} 最終進入コースに乗れず進入中止 (高度・角度を確認)`, 'warn');
    }

    flyIls(ac) {
      const rw = ac.ils;
      if (ac.visual) { this.flyVisual(ac); return; }
      const { along, xt, togo } = this.finalFrame(ac, rw);
      ac.tHdg = G.norm360(rw.app.course - clamp(xt * 35, -40, 40));
      ac.turnDir = 0;
      ac.tAlt = Math.min(ac.alt, this.pathAlt(rw, Math.max(0, togo)));
      // 指示速度は 5NM まで。そこから進入速度へ減速し、3NM で落ち切っていなければ不安定進入
      ac.ilsSpd = togo > K.APP_SPD_UNTIL_NM ? Math.min(ac.tSpd, K.ILS_MAX_SPD) : K.VAPP;
      if (togo < K.STABLE_NM && ac.spd > K.STABLE_SPD) {
        this.goAround(ac);
        this.emit(`${ac.cs} 速度が速く不安定進入、復行`, 'warn');
        return;
      }
      if (along <= 0.15) {
        if (Math.abs(xt) >= 0.5) { this.goAround(ac); this.emit(`${ac.cs} 滑走路に正対できず復行`, 'warn'); }
        else if (rw.app.lda) ac.visual = true;   // MAPt から先は目で見て滑走路へ
        else this.finish(ac, true);
      }
    }

    // LDA の MAPt から先: 滑走路の手前 1.2NM の延長線上へ回り込み、そこから滑走路端へ
    flyVisual(ac) {
      const rw = ac.ils;
      const join = G.offset(rw, rw.course + 180, 1.2);
      const { along, xt } = G.runwayFrame(ac, rw);
      const onFinal = along < 1.4 && Math.abs(xt) < 0.3;
      ac.tHdg = onFinal ? G.norm360(rw.course - clamp(xt * 35, -40, 40)) : G.bearing(ac, join);
      ac.turnDir = 0;
      const togo = onFinal ? Math.max(0, along) : G.dist(ac, join) + 1.2;
      ac.tAlt = Math.min(ac.alt, this.pathAlt(rw, togo));
      ac.ilsSpd = K.VAPP;
      if (along <= 0.15 && Math.abs(xt) < 0.5) this.finish(ac, true);
      else if (along < -0.5 || G.dist(ac, rw) > rw.app.extra + 3) {
        this.goAround(ac);
        this.emit(`${ac.cs} 滑走路に正対できず復行`, 'warn');
      }
    }

    goAround(ac) {
      const rw = ac.ils;
      ac.tHdg = ac.visual ? ac.hdg : rw.app.course;
      ac.ils = null;
      ac.visual = false;
      ac.approach = null;
      ac.autoFinal = false;
      ac.warnedSpeed = false;   // やり直しの進入でも速度の警告を出す
      ac.tAlt = Math.max(3000, Math.round(ac.alt / 1000) * 1000);
      ac.turnDir = 0;
      ac.tSpd = 200;
      ac.gaCooldown = 60;
    }

    runwayBusy(rw) {
      return this.aircraft.some((a) =>
        (a.state === 'takeoff' && a.rwy === rw) ||
        (a.ils === rw && G.runwayFrame(a, rw).along < 4));
    }

    // ---- 要注意の機体 --------------------------------------------------

    // 進入許可なしで最終進入コースの近く (FAF から 15NM 以内) にいるのに、ILS に乗れない速さ。
    // すでに 210kt 以下へ減速中なら対象外
    tooFastForIls(ac) {
      if (ac.kind !== 'arr' || ac.state !== 'air' || ac.ils || ac.approach) return false;
      if (ac.spd <= K.ILS_MAX_SPD + 2 || ac.spdTarget <= K.ILS_MAX_SPD) return false;
      // 高い所を通過していくだけの機体は対象外 (ILS に乗れる高さの近くまで降りてきた機体だけ)
      return this.activeArrivalRunways(ac.dest).some((rw) =>
        G.dist(ac, rw.faf) < 15 && ac.alt <= this.fafAltitude(rw) + 3000);
    }
    // 放っておくとまずい機体: level 2 = 2分以内に空域外へ出る、level 1 = 着陸/ハンドオフまでの指示が足りない
    attention(ac) {
      if (ac.state !== 'air') return null;
      const gs = ac.spd * (1 + ac.alt / 1000 * 0.016);
      const p = G.offset(ac, ac.hdg, gs * 120 / 3600);
      const e = this.extent;
      const leaving = p.x < e.minX || p.x > e.maxX || p.y < e.minY || p.y > e.maxY;
      const handingOff = ac.exit && ac.directs.includes(ac.exit) && this.exitAltOk(ac, ac.tAlt);
      if (leaving && !handingOff) return { level: 2, text: 'まもなく空域外へ' };
      if (ac.kind === 'arr') {
        if (this.tooFastForIls(ac)) return { level: 1, text: `速度が速い (ILSは${K.ILS_MAX_SPD}kt以下)` };
        if (ac.ils || ac.approach) return null;
        if (ac.hold) return { level: 1, text: `${ac.hold.fix.name}で待機中・進入許可なし` };
        return { level: 1, text: ac.directs.length ? '進入許可なし' : 'レーダー誘導中・進入許可なし' };
      }
      if (!ac.directs.includes(ac.exit)) return { level: 1, text: `${ac.exit.name}への経路なし` };
      if (!this.exitAltOk(ac, ac.tAlt)) return { level: 1, text: `出口高度が未指示 (${this.exitRangeText(ac)})` };
      return null;
    }

    // ---- 判定 ----------------------------------------------------------

    finish(ac, ok, why) {
      ac.done = true;
      const avgDev = ac.devN ? ac.devSum / ac.devN : 0;
      const match = clamp(1 - avgDev / K.MATCH_ZERO_NM, 0, 1);
      if (ok) {
        const pts = 100 + Math.round(match * 50);
        this.score += pts;
        const pct = Math.round(match * 100);
        if (ac.kind === 'arr') {
          this.stats.landed++;
          this.emit(`${ac.cs} ${this.airports[ac.dest].short} RWY ${ac.ils.id} 着陸  +${pts} (航跡一致 ${pct}%)`, 'good');
        } else if (ac.kind === 'ovf') {
          this.stats.passed = (this.stats.passed || 0) + 1;
          this.emit(`${ac.cs} ${ac.exit.name} で次の管制へ (通過)  +${pts} (航跡一致 ${pct}%)`, 'good');
        } else {
          this.stats.departed++;
          this.emit(`${ac.cs} ${ac.exit.name} でハンドオフ  +${pts} (航跡一致 ${pct}%)`, 'good');
        }
      } else {
        this.score -= 100;
        this.stats.lost++;
        this.emit(`${ac.cs} ${why}  -100`, 'bad');
      }
    }

    checkSeparation() {
      const air = this.aircraft.filter((a) => !a.done && a.state === 'air');
      for (const a of air) a.alert = null;
      const now = new Set();
      for (let i = 0; i < air.length; i++) {
        for (let j = i + 1; j < air.length; j++) {
          const a = air[i], b = air[j];
          // 滑走路近くの低高度と、平行な別々の滑走路へ ILS 進入中の組は対象外
          // (羽田 22/23 のように進入コースが交わる組は対象)
          if (a.alt < 1200 || b.alt < 1200) continue;
          if (a.ils && b.ils && a.ils !== b.ils && Math.abs(G.angleDiff(a.ils.app.course, b.ils.app.course)) < 3) continue;
          const v = Math.abs(a.alt - b.alt);
          if (v > K.SEP_FT - 50) continue;   // ほぼ1000ft差なら間隔は取れているとみなす
          const d = G.dist(a, b);
          if (d < 0.25 && v < 300) {
            a.alert = b.alert = 'viol';
            this.gameOver('collision', a, b);
            return;
          }
          const minSep = a.ils && b.ils ? 2.5 : K.SEP_NM;
          if (d < minSep) {
            a.alert = b.alert = 'viol';
            const key = a.cs < b.cs ? `${a.cs}|${b.cs}` : `${b.cs}|${a.cs}`;
            now.add(key);
            if (!this.violating.has(key)) {
              this.stats.violations++;
              this.score -= 30;
              this.emit(`間隔欠如: ${a.cs} / ${b.cs}  -30`, 'bad');
            }
          } else if (d < minSep + 2) {
            if (a.alert !== 'viol') a.alert = 'warn';
            if (b.alert !== 'viol') b.alert = 'warn';
          }
        }
      }
      this.violating = now;
    }

    // ---- 保存と復元 (ページを再読み込みしても続きから遊べるように) ------
    // Fix・滑走路などマップの物は名前で書き出し、復元時にマップから引き直す

    refOut(o) {
      if (!o) return null;
      if (o.name && this.fixes[o.name] === o) return { f: o.name };
      if (o.key && this.runways[o.key] === o) return { rw: o.key };
      const owner = Object.values(this.runways).find((rw) => rw.faf === o);
      if (owner) return { faf: owner.key };
      const baseOwner = Object.values(this.runways).find((rw) => rw.bases[1] === o || rw.bases[-1] === o);
      if (baseOwner) return { base: baseOwner.key, side: o.side };
      return { x: o.x, y: o.y };
    }

    refIn(r) {
      if (!r) return null;
      if (r.f) return this.fix(r.f);
      if (r.rw || r.faf || r.base) {
        const rw = this.runways[r.rw || r.faf || r.base];
        if (!rw) throw new Error(`滑走路 ${r.rw || r.faf || r.base} がありません`);
        return r.faf ? rw.faf : r.base ? rw.bases[r.side] : rw;
      }
      return { x: r.x, y: r.y };
    }

    snapshot() {
      const aircraft = this.aircraft.filter((ac) => !ac.done).map((ac) => {
        const o = {};
        for (const [k, v] of Object.entries(ac)) {
          if (k.startsWith('_')) continue;
          if (SAVE_REFS.includes(k)) o[k] = this.refOut(v);
          else if (SAVE_LISTS.includes(k)) o[k] = v.map((p) => this.refOut(p));
          else if (k === 'hold') o[k] = v && { ...v, fix: this.refOut(v.fix) };
          else o[k] = v;
        }
        return o;
      });
      return {
        version: 1, map: this.map.id, opts: this.opts, time: this.time, score: this.score,
        stats: this.stats, log: this.log, spawnTimer: this.spawnTimer, violating: [...this.violating], aircraft,
        autoUsed: !!this.autoUsed,
      };
    }

    static restore(map, snap) {
      const g = new Game(map, snap.opts);
      Object.assign(g, { time: snap.time, score: snap.score, stats: snap.stats, log: snap.log, spawnTimer: snap.spawnTimer,
        autoUsed: !!snap.autoUsed });
      g.logVersion = snap.log.length + 1;
      g.violating = new Set(snap.violating);
      g.aircraft = snap.aircraft.map((o) => {
        const ac = makeAircraft({ ...o });
        for (const k of SAVE_REFS) ac[k] = g.refIn(o[k]);
        for (const k of SAVE_LISTS) ac[k] = (o[k] || []).map((r) => g.refIn(r));
        ac.hold = o.hold && { ...o.hold, fix: g.refIn(o.hold.fix) };
        if (ac.routeSpdLimit == null) ac.routeSpdLimit = Infinity;   // JSON では Infinity が null になる
        return ac;
      });
      return g;
    }

    gameOver(reason, a, b) {
      this.over = { reason, a, b, t: this.time };
      if (reason === 'collision') this.emit(`衝突: ${a.cs} と ${b.cs}`, 'bad');
    }
  }

  ATC.Game = Game;
  ATC.fmtAlt = fmtAlt;
  ATC.parityOk = parityOk;
})(window.ATC);

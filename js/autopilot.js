// コンピュータ管制: プレイヤーの代わりに 2 秒ごとに状況を見て、普通のコマンドで指示を出す
//   出発: 滑走路ごとに間隔をあけて離陸させ、出口高度まで上昇、出口 Fix へ向かわせる
//   到着: 滑走路の手前 90NM ほどで着陸の順番を決め、前の機体との時間の間隔が足りない分は遠いうちに減速で吸収する。
//         減速で吸収しきれない分はレーダー誘導 (経路から斜めに外して、間に合うところで次の Fix へ戻す)、
//         それでも足りない大きな遅れだけ STAR の途中の Fix で待機。STAR の Fix は飛ばさない (経路短縮はしない)。
//         順番が来て間隔が取れていれば進入許可
//         (それでも詰まったら、従来どおり STAR の終点で待機。高度を 1000ft ずつ積む)
//   間隔: 同じ滑走路で詰まったら後ろを減速。90 秒先までに接近しそうな組は、片方の上昇・降下を止めるか 1000ft 離す
window.ATC = window.ATC || {};
(function (ATC) {
  'use strict';
  const G = ATC.geo;
  const K = ATC.consts;

  const EVERY = 2;           // 判断する間隔(秒)
  const LEVEL_HOLD = 45;      // 衝突回避で止めた高度を保つ時間(秒)
  const MIN_SPACING = 5;      // 進入許可を出すときに最低限必要な、進入中の機体との残り距離の差(NM)
  const CLEAR_WITHIN = 45;    // 滑走路までの残り距離がこれ以下になったら進入許可を考える(NM)
  const SEQ_WITHIN = 90;      // 残り距離がこれ以下になったら着陸の順番を決める(NM)
  const SEP_ARR_ONLY = 110;   // 着陸の間隔 (到着専用の滑走路)(秒)
  const SEP_MIXED = 170;      // 着陸の間隔 (離陸にも使う滑走路。間に離陸を入れる)(秒)
  const MIN_SPD = 220;        // 遅れを吸収するときの最低速度(kt)。ILS に乗れる 210kt より速く (許可前に勝手に乗らないように)
  const CRUISE_SPD = 280;
  const CLEAR_DELAY_OK = 20;  // 残りの遅れがこれ以下なら進入許可を出してよい(秒)
  const IN_TRAIL_NM = 10;     // 同じ経路の前の機体がこれより近ければ、その速度に合わせる(NM)
  const IN_TRAIL_CLOSE = 6;   // これより近ければ、前の機体より 20kt 遅くして間を広げる(NM)
  const SPEEDS = [280, 250, 230, 220];   // 遅れを吸収するときに指示する速度 (実際の管制のように区切りのよい値で)
  const SPEED_EVERY = 60;     // 速度の指示を出し直す最短の間隔 (追いつきそうな時の減速は除く)(秒)
  const HOLD_MARGIN = 40;     // 減速で吸収できる量をこれ以上超える遅れがあれば、レーダー誘導か途中の Fix で待機(秒)
  const VECTOR_MAX = 480;     // レーダー誘導で吸収する遅れの上限。これより大きければ待機(秒)
  const VECTOR_ANGLE = 50;    // 次の Fix への方位から外す角度(°)
  const VECTOR_TIME = 900;    // レーダー誘導を続ける最長の時間(秒)
  const STACK_WITHIN = 60;    // 残り距離がこれ以下になったら待機用の高度へ降ろし始める(NM)
  const TRAIL_SLOW = 4.5;     // 同じ滑走路で前との距離の差がこれより詰まったら減速(NM)
  const TRAIL_MARGIN = 15;    // 前との時間の差が、着陸の間隔よりこれ以上短ければ減速(秒)
  const TOO_CLOSE = 3;        // これより詰まったら後ろの機体を復行させる(NM)
  const DEP_INTERVAL = 90;    // 同じ滑走路から続けて離陸させる間隔(秒)
  const SAME_SID_INTERVAL = 120;   // 同じ出口へ向かう機体を続けて離陸させる間隔 (別の滑走路からでも)(秒)
  const SAME_APT_INTERVAL = 45;    // 同じ空港の別の滑走路から続けて離陸させる間隔 (平行滑走路で横並びにならないように)(秒)
  const STACK_BASE = 6000;    // 待機の一番下の高度
  const PREDICT = [0, 15, 30, 45, 60, 90];   // 接近を調べる先読み時間(秒)
  const CONFLICT_NM = 4.5;

  const roundDown = (v) => Math.floor(v / 100) * 100;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const segmentsCross = (p, q, r, s) => cross(p, q, r) * cross(p, q, s) < 0 && cross(r, s, p) * cross(r, s, q) < 0;
  const roundUp = (v) => Math.ceil(v / 100) * 100;

  class Auto {
    constructor() {
      this.timer = 0;
      this.lastTakeoff = {};
      this.lastByExit = {};
    }

    update(game, dt) {
      this.timer -= dt;
      if (this.timer > 0 || game.over) return;
      this.timer = EVERY;
      const air = game.aircraft.filter((a) => !a.done);
      this.flying = air.filter((a) => a.state === 'air' && a.alt >= 1200);
      this.resolveConflicts(game, air);
      this.departures(game, air);
      this.arrivals(game, air);
    }

    cmd(game, ac, text) { ATC.commands.run(game, `${ac.cs} ${text}`, null); }

    held(game, ac) { return (ac.autoHoldUntil || 0) > game.time; }

    setAlt(game, ac, alt) {
      if (Math.abs(ac.tAlt - alt) >= 100) this.cmd(game, ac, `A ${alt}`);
    }

    // ふだんの上昇・降下の指示も、ほかの機体と接近しない時だけ出す
    setAltIfSafe(game, ac, alt) {
      if (Math.abs(ac.tAlt - alt) < 100) return;
      if (this.safeAt(this.flying, ac, alt)) this.setAlt(game, ac, alt);
    }

    // ---- 出発 --------------------------------------------------------

    departures(game, air) {
      const waiting = air.filter((a) => a.state === 'waiting').sort((a, b) => b.waitTime - a.waitTime);
      const done = new Set();
      for (const ac of waiting) {
        const rw = ac.rwy;
        if (done.has(rw.key)) continue;
        done.add(rw.key);
        if (game.time - (this.lastTakeoff[rw.key] ?? -1e9) < DEP_INTERVAL) continue;
        const exitKey = `${ac.origin} ${ac.exit.name}`;
        if (game.time - (this.lastTakeoff[ac.origin] ?? -1e9) < SAME_APT_INTERVAL) continue;
        if (game.time - (this.lastByExit[exitKey] ?? -1e9) < SAME_SID_INTERVAL) {
          done.delete(rw.key);   // この滑走路の次の機体 (別の出口) は出してよい
          continue;
        }
        if (game.runwayBusy(rw) || this.arrivalClose(game, air, rw)) continue;
        this.cmd(game, ac, `T C ${ac.exitAlt}`);
        if (ac.state === 'takeoff') {
          this.lastTakeoff[rw.key] = game.time;
          this.lastTakeoff[ac.origin] = game.time;
          this.lastByExit[exitKey] = game.time;
        }
      }
      // 出発機と上空通過機: 出口 Fix へ向かわせ、出口の高度の条件に合わせる
      // (上限のある通過機は、出口の 60NM 手前から降ろす)
      for (const ac of air) {
        if (!ac.exit || ac.state !== 'air') continue;
        if (this.held(game, ac)) continue;   // 接近回避の旋回・高度を保っている間はそのまま
        if (!ac.directs.includes(ac.exit) && !ac.hold) {
          // 出口の高度に届かないまま出口 Fix に着いたら、高度が合うまでそこで待機 (直行の指示を出し続けない)
          if (G.dist(ac, ac.exit) < 3) game.enterHold(ac, ac.exit);
          else this.cmd(game, ac, ac.exit.name);
        }
        if (ac.tAlt < ac.exitAlt) this.setAltIfSafe(game, ac, ac.exitAlt);
        else if (ac.exitAltMax != null && ac.tAlt > ac.exitAltMax && G.dist(ac, ac.exit) < 60) {
          this.setAltIfSafe(game, ac, ac.exitAltMax);
        } else if (ac.parity && !game.exitAltOk(ac, ac.tAlt)) {
          // 間隔を取るために方向と合わない高度にしていたら、合う高度へ戻す
          this.setAltIfSafe(game, ac, game.nearestExitAlt(ac, ac.tAlt));
        }
      }
    }

    // 同じ滑走路へ着陸する機体が 6NM 以内にいる
    arrivalClose(game, air, rw) {
      return air.some((a) => (a.ils === rw || a.approach === rw) && this.distToGo(game, a, rw) < 6);
    }

    // ---- 到着 --------------------------------------------------------

    // 滑走路までの残り距離 (経路をたどった長さ)
    distToGo(game, ac, rw) {
      if (ac.ils) return ac.visual ? G.dist(ac, ac.ils) : Math.max(0, game.finalFrame(ac, ac.ils).togo);
      if (ac.autoFinal && ac.approach === rw) {
        // 自動で最終進入へ回り込み中: 一度離れる分と 45° で寄せる分を足す
        const { along, xt } = game.finalFrame(ac, rw);
        const turnInAt = Math.max(8 + Math.abs(xt), (ac.alt - rw.elev) / K.GS_FT_PER_NM + 1) - rw.app.extra;
        const out = ac.finalPhase === 'in' ? 0 : Math.max(0, turnInAt - along);
        return out * 2 + Math.abs(xt) * Math.SQRT2 + Math.max(along, turnInAt) - Math.abs(xt) + rw.app.extra;
      }
      let d = 0, p = ac;
      const tailPts = [rw.faf, rw.bases[1], rw.bases[-1]];
      // 待機中は待機の Fix から (STAR の途中で待機していれば、その先の経路も足す)
      // レーダー誘導中は、戻る先の Fix とその先の経路をたどる
      const hf = ac.hold && ac.hold.fix;
      const vec = this.vectorPath(game, ac);
      const pts = vec || [...(hf ? [hf] : []), ...ac.directs.filter((f) => !tailPts.includes(f) && f !== hf)];
      for (const f of pts) { d += G.dist(p, f); p = f; }
      for (const f of game.approachTail(rw, p === ac ? ac : p)) { d += G.dist(p, f); p = f; }
      return d + G.dist(p, rw.app) + rw.app.extra;
    }

    // 到着の順番を管理する単位。平行な滑走路は別々、進入コースが交わる滑走路 (羽田 22/23 の ILS) はまとめて 1 列
    // (22/23 の LDA は平行な 2 本のコースなので別々)
    laneKey(game, rw) {
      const parallel = game.activeArrivalRunways(rw.apt).every((r) => Math.abs(G.angleDiff(r.app.course, rw.app.course)) < 3);
      return parallel ? rw.key : rw.apt;
    }

    // 遅れのない標準の速度 (滑走路までの残り距離ごと)。到着予定時刻の計算に使う
    // (進入許可を受けた機体は滑走路の 25NM 手前から ILS に乗れる 210kt まで落とす)
    static nominalSpd(s) { return s < 8 ? 160 : s < 25 ? 210 : s < 40 ? 250 : CRUISE_SPD; }

    // 残り距離 d を標準の速度で飛んだときにかかる時間(秒)
    static eta(d) {
      const edges = [0, 8, 25, 40, Infinity];
      let t = 0;
      for (let i = 0; i < 4 && d > edges[i]; i++) t += (Math.min(d, edges[i + 1]) - edges[i]) * 3600 / Auto.nominalSpd(edges[i]);
      return t;
    }

    // 残り距離 d から最低速度で飛んで吸収できる遅れ(秒)。滑走路の 25NM 手前からは速度を変えない
    static absorbable(d) {
      const edges = [25, 40, Infinity];
      let t = 0;
      for (let i = 0; i < 2 && d > edges[i]; i++) {
        t += (Math.min(d, edges[i + 1]) - edges[i]) * 3600 * (1 / MIN_SPD - 1 / Auto.nominalSpd(edges[i]));
      }
      return t;
    }

    separation(game, rw) {
      const mixed = game.activeArrivalRunways(rw.apt).some((r) => this.laneKey(game, r) === this.laneKey(game, rw) &&
        (game.config.airports[r.apt].dep || []).includes(r.id));
      return mixed ? SEP_MIXED : SEP_ARR_ONLY;
    }

    // STAR を s に切り替えたときの、滑走路までの経路の長さ (assignStar と同じく、近い Fix から乗る)
    starDist(game, ac, s) {
      const plan = s.plan;
      let i = 0;
      for (let k = 1; k < plan.length; k++) if (G.dist(ac, plan[k]) < G.dist(ac, plan[i])) i = k;
      if (i < plan.length - 1 && G.dist(ac, plan[i + 1]) < G.dist(plan[i], plan[i + 1])) i++;
      const rw = game.runway(s.dest, s.rwy);
      let d = 0, p = ac;
      for (const f of [...plan.slice(i), ...game.approachTail(rw, plan[plan.length - 1])]) { d += G.dist(p, f); p = f; }
      return d + G.dist(p, rw.app) + rw.app.extra;
    }

    // 標準到着経路の終点から先 (進入方式の経路と最終進入への寄せ) が、同じ空港のほかの滑走路の最終進入 (FAF より内側) を横切るか。
    // 横切る経路 (羽田の南風で KAIHO→22 の LDA Y は 23 の最終進入を横切る) は、ほかに選べる経路があれば使わない
    crossesOtherFinal(game, s) {
      const rw = game.runway(s.dest, s.rwy);
      const last = s.plan[s.plan.length - 1];
      const path = [last, ...game.approachTail(rw, last), rw.app];
      return game.activeArrivalRunways(s.dest).some((r) => r !== rw &&
        path.slice(1).some((q, i) => segmentsCross(path[i], q, r.faf, r.app)));
    }

    // 着陸の順番 (AMAN)。滑走路の列ごとに、順番を決めた時の着陸予定時刻 (seqT) の順に並べ、
    // 前の機体から決まった時間ずつあけた枠を割り当てる。枠と今の到着予定との差が、吸収しなければならない遅れ
    sequence(game, arr) {
      const lanes = {}, info = new Map(), fresh = [];
      const laneOf = (rw) => (lanes[this.laneKey(game, rw)] = lanes[this.laneKey(game, rw)] || []);
      for (const ac of arr) {
        // 復行・進入中止の直後は順番を決め直す
        if (ac.gaCooldown > 0 && !ac.ils && !ac.approach) ac.seqT = null;
        const rw = ac.ils || ac.approach || this.plannedRunway(game, ac);
        if (!rw) continue;
        const d = this.distToGo(game, ac, rw);
        const w = { ac, rw, d, eta: Auto.eta(d), delay: 0, prev: null };
        info.set(ac, w);
        if (ac.seqT != null) laneOf(rw).push(w);
        else if (d <= SEQ_WITHIN && ac.gaCooldown <= 0) fresh.push(w);
      }
      const schedule = (lane) => {
        lane.sort((a, b) => a.ac.seqT - b.ac.seqT);
        let prev = null;
        for (const w of lane) {
          w.slot = prev ? Math.max(w.eta, prev.slot + this.separation(game, w.rw)) : w.eta;
          w.delay = w.slot - w.eta;
          w.prev = prev;
          prev = w;
        }
      };
      Object.values(lanes).forEach(schedule);
      // 新しく順番に入る機体: 標準到着経路が選べるなら、いちばん早く降りられるもの (同じくらいなら主な経路) にする。
      // 選ぶのは最初の 1 回だけ (復行後に選び直すと、経路の手前の Fix へ引き返してしまう)
      fresh.sort((a, b) => a.eta - b.eta);
      for (const w of fresh) {
        const { ac } = w;
        const active = game.activeArrivalRunways(ac.dest);
        let best = null;
        const options = ac.autoStar ? [] : game.starOptions(ac)
          .filter((s) => active.includes(game.runway(s.dest, s.rwy)));
        const clean = options.filter((s) => !this.crossesOtherFinal(game, s));
        for (const s of clean.length ? clean : options) {
          const rw = game.runway(s.dest, s.rwy);
          const eta = Auto.eta(this.starDist(game, ac, s));
          const lane = lanes[this.laneKey(game, rw)] || [];
          const last = lane[lane.length - 1];
          const land = last ? Math.max(eta, last.slot + this.separation(game, rw)) : eta;
          const score = land - (s.weight || 1) * 30;   // 主な経路 (weight の大きいもの) を優先
          if (!best || score < best.score) best = { s, score };
        }
        if (best && best.s.name !== ac.entry && !ac.approach && !ac.ils) {
          this.cmd(game, ac, `STAR ${best.s.name}`);
          w.rw = this.plannedRunway(game, ac);
          w.d = this.distToGo(game, ac, w.rw);
          w.eta = Auto.eta(w.d);
        }
        ac.autoStar = true;
        ac.seqT = game.time + w.eta;
        const lane = laneOf(w.rw);
        lane.push(w);
        schedule(lane);
      }
      return info;
    }

    // レーダー誘導中の機体が戻る経路 (戻る先の Fix から)。誘導中でなければ null
    vectorPath(game, ac) {
      const v = ac.autoVec;
      if (!v) return null;
      // プレイヤーが別の指示を出したら誘導は終わり
      if (ac.directs.length || ac.hold || ac.approach) { ac.autoVec = null; return null; }
      return [v.target, ...v.rest].map((n) => game.fixes[n]).filter(Boolean);
    }

    // 経路に戻るときの Fix: いちばん近い Fix。ただしその次の Fix の方が、2 つの Fix の間より近ければ次へ (通り過ぎた Fix へ戻らない)
    rejoinFix(game, ac) {
      const plan = ac.plan.filter((f) => game.fixes[f.name]);
      if (!plan.length) return null;
      let i = 0;
      for (let k = 1; k < plan.length; k++) if (G.dist(ac, plan[k]) < G.dist(ac, plan[i])) i = k;
      if (i < plan.length - 1 && G.dist(ac, plan[i + 1]) < G.dist(plan[i], plan[i + 1])) i++;
      return plan[i];
    }

    inside(game, p, margin) {
      const e = game.extent;
      return p.x > e.minX + margin && p.x < e.maxX - margin && p.y > e.minY + margin && p.y < e.maxY - margin;
    }

    // 経路から斜めに外す。戻る先は次の Fix (Fix を飛ばさない)。次の Fix まで 8NM 以上ある時だけ。
    // 空域の内側に収まり、ほかの機体と接近しない側へ
    startVector(game, ac, rw) {
      const target = ac.directs[0];
      if (!target || !game.fixes[target.name] || G.dist(ac, target) < 8) return false;
      let best = null;
      for (const side of [1, -1]) {
        const hdg = Math.round(G.norm360(G.bearing(ac, target) + side * VECTOR_ANGLE));
        const ahead = G.offset(ac, hdg, 15);
        if (!this.inside(game, ahead, 6)) continue;
        const probe = { ...ac, hdg };
        if (this.flying.some((x) => x !== ac && this.conflict(probe, x))) continue;
        // 滑走路から遠ざかる側を選ぶ (最終進入の近くへ寄せない)
        const score = G.dist(ahead, rw);
        if (!best || score > best.score) best = { hdg, score };
      }
      if (!best) return false;
      const rest = ac.directs.slice(1).filter((f) => game.fixes[f.name]).map((f) => f.name);
      this.cmd(game, ac, `H ${String(best.hdg).padStart(3, '0')}`);
      ac.autoVec = { target: target.name, rest, until: game.time + VECTOR_TIME };
      return true;
    }

    // まだ進入許可のない機体の遅れを、減速、レーダー誘導、STAR の途中の Fix での待機で吸収する
    absorbDelay(game, w) {
      const { ac, d, delay } = w;
      const room = Auto.absorbable(d);
      if (ac.autoVec) {
        // 減速で間に合うところまで遅れが減ったら (または時間切れ・空域の端が近づいたら) 次の Fix へ戻す
        const v = ac.autoVec;
        if (delay <= room + 10 || game.time > v.until || !this.inside(game, G.offset(ac, ac.hdg, 6), 3)) {
          ac.autoVec = null;
          this.cmd(game, ac, v.target);
        } else {
          const cap = ac.alt < K.LOW_ALT || ac.tAlt < K.LOW_ALT ? K.LOW_ALT_SPD : CRUISE_SPD;
          if (Math.abs(ac.tSpd - Math.min(cap, MIN_SPD)) >= 10) this.cmd(game, ac, `S ${Math.min(cap, MIN_SPD)}`);
        }
        return;
      }
      const fix = ac.hold ? ac.hold.fix : ac.directs[0];
      const last = ac.plan[ac.plan.length - 1];
      if (ac.hold) {
        // STAR の途中で待機させた機体は、減速で間に合うところまで遅れが減ったら経路へ戻す
        if (ac.autoHeld && delay <= room + 10) {
          ac.autoHeld = false;
          this.cmd(game, ac, fix.name);
        }
        return;
      }
      if (delay > room + HOLD_MARGIN && delay - room <= VECTOR_MAX && d > 30 && this.startVector(game, ac, w.rw)) return;
      if (delay > room + HOLD_MARGIN && fix && fix !== last && game.fixes[fix.name] && G.dist(ac, fix) < 2.5 && d > 25) {
        // 同じ Fix で待機中の機体と 1000ft 以上離れた高度で待機する (空いた高度がなければ待機せず減速だけ)
        const taken = game.aircraft.filter((o) => o !== ac && o.hold && o.hold.fix === fix).map((o) => o.tAlt);
        const base = Math.round(ac.tAlt / 1000) * 1000;
        const alt = [0, 1000, -1000, 2000, -2000, 3000].map((k) => base + k)
          .find((v) => v >= STACK_BASE && taken.every((o) => Math.abs(o - v) >= 1000) && this.safeAt(this.flying, ac, v));
        if (alt != null) {
          this.setAlt(game, ac, alt);
          game.enterHold(ac, fix);
          ac.autoHeld = true;
          return;
        }
      }
      if (d <= 25) return;
      // 必要な分だけ遅くする: 1NM あたりに遅らせる時間を、最低速度で飛んだときの割合 f に合わせる
      const vnom = Auto.nominalSpd(d);
      const f = room > 0 ? Math.min(1, Math.max(0, delay / room)) : 0;
      const v = Math.max(MIN_SPD, Math.min(CRUISE_SPD, Math.round(1 / (1 / vnom + f * (1 / MIN_SPD - 1 / vnom)) / 10) * 10));
      const cap = ac.alt < K.LOW_ALT || ac.tAlt < K.LOW_ALT ? K.LOW_ALT_SPD : CRUISE_SPD;
      let target = f < 0.03 ? CRUISE_SPD : v;
      // 同じ経路で前を飛ぶ機体に追いつきそうなら、その速度に合わせる (近すぎれば 20kt 遅く)
      const lead = this.inTrailLeader(game, ac);
      const close = lead && G.dist(ac, lead) < IN_TRAIL_CLOSE;
      if (lead) target = Math.min(target, Math.max(MIN_SPD, (close ? lead.tSpd - 20 : lead.tSpd)));
      // 区切りのよい速度に切り下げ、10000ft 未満は 250kt まで
      target = Math.min(cap, SPEEDS.find((s) => s <= target) ?? MIN_SPD);
      const diff = target - ac.tSpd;
      if (Math.abs(diff) < 20 && !(close && diff < 0)) return;
      if (game.time < (ac.autoSpdT || 0) && !(close && diff < 0)) return;
      // 速度を戻す (上げる) のは、前の指示から 2 倍の時間がたってから (上げ下げを繰り返さないように)
      if (diff > 0 && game.time < (ac.autoSpdT || 0) + SPEED_EVERY) return;
      ac.autoSpdT = game.time + SPEED_EVERY;
      this.cmd(game, ac, `S ${target}`);
    }

    // 同じ経路の前を飛んでいる到着機 (同じ Fix へ向かっていて Fix に近い方か、自分の経路の先の Fix へ向かっている機体) のうち、
    // 10NM 以内でいちばん近いもの。待機中・ILS 上の機体は除く
    inTrailLeader(game, ac) {
      const next = ac.directs[0];
      if (!next) return null;
      let best = null;
      for (const o of game.aircraft) {
        if (o === ac || o.kind !== 'arr' || o.state !== 'air' || o.ils || o.hold || !o.directs.length) continue;
        const k = ac.directs.indexOf(o.directs[0]);
        if (k < 0 || (k === 0 && G.dist(o, next) >= G.dist(ac, next))) continue;
        const gap = G.dist(ac, o);
        if (gap < IN_TRAIL_NM && (!best || gap < best.gap)) best = { o, gap };
      }
      return best && best.o;
    }

    plannedRunway(game, ac) {
      const active = game.activeArrivalRunways(ac.dest);
      return active.find((r) => r.id === ac.plannedRwy) || active[0];
    }

    arrivals(game, air) {
      const arr = air.filter((a) => a.kind === 'arr' && a.state === 'air');
      // 進入中の機体を滑走路ごとに、近い順に並べる
      const lanes = {};
      for (const ac of arr) {
        const rw = ac.ils || ac.approach;
        if (rw) {
          const key = this.laneKey(game, rw);
          (lanes[key] = lanes[key] || []).push({ ac, d: this.distToGo(game, ac, rw) });
        }
      }
      for (const lane of Object.values(lanes)) lane.sort((a, b) => a.d - b.d);

      const seq = this.sequence(game, arr);

      // まだ進入許可のない機体: 順番が来て間隔が取れれば許可、取れなければ遅れを吸収、最後は待機用の高度へ
      const waiting = arr.filter((a) => !a.ils && !a.approach && seq.has(a)).map((a) => seq.get(a))
        .sort((a, b) => a.d - b.d);
      // 待機用の高度は空港ごとに 1 機 1 段 (滑走路ごとだと、別の滑走路へ行く機体が同じ Fix で同じ高度になる)。一度決めた段は、下の段が空いた時だけ 1 段ずつ下げる
      // (順番を毎回並べ替えると、機体どうしが高度を入れ替えようとしてすれ違ってしまう)
      const used = {};
      for (const w of waiting) {
        if (w.ac.autoStack) (used[w.ac.dest] = used[w.ac.dest] || new Set()).add(w.ac.autoStack);
      }
      for (const w of waiting) {
        const { ac, rw, d } = w;   // w.delay: 順番の枠までの遅れ(秒)、w.prev: 同じ列の 1 つ前
        // レーダー誘導された機体 (プレイヤーの誘導・進入許可の取り消し・接近回避の旋回の後) は、
        // 経路の終点へ飛ばさず、近くにある先の Fix から経路に戻す
        if (!ac.directs.length && !ac.hold && !ac.autoVec && !this.held(game, ac)) {
          const f = this.rejoinFix(game, ac);
          if (f) this.cmd(game, ac, f.name);
        }
        const laneKey = this.laneKey(game, rw);
        const lane = lanes[laneKey] || [];
        // 近くに自分より低い、まだ許可のない到着機がいれば先に行かせる (待機の積み重ねを下から降ろす)
        const lower = waiting.find((o) => o.ac !== ac && o.ac.alt < ac.alt - 300 && G.dist(o.ac, ac) < 8);
        const lowerFirst = !!lower;
        // 下の機体が着陸の順番では後ろなら、順番を入れ替える (互いに待ち合って動けなくならないように)
        if (lower && lower.ac.seqT != null && ac.seqT != null && lower.ac.seqT > ac.seqT &&
            this.laneKey(game, lower.rw) === this.laneKey(game, rw)) {
          [ac.seqT, lower.ac.seqT] = [lower.ac.seqT, ac.seqT];
        }
        // 進入許可を出すと FAF の高度まで降りるので、その降下が安全な時だけ
        const descentSafe = this.safeAt(this.flying, ac, game.approachTargetAlt(ac, rw));
        // 復行・進入中止の直後 (60秒) は許可を出し直さない
        const settled = ac.gaCooldown <= 0;
        // 順番が来ている (前の機体が進入許可済み) うえ、時間の間隔が取れている
        const turn = ac.seqT != null && (!w.prev || w.prev.ac.approach || w.prev.ac.ils) && w.delay <= CLEAR_DELAY_OK;
        // STAR の終点が遠い空港 (高松の POPAI など) もあるので、終点の近くや終点での待機中は距離によらず
        const near = d < CLEAR_WITHIN || (ac.hold && !ac.autoHeld) || ac.directs.length <= 1;
        if (near && settled && turn && !ac.autoVec && !lowerFirst && descentSafe && lane.every((o) => Math.abs(o.d - d) >= MIN_SPACING)) {
          if (ac.hold) ac.autoHeld = false;
          this.cmd(game, ac, `ILS ${rw.id}`);
          if (ac.approach) {
            if (ac.autoStack) used[ac.dest].delete(ac.autoStack);
            ac.autoStack = 0;
            lane.push({ ac, d });
            lane.sort((a, b) => a.d - b.d);
            lanes[laneKey] = lane;
          }
          continue;
        }
        if (ac.seqT != null) this.absorbDelay(game, w);
        if (d > STACK_WITHIN || this.held(game, ac)) continue;
        const set = used[ac.dest] = used[ac.dest] || new Set();
        if (!ac.autoStack) {
          let lv = STACK_BASE;
          while (set.has(lv)) lv += 1000;
          ac.autoStack = lv;
          set.add(lv);
        } else if (ac.autoStack > STACK_BASE && !set.has(ac.autoStack - 1000)) {
          set.delete(ac.autoStack);
          ac.autoStack -= 1000;
          set.add(ac.autoStack);
        }
        this.setAltIfSafe(game, ac, ac.autoStack);
      }

      // 接近回避で旋回させた進入許可済みの機体は、旋回を保つ時間が過ぎたら自分で最終進入へ回り込ませる
      for (const ac of arr) {
        if (ac.approach && !ac.ils && !ac.directs.length && !ac.autoFinal && !this.held(game, ac)) {
          ac.autoFinal = true;
          ac.finalPhase = null;
        }
      }

      // 同じ滑走路で前の機体に詰まったら減速、十分離れたら戻す。
      // 間隔は順番づけと同じく時間で見る (標準の速度で飛んだときの到着時刻の差。滑走路に近い前の機体ほど遅いので、距離だけだと早く減速しすぎる)
      for (const lane of Object.values(lanes)) {
        for (let i = 1; i < lane.length; i++) {
          const { ac, d } = lane[i];
          const gap = d - lane[i - 1].d;
          const sep = this.separation(game, ac.ils || ac.approach);
          const gapT = Auto.eta(d) - Auto.eta(lane[i - 1].d);
          const tight = gap < TRAIL_SLOW || gapT < sep - TRAIL_MARGIN;
          const loose = gap > TRAIL_SLOW + 2 && gapT > sep;
          // 最後の手段: 詰まりすぎたら復行 (ILS 上) か進入許可の取り消し。列に並び直させる
          // (自分で最終進入へ回り込み中の機体は残り距離が見積もりなので、実際に前の機体が近い時だけ)
          const near = ac.ils || G.dist(ac, lane[i - 1].ac) < 5;
          if (gap < TOO_CLOSE && near) {
            const onIls = !!ac.ils;
            this.cmd(game, ac, 'GA');
            // 進入許可を取り消した機体は、遅いままだと許可なしで別の ILS に乗ってしまうので速度を上げておく
            if (!onIls) this.cmd(game, ac, `S ${MIN_SPD}`);
            lane.splice(i, 1);
            i--;
            continue;
          }
          // 段階的に落とす: まず 180kt (ILS 上は 170kt)、大きく詰まっていれば 160kt (ILS 上は 150kt)
          const veryTight = gap < TRAIL_SLOW || gapT < sep - 45;
          const slow = veryTight ? (ac.ils ? 150 : 160) : (ac.ils ? 170 : 180);
          if (tight && ac.tSpd > slow) {
            this.cmd(game, ac, `S ${slow}`);
            ac.autoSpdT = game.time + SPEED_EVERY;
          } else if (loose && ac.tSpd < K.ILS_MAX_SPD && game.time >= (ac.autoSpdT || 0)) {
            this.cmd(game, ac, `S ${K.ILS_MAX_SPD}`);   // 進入中なので ILS に乗れる速さまで (減速から 60 秒たってから)
          }
        }
      }
    }

    // ---- 接近の回避 --------------------------------------------------

    predict(ac, t) {
      const gs = ac.spd * (1 + ac.alt / 1000 * 0.016);
      const p = G.offset(ac, ac.hdg, gs * t / 3600);
      const rate = ac.tAlt > ac.alt ? (ac.alt < 10000 ? 3000 : 2000) : 2000;
      const dz = Math.min(Math.abs(ac.tAlt - ac.alt), rate / 60 * t);
      return { x: p.x, y: p.y, alt: ac.alt + Math.sign(ac.tAlt - ac.alt) * dz };
    }

    conflict(a, b) {
      for (const t of PREDICT) {
        const p = this.predict(a, t), q = this.predict(b, t);
        if (Math.abs(p.alt - q.alt) < 1000 && G.dist(p, q) < CONFLICT_NM) return true;
      }
      return false;
    }

    resolveConflicts(game, air) {
      const list = air.filter((a) => a.state === 'air' && a.alt >= 1200);
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          if (a.ils && b.ils) continue;            // ILS 上どうしは高度を変えられないので、順番と速度で調整済み
          if (!this.conflict(a, b)) continue;
          this.separate(game, list, a, b);
        }
      }
    }

    // この高度を指示したら、ほかのどの機体とも 90 秒先までに接近しないか
    safeAt(list, m, alt) {
      const probe = { ...m, tAlt: alt };
      return list.every((x) => x === m || !this.conflict(probe, x));
    }

    // 上昇・降下している方を相手の 1000ft 手前で止める。どちらも水平なら片方を 1000ft 動かす。
    // 新しい高度は、ほかの全機と接近しないものだけを選ぶ (別の機体の高度へ押し込まないように)
    separate(game, list, a, b) {
      const moving = (x) => !x.ils && Math.abs(x.tAlt - x.alt) > 50;
      let order;
      if (moving(a) && !moving(b)) order = [[a, b]];
      else if (moving(b) && !moving(a)) order = [[b, a]];
      else order = a.kind === 'dep' ? [[b, a], [a, b]] : [[a, b], [b, a]];   // 到着機を先に動かす
      for (const [m, o] of order) {
        if (m.ils) continue;
        const climbing = m.tAlt > m.alt + 50, descending = m.tAlt < m.alt - 50;
        const cands = [
          m.alt <= o.alt ? roundDown(o.alt - 1000) : roundUp(o.alt + 1000),
          climbing ? roundDown(m.alt) : descending ? roundUp(m.alt) : null,   // その場で止める
          roundUp(m.alt + 1000), roundDown(m.alt - 1000), roundUp(m.alt + 2000), roundDown(m.alt - 2000),
        ].filter((v) => v != null && v >= 2000 && v <= 24000)
          // 出発機は降ろさない (上昇を止めるか、続けるだけ)
          .filter((v) => m.kind !== 'dep' || v >= roundDown(m.alt));
        const alt = cands.find((v) => this.safeAt(list, m, v));
        if (alt == null) continue;
        m.autoHoldUntil = game.time + LEVEL_HOLD;
        this.setAlt(game, m, alt);
        return;
      }
      // 高度で分けられなければ (相手が ILS 上で、こちらも上げ下げできないなど) 旋回で離す。
      // 相手から遠ざかる方位とその ±45° のうち、ほかの全機と接近しないもの
      for (const [m, o] of order) {
        if (m.ils || m.state !== 'air') continue;
        const away = G.bearing(o, m);
        const hdg = [0, 45, -45, 90, -90].map((k) => Math.round(G.norm360(away + k)))
          .find((h) => list.every((x) => x === m || !this.conflict({ ...m, hdg: h }, x)));
        if (hdg == null) continue;
        // すでにほぼその方位へ旋回中なら指示し直さない
        if (this.held(game, m) && !m.directs.length && Math.abs(G.angleDiff(m.tHdg, hdg)) < 20) return;
        m.autoVec = null;
        m.autoHoldUntil = game.time + LEVEL_HOLD;
        this.cmd(game, m, `H ${String(hdg).padStart(3, '0')}`);
        return;
      }
    }
  }

  ATC.Auto = Auto;
})(window.ATC);

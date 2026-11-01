// コンピュータ管制: プレイヤーの代わりに 2 秒ごとに状況を見て、普通のコマンドで指示を出す
//   出発: 滑走路ごとに間隔をあけて離陸させ、出口高度まで上昇、出口 Fix へ向かわせる
//   到着: 前の機体と十分な間隔が取れるときだけ進入許可。取れなければ STAR の終点で待機 (高度を 1000ft ずつ積む)
//   間隔: 同じ滑走路で詰まったら後ろを減速。90 秒先までに接近しそうな組は、片方の上昇・降下を止めるか 1000ft 離す
window.ATC = window.ATC || {};
(function (ATC) {
  'use strict';
  const G = ATC.geo;
  const K = ATC.consts;

  const EVERY = 2;           // 判断する間隔(秒)
  const LEVEL_HOLD = 45;      // 衝突回避で止めた高度を保つ時間(秒)
  const ARR_SPACING = 10;     // 進入許可を出すときに必要な、前の機体との残り距離の差(NM)
  const CLEAR_WITHIN = 70;    // 滑走路までの残り距離がこれ以下になったら進入許可を考える(NM)
  const STACK_WITHIN = 60;    // 残り距離がこれ以下になったら待機用の高度へ降ろし始める(NM)
  const TRAIL_SLOW = 7;       // 同じ滑走路で前との差がこれより詰まったら減速(NM)
  const TOO_CLOSE = 3;        // これより詰まったら後ろの機体を復行させる(NM)
  const DEP_INTERVAL = 90;    // 同じ滑走路から続けて離陸させる間隔(秒)
  const STACK_BASE = 6000;    // 待機の一番下の高度
  const PREDICT = [0, 15, 30, 45, 60, 90];   // 接近を調べる先読み時間(秒)
  const CONFLICT_NM = 4.5;

  const roundDown = (v) => Math.floor(v / 100) * 100;
  const roundUp = (v) => Math.ceil(v / 100) * 100;

  class Auto {
    constructor() {
      this.timer = 0;
      this.lastTakeoff = {};
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
        if (game.runwayBusy(rw) || this.arrivalClose(game, air, rw)) continue;
        this.cmd(game, ac, `T C ${ac.exitAlt}`);
        if (ac.state === 'takeoff') this.lastTakeoff[rw.key] = game.time;
      }
      // 出発機と上空通過機: 出口 Fix へ向かわせ、出口の高度の条件に合わせる
      // (上限のある通過機は、出口の 60NM 手前から降ろす)
      for (const ac of air) {
        if (!ac.exit || ac.state !== 'air') continue;
        if (!ac.directs.includes(ac.exit)) this.cmd(game, ac, ac.exit.name);
        if (this.held(game, ac)) continue;
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
      const pts = ac.hold ? [ac.hold.fix] : ac.directs.filter((f) => !tailPts.includes(f));
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

      // まだ進入許可のない機体: 間隔が取れれば許可、取れなければ待機用の高度へ
      const waiting = arr.filter((a) => !a.ils && !a.approach)
        .map((ac) => { const rw = this.plannedRunway(game, ac); return { ac, rw, d: this.distToGo(game, ac, rw) }; })
        .sort((a, b) => a.d - b.d);
      // 待機用の高度は滑走路ごとに 1 機 1 段。一度決めた段は、下の段が空いた時だけ 1 段ずつ下げる
      // (順番を毎回並べ替えると、機体どうしが高度を入れ替えようとしてすれ違ってしまう)
      const used = {};
      for (const w of waiting) {
        if (w.ac.autoStack) (used[w.rw.key] = used[w.rw.key] || new Set()).add(w.ac.autoStack);
      }
      for (const w of waiting) {
        const { ac, rw, d } = w;
        // プレイヤーがレーダー誘導した機体は、まず経路の終点へ戻す
        if (!ac.directs.length && !ac.hold) {
          const last = ac.plan[ac.plan.length - 1];
          if (last && game.fixes[last.name]) this.cmd(game, ac, last.name);
        }
        const laneKey = this.laneKey(game, rw);
        const lane = lanes[laneKey] || [];
        // 近くに自分より低い、まだ許可のない到着機がいれば先に行かせる (待機の積み重ねを下から降ろす)
        const lowerFirst = waiting.some((o) => o.ac !== ac && o.ac.alt < ac.alt - 300 && G.dist(o.ac, ac) < 8);
        // 進入許可を出すと FAF の高度まで降りるので、その降下が安全な時だけ
        const descentSafe = this.safeAt(this.flying, ac, Math.min(ac.tAlt, game.clearedAltitude(ac, rw)));
        // 復行・進入中止の直後 (60秒) は許可を出し直さない
        const settled = ac.gaCooldown <= 0;
        if (d < CLEAR_WITHIN && settled && !lowerFirst && descentSafe && lane.every((o) => Math.abs(o.d - d) >= ARR_SPACING)) {
          this.cmd(game, ac, `ILS ${rw.id}`);
          if (ac.approach) {
            if (ac.autoStack) used[rw.key].delete(ac.autoStack);
            ac.autoStack = 0;
            lane.push({ ac, d });
            lane.sort((a, b) => a.d - b.d);
            lanes[laneKey] = lane;
          }
          continue;
        }
        if (d > STACK_WITHIN || this.held(game, ac)) continue;
        const set = used[rw.key] = used[rw.key] || new Set();
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

      // 同じ滑走路で前の機体に詰まったら減速、十分離れたら戻す
      for (const lane of Object.values(lanes)) {
        for (let i = 1; i < lane.length; i++) {
          const { ac, d } = lane[i];
          const gap = d - lane[i - 1].d;
          // 最後の手段: 詰まりすぎたら復行 (ILS 上) か進入許可の取り消し。列に並び直させる
          if (gap < TOO_CLOSE) {
            this.cmd(game, ac, 'GA');
            lane.splice(i, 1);
            i--;
            continue;
          }
          if (ac.ils) {
            if (gap < TRAIL_SLOW && ac.tSpd > 150) this.cmd(game, ac, 'S 150');
          } else if (gap < TRAIL_SLOW && ac.tSpd > 160) {
            this.cmd(game, ac, 'S 160');
          } else if (gap > TRAIL_SLOW + 4 && ac.tSpd < K.ILS_MAX_SPD) {
            this.cmd(game, ac, `S ${K.ILS_MAX_SPD}`);   // 進入中なので ILS に乗れる速さまで
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
    }
  }

  ATC.Auto = Auto;
})(window.ATC);

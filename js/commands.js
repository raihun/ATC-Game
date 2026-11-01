// コマンド入力の解析と実行
//   JAL123 L 30      左へ30°        JAL123 H 270   方位270へ(近い方へ旋回)
//   JAL123 LH 270    左旋回で270へ  JAL123 D 40    4000ftへ降下 (C/A も同様)
//   JAL123 S 210     速度210kt      JAL123 CREAM   CREAMへ直行 (複数並べると順に)
//   機体は飛行計画の経路を自動で飛ぶ。経路上の Fix へ直行させると、その先は計画どおりに戻る。
//   方位を指示するとレーダー誘導になり、経路上の Fix 名を指示すれば経路に復帰する。
//   JAL123 T         離陸許可       JAL123 GA      復行
//   JAL123 ILS 34L   進入許可 (滑走路を省くと予定の滑走路)。経路の残りを飛んでから自分でILSに乗る
//   JAL123 VIA A B C 経路をまるごと A-B-C に置き換える (元の経路とは合流させない)
// 便名は末尾の数字だけでも、選択中の機体なら省略しても可。"D40" のように詰めて書いてもよい。
window.ATC = window.ATC || {};
(function (ATC) {
  'use strict';
  const G = ATC.geo;

  const GLUED = /^(LH|RH|C|D|A|L|R|H|S|ILS)(\d+[LRC]?)$/;
  const RUNWAY = /^\d{2}[LRC]?$/;
  const KEYWORDS = new Set(['C', 'D', 'A', 'L', 'R', 'LH', 'RH', 'H', 'S', 'T', 'TO', 'GA', 'ILS', 'VIA']);

  const fmtHdg = (h) => String(Math.round(G.norm360(h)) || 360).padStart(3, '0');

  function tokenize(text) {
    const out = [];
    // "DARKS-SWAMP" のようなハイフン区切りの経路も受け付ける
    for (const raw of text.toUpperCase().trim().split(/[\s-]+/)) {
      if (!raw) continue;
      const m = raw.match(GLUED);
      if (m) out.push(m[1], m[2]); else out.push(raw);
    }
    return out;
  }

  function isCommandToken(game, tok) {
    const t = tok.toUpperCase();
    return KEYWORDS.has(t) || GLUED.test(t) || !!game.fixes[t];
  }

  // 便名の完全一致、なければ部分一致 (候補が1機だけのとき)
  function findAircraft(game, token) {
    const t = token.toUpperCase();
    const list = game.aircraft.filter((a) => !a.done);
    const exact = list.find((a) => a.cs === t);
    if (exact) return exact;
    if (t.length < 2) return null;
    const partial = list.filter((a) => a.cs.endsWith(t) || a.cs.startsWith(t));
    return partial.length === 1 ? partial[0] : null;
  }

  function parse(game, text, selected) {
    const toks = tokenize(text);
    if (!toks.length) return { error: null };

    let ac = game.aircraft.find((a) => !a.done && a.cs === toks[0]) || null;
    let i = 0;
    if (ac) i = 1;
    else if (selected && !selected.done && isCommandToken(game, toks[0])) ac = selected;
    else if ((ac = findAircraft(game, toks[0]))) i = 1;
    if (!ac) return { error: `「${toks[0]}」に該当する機体がありません` };

    const actions = [];
    const directs = [];
    let via = false;
    const num = (label) => {
      const n = Number(toks[i++]);
      if (!Number.isFinite(n)) throw new Error(`${label}の数値がありません`);
      return n;
    };
    try {
      while (i < toks.length) {
        const t = toks[i++];
        if (game.fixes[t]) { directs.push(game.fixes[t]); continue; }
        switch (t) {
          case 'C': case 'D': case 'A': {
            const n = num('高度');
            actions.push({ type: 'alt', value: n < 1000 ? n * 100 : n });
            break;
          }
          case 'L': case 'R':
            actions.push({ type: 'turn', dir: t === 'L' ? -1 : 1, deg: num('角度') });
            break;
          case 'LH': case 'RH': case 'H':
            actions.push({ type: 'hdg', dir: t === 'LH' ? -1 : t === 'RH' ? 1 : 0, value: num('方位') });
            break;
          case 'S':
            actions.push({ type: 'speed', value: num('速度') });
            break;
          case 'T': case 'TO':
            actions.push({ type: 'takeoff' });
            break;
          case 'GA':
            actions.push({ type: 'ga' });
            break;
          case 'ILS':
            actions.push({ type: 'app', rwy: RUNWAY.test(toks[i] || '') ? toks[i++] : null });
            break;
          case 'VIA':
            via = true;
            break;
          default:
            throw new Error(`「${t}」は不明なコマンドかFix名です`);
        }
      }
      if (via && !directs.length) throw new Error('VIA の後に経路の Fix を並べてください');
    } catch (e) {
      return { error: e.message, ac };
    }
    if (directs.length) actions.push({ type: via ? 'via' : 'direct', fixes: directs });
    return { ac, actions };
  }

  function leaveIls(ac) {
    if (!ac.ils) return;
    ac.ils = null;
    ac.gaCooldown = 20;
  }

  function applyOne(game, ac, act) {
    const unable = (why) => { game.emit(`${ac.cs} UNABLE, ${why}`, 'warn'); return null; };
    switch (act.type) {
      case 'alt': {
        if (ac.ils) return unable('ESTABLISHED ON ILS');
        const v = Math.max(2000, Math.min(24000, Math.round(act.value / 100) * 100));
        ac.tAlt = v;
        const a = ATC.fmtAlt(v);
        if (ac.state !== 'air') return `AFTER DEPARTURE CLIMB ${a}`;
        return v > ac.alt + 50 ? `CLIMB ${a}` : v < ac.alt - 50 ? `DESCEND ${a}` : `MAINTAIN ${a}`;
      }
      case 'turn':
      case 'hdg': {
        leaveIls(ac);
        ac.hold = null;
        ac.autoFinal = false;
        ac.initTurn = 0;
        ac.directs = [];
        ac.tHdg = G.norm360(act.type === 'turn' ? ac.hdg + act.dir * act.deg : act.value);
        ac.turnDir = act.dir;
        const h = fmtHdg(ac.tHdg);
        return act.dir < 0 ? `TURN LEFT HEADING ${h}` : act.dir > 0 ? `TURN RIGHT HEADING ${h}` : `FLY HEADING ${h}`;
      }
      case 'speed': {
        const K = ATC.consts;
        if (ac.ils) {
          // ILS 上では間隔調整用に 5NM までの速度を指示できる
          const v = Math.max(140, Math.min(K.ILS_MAX_SPD, Math.round(act.value / 10) * 10));
          ac.tSpd = v;
          return `SPEED ${v} UNTIL ${K.APP_SPD_UNTIL_NM} MILES`;
        }
        let v = Math.max(160, Math.min(300, Math.round(act.value / 10) * 10));
        ac.routeSpdLimit = Infinity;   // 速度を指示すると STAR の速度制限は解除
        const low = Math.max(ac.alt, ac.tAlt) < K.LOW_ALT;
        if (v > K.LOW_ALT_SPD && low) {
          game.emit(`${ac.cs} ${K.LOW_ALT}ft未満は${K.LOW_ALT_SPD}ktまで`, 'warn');
          v = K.LOW_ALT_SPD;
        }
        ac.tSpd = v;
        return v > K.LOW_ALT_SPD && ac.alt < K.LOW_ALT ? `SPEED ${v} ABOVE ${K.LOW_ALT}` : `SPEED ${v}`;
      }
      case 'direct': {
        // 経路上の Fix を順に指定しただけならショートカット。それ以外は経路の付け替え (リルート) で、
        // 最後の Fix が元の経路上にあればそこから先は元の経路に合流する
        leaveIls(ac);
        const given = act.fixes;
        const k = ac.plan.indexOf(given[given.length - 1]);
        const rest = k >= 0 ? ac.plan.slice(k + 1) : [];
        const idx = given.map((f) => ac.plan.indexOf(f));
        const shortcut = idx.every((v, j) => v >= 0 && (j === 0 || v > idx[j - 1]));
        if (!shortcut) {
          ac.plan = [...given, ...rest];
          // 出発機は出口 Fix まで行かないとハンドオフできないので、経路の最後に足しておく
          if (ac.exit && !ac.plan.includes(ac.exit)) ac.plan.push(ac.exit);
        }
        const ahead = shortcut ? [...given, ...rest] : ac.plan.slice();
        ac.hold = null;
        ac.autoFinal = false;
        ac.initTurn = 0;
        ac.directs = [...ahead, ...(ac.approach ? game.approachTail(ac.approach, ahead[ahead.length - 1]) : [])];
        ac.turnDir = 0;
        const names = (fs) => fs.map((f) => f.name).join('-');
        if (!shortcut) return ac.plan.length === 1 ? `DIRECT ${names(ac.plan)}` : `CLEARED VIA ${names(ac.plan)}`;
        return rest.length ? `DIRECT ${names(given)}, THEN ${names(rest)}` : `DIRECT ${names(given)}`;
      }
      case 'via': {
        // 経路をまるごと置き換える。出発機は出口 Fix まで行けるよう最後に足す
        leaveIls(ac);
        ac.plan = act.fixes.slice();
        if (ac.exit && !ac.plan.includes(ac.exit)) ac.plan.push(ac.exit);
        ac.hold = null;
        ac.autoFinal = false;
        ac.initTurn = 0;
        ac.directs = [...ac.plan, ...(ac.approach ? game.approachTail(ac.approach, ac.plan[ac.plan.length - 1]) : [])];
        ac.turnDir = 0;
        return `CLEARED VIA ${ac.plan.map((f) => f.name).join('-')}`;
      }
      case 'takeoff':
        if (ac.state !== 'waiting') return unable('ALREADY ROLLING');
        if (game.runwayBusy(ac.rwy)) {
          game.emit(`${ac.cs} HOLDING SHORT RWY ${ac.rwy.id} (滑走路使用中)`, 'warn');
          return null;
        }
        ac.state = 'takeoff';
        return `CLEARED FOR TAKEOFF RWY ${ac.rwy.id}`;
      case 'app': {
        if (ac.kind !== 'arr') return unable('NOT AN ARRIVAL');
        if (ac.ils) return unable('ALREADY ESTABLISHED');
        const active = game.activeArrivalRunways(ac.dest);
        const rw = act.rwy
          ? active.find((r) => r.id === act.rwy)
          : active.find((r) => r.id === ac.plannedRwy) || active[0];
        if (!rw) return unable(`RWY ${act.rwy} NOT IN USE`);
        // 経路を飛んでいる・待機中なら経路の残りから最終進入へ。レーダー誘導中なら今の方位のまま会合する
        const following = ac.directs.filter((f) => !/ (FAF|BASE)$/.test(f.name));
        if (ac.hold || following.length) {
          const from = following[following.length - 1] || ac.hold.fix;
          ac.directs = [...following, ...game.approachTail(rw, from)];
          ac.autoFinal = !ac.directs.length;
          ac.finalPhase = null;
        }
        ac.hold = null;
        ac.approach = rw;
        ac.tAlt = Math.min(ac.tAlt, game.fafAltitude(rw));
        return `CLEARED ILS RWY ${rw.id} APPROACH`;
      }
      case 'ga':
        if (!ac.ils && ac.approach) {
          // まだ ILS に乗っていなければ進入許可の取り消し。今の方位のまま飛ぶ
          ac.approach = null;
          ac.autoFinal = false;
          ac.directs = [];
          ac.tHdg = ac.hdg;
          ac.turnDir = 0;
          return 'APPROACH CANCELLED, MAINTAIN PRESENT HEADING';
        }
        if (!ac.ils) return unable('NOT ON APPROACH');
        game.goAround(ac);
        return `GOING AROUND, CLIMB ${ATC.fmtAlt(ac.tAlt)}`;
    }
    return null;
  }

  // 戻り値: { ac, error }
  function run(game, text, selected) {
    const res = parse(game, text, selected);
    if (res.error || !res.ac) return res;
    const parts = [];
    for (const act of res.actions) {
      const r = applyOne(game, res.ac, act);
      if (r) parts.push(r);
    }
    if (parts.length) game.emit(`${res.ac.cs} ${parts.join(', ')}`, 'readback');
    game.refreshTargets(res.ac);
    return { ac: res.ac };
  }

  ATC.commands = { run, findAircraft, isCommandToken, fmtHdg };
})(window.ATC);

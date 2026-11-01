// 画面まわり: タイトル、上部バー、入力、機体パネル、ストリップ、ゲームループ
window.ATC = window.ATC || {};
(function (ATC) {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const STEP = 0.25;              // シミュレーションの刻み(秒)
  const START_CLOCK = 7 * 3600;   // ゲーム内時計は 07:00 から

  const PRESETS = {
    easy: { label: 'やさしい', max: 4, interval: 120 },
    normal: { label: 'ふつう', max: 7, interval: 80 },
    hard: { label: 'むずかしい', max: 10, interval: 55 },
    expert: { label: '上級', max: 14, interval: 40 },
  };
  // マップに実際の混み具合 (peak) があれば「実際のピーク」も選べる。最大機数のスライダーもそこまで広げる
  const SLIDER_MAX = 30;
  function presetsFor(map) {
    if (!map || !map.peak) return PRESETS;
    return { ...PRESETS, peak: { label: '実際のピーク', max: map.peak.max, interval: map.peak.interval } };
  }
  // 地域ごとのマップ。データ (js/data/*.js) がないものは「準備中」
  const MAPS = [
    { id: 'kanto', label: '関東' },
    { id: 'chubu', label: '中部' },
    { id: 'kansai', label: '関西' },
    { id: 'okayama', label: '中国・四国' },
  ];

  const MODALS = ['#start', '#menu', '#result', '#settings'];
  const ROUTE_MODES =[['selected', '経路: 選択機'], ['all', '経路: 全部'], ['off', '経路: なし']];
  const SAVE_KEY = 'atc.save';
  const SAVE_EVERY = 2;           // 自動保存の間隔(秒)
  const FIX_PRIORITY_PX = 9;      // 操作リングの上でも、Fix の記号からこの距離ならFixのクリックとみなす

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても遊べる */ } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* 同上 */ } },
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clock = (sec) => {
    const t = Math.floor(sec) % 86400;
    return [t / 3600, (t % 3600) / 60, t % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':');
  };

  class App {
    constructor() {
      this.canvas = $('#radar');
      this.input = $('#cmd');
      this.game = null;
      this.renderer = null;
      this.selected = null;
      this.speed = 1;
      this.acc = 0;
      this.last = performance.now();
      this.routeMode = 'selected';
      this.logVersion = -1;
      this.uiTimer = 0;
      this.panelKey = null;
      this.overTimer = 0;
      this.resultShown = false;

      let saved = {};
      try { saved = JSON.parse(store.get('atc.settings') || '{}'); } catch (e) { saved = {}; }
      this.settings = Object.assign({ map: 'kanto', config: 'north', preset: 'normal', max: 7, interval: 80 }, saved);
      let prefs = {};
      try { prefs = JSON.parse(store.get('atc.prefs') || '{}'); } catch (e) { prefs = {}; }
      this.prefs = Object.assign({ altView: 'standard', relAlt: true }, prefs);

      this.bindTopbar();
      this.bindInput();
      this.bindCanvas();
      this.bindPanels();
      this.bindSettings();
      this.buildStart();
      this.resume();
      window.addEventListener('resize', () => this.renderer && this.renderer.resize());
      window.addEventListener('pagehide', () => { if ($('#start').classList.contains('hidden')) this.save(); });
      requestAnimationFrame((t) => this.frame(t));
    }

    // ---- タイトル画面 -------------------------------------------------

    buildStart() {
      const s = this.settings;
      const render = () => {
        $('#opt-map').innerHTML = MAPS.map((m) => {
          const data = ATC.maps[m.id];
          return `<button data-map="${m.id}" class="${s.map === m.id ? 'on' : ''}" ${data ? '' : 'disabled'}>
            ${m.label}<small>${data ? esc(data.subtitle) : '準備中'}</small></button>`;
        }).join('');
        // 滑走路運用の選択肢はマップごとに違う (関東は北風/南風、岡山は東風/西風)
        const map = ATC.maps[s.map];
        const configs = [...Object.entries(map.configs).map(([id, c]) => ({ id, label: c.name, sub: c.when, note: c.note })),
          { id: 'random', label: 'ランダム', sub: '毎回どれか', note: '上のどれかを毎回ランダムに選びます。' }];
        if (!configs.some((c) => c.id === s.config)) s.config = configs[0].id;
        $('#opt-config').innerHTML = configs.map((c) =>
          `<button data-config="${c.id}" class="${s.config === c.id ? 'on' : ''}">${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</button>`).join('');
        const cur = configs.find((c) => c.id === s.config);
        $('#config-note').textContent = (cur && cur.note) || '';
        const presets = presetsFor(map);
        if (!presets[s.preset] && s.preset !== 'custom') s.preset = 'normal';
        const maxLimit = Math.max(SLIDER_MAX, map.peak ? map.peak.max : 0);
        $('#opt-max').max = maxLimit;
        s.max = Math.min(s.max, maxLimit);
        $('#opt-preset').innerHTML = Object.entries(presets).map(([id, p]) =>
          `<button data-preset="${id}" class="${s.preset === id ? 'on' : ''}">${p.label}<small>最大${p.max}機 / ${p.interval}秒</small></button>`
        ).join('') + `<button data-preset="custom" class="${s.preset === 'custom' ? 'on' : ''}">カスタム<small>下で調整</small></button>`;
        $('#opt-max').value = s.max;
        $('#opt-interval').value = s.interval;
        $('#v-max').textContent = `${s.max}機`;
        $('#v-interval').textContent = `${s.interval}秒`;
        const hi = store.get(this.hiKey());
        $('#hiscore').textContent = hi ? `この設定のハイスコア: ${hi}` : '';
      };
      this.renderStart = render;

      $('#start').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.map) s.map = b.dataset.map;
        if (b.dataset.config) s.config = b.dataset.config;
        if (b.dataset.preset) {
          s.preset = b.dataset.preset;
          const p = presetsFor(ATC.maps[s.map])[s.preset];
          if (p) Object.assign(s, { max: p.max, interval: p.interval });
        }
        render();
      });
      const onSlider = () => {
        s.max = Number($('#opt-max').value);
        s.interval = Number($('#opt-interval').value);
        const match = Object.entries(presetsFor(ATC.maps[s.map])).find(([, p]) => p.max === s.max && p.interval === s.interval);
        s.preset = match ? match[0] : 'custom';
        render();
      };
      $('#opt-max').addEventListener('input', onSlider);
      $('#opt-interval').addEventListener('input', onSlider);
      $('#btn-start').addEventListener('click', () => this.start());
      render();
    }

    hiKey() {
      const s = this.settings;
      const diff = s.preset === 'custom' ? `custom-${s.max}-${s.interval}` : s.preset;
      return `atc.hi.${s.map}.${diff}`;
    }

    start() {
      const s = this.settings;
      store.set('atc.settings', JSON.stringify(s));
      const map = ATC.maps[s.map];
      const configIds = Object.keys(map.configs);
      const configId = s.config === 'random' || !map.configs[s.config]
        ? configIds[Math.floor(Math.random() * configIds.length)] : s.config;
      let game;
      try {
        game = new ATC.Game(map, { configId, maxAircraft: s.max, interval: s.interval });
      } catch (e) {
        alert('マップデータの読み込みに失敗しました:\n' + e.message);
        return;
      }
      this.attach(game);
      this.setSpeed(1);
      this.save();
    }

    attach(game) {
      this.game = game;
      this.renderer = new ATC.Renderer(this.canvas, game);
      this.selected = null;
      this.panelKey = null;
      this.logVersion = -1;
      this.overTimer = 0;
      this.resultShown = false;
      this.acc = 0;
      this.saveTimer = SAVE_EVERY;
      this.auto = new ATC.Auto();
      this.setAuto(false, true);
      this.showModal(null);
      this.input.value = '';
      this.input.focus();
    }

    // ---- 自動保存 (F5 などで再読み込みしても続きから) --------------------

    save() {
      const g = this.game;
      if (!g || g.over) return;
      const v = this.renderer.view;
      store.set(SAVE_KEY, JSON.stringify({
        game: g.snapshot(),
        ui: {
          view: { cx: v.cx, cy: v.cy, scale: v.scale },
          speed: this.speed || this.resumeSpeed || 1,
          routeMode: this.routeMode,
          selected: this.selected && this.selected.cs,
          auto: this.autoOn,
        },
      }));
    }

    clearSave() { store.remove(SAVE_KEY); }

    // 保存があれば一時停止した状態で再開する。マップデータが変わって読めなければ捨てる
    resume() {
      let data;
      try { data = JSON.parse(store.get(SAVE_KEY) || 'null'); } catch (e) { data = null; }
      if (!data || !data.game || !ATC.maps[data.game.map]) return false;
      let game;
      try {
        game = ATC.Game.restore(ATC.maps[data.game.map], data.game);
      } catch (e) {
        console.warn('保存データを復元できませんでした', e);
        this.clearSave();
        return false;
      }
      this.attach(game);
      const ui = data.ui || {};
      if (ui.view) Object.assign(this.renderer.view, ui.view);
      if (ui.routeMode) this.setRouteMode(ui.routeMode);
      if (ui.auto) this.setAuto(true, true);
      this.select(game.aircraft.find((a) => a.cs === ui.selected) || null);
      this.resumeSpeed = ui.speed || 1;
      this.speed = this.resumeSpeed;
      this.setSpeed(0);
      game.emit('前回の続きから再開しました (一時停止中。Space で再開)', 'sys');
      return true;
    }

    showModal(id) {
      for (const m of MODALS) $(m).classList.toggle('hidden', m !== id);
      if (id === '#start') this.renderStart();
      if (id === '#settings') this.renderSettings();
    }

    modalOpen() { return MODALS.some((m) => !$(m).classList.contains('hidden')); }

    // ---- 設定ダイアログ ------------------------------------------------

    bindSettings() {
      const open = () => { if (this.game && !this.game.over) this.showModal('#settings'); };
      $('#btn-settings').addEventListener('click', open);
      $('#btn-auto').addEventListener('click', open);
      $('#set-close').addEventListener('click', () => { this.showModal(null); this.input.focus(); });
      $('#settings').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.auto) this.setAuto(b.dataset.auto === 'on');
        if (b.dataset.altview) this.setPref('altView', b.dataset.altview);
        this.renderSettings();
      });
      $('#set-relalt').addEventListener('change', (e) => this.setPref('relAlt', e.target.checked));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('#settings').classList.contains('hidden')) { this.showModal(null); this.input.focus(); }
      });
    }

    renderSettings() {
      for (const b of document.querySelectorAll('#set-auto button')) b.classList.toggle('on', (b.dataset.auto === 'on') === this.autoOn);
      for (const b of document.querySelectorAll('#set-altview button')) b.classList.toggle('on', b.dataset.altview === this.prefs.altView);
      $('#set-relalt').checked = this.prefs.relAlt;
    }

    // 表示の好みはゲームをまたいで保存する
    setPref(key, value) {
      this.prefs[key] = value;
      store.set('atc.prefs', JSON.stringify(this.prefs));
    }

    // ---- 上部バー・メニュー ------------------------------------------

    bindTopbar() {
      document.querySelectorAll('[data-speed]').forEach((b) =>
        b.addEventListener('click', () => { this.setSpeed(Number(b.dataset.speed)); this.input.focus(); }));
      $('#btn-help').addEventListener('click', () => {
        $('#help').classList.toggle('hidden');
        $('#btn-help').classList.toggle('on', !$('#help').classList.contains('hidden'));
        this.input.focus();
      });
      // 狭い画面では地図が隠れるので最初は閉じておく
      const showHelp = window.innerWidth >= 1300;
      $('#help').classList.toggle('hidden', !showHelp);
      $('#btn-help').classList.toggle('on', showHelp);
      $('#btn-routes').addEventListener('click', () => {
        const i = (ROUTE_MODES.findIndex(([m]) => m === this.routeMode) + 1) % ROUTE_MODES.length;
        this.setRouteMode(ROUTE_MODES[i][0]);
        this.input.focus();
      });
      $('#btn-fit').addEventListener('click', () => { if (this.renderer) this.renderer.fit(); this.input.focus(); });
      $('#btn-menu').addEventListener('click', () => { if (this.game) this.showModal('#menu'); });

      $('#m-resume').addEventListener('click', () => { this.showModal(null); this.input.focus(); });
      $('#m-finish').addEventListener('click', () => {
        if (!this.game.over) this.game.gameOver('manual');
        this.showResult();
      });
      $('#m-title').addEventListener('click', () => { this.clearSave(); this.showModal('#start'); });
      $('#r-retry').addEventListener('click', () => this.start());
      $('#r-title-btn').addEventListener('click', () => this.showModal('#start'));
    }

    // コンピュータ管制の切り替え。一度でも使ったゲームはハイスコアの対象外
    setAuto(on, quiet) {
      const changed = this.autoOn !== on;
      this.autoOn = on;
      $('#btn-auto').classList.toggle('hidden', !on);   // AUTO 中だけ上部に表示 (押すと設定を開く)
      if (!this.game || quiet || !changed) return;
      if (on) this.game.autoUsed = true;
      this.game.emit(on ? 'コンピュータ管制を開始しました (このゲームはハイスコア対象外)' : 'コンピュータ管制を終了しました', 'sys');
    }

    setRouteMode(mode) {
      const m = ROUTE_MODES.find(([id]) => id === mode) || ROUTE_MODES[0];
      this.routeMode = m[0];
      $('#btn-routes').textContent = m[1];
    }

    setSpeed(s) {
      if (s === 0 && this.speed !== 0) this.resumeSpeed = this.speed;
      this.speed = s;
      document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === s));
      $('#pause-banner').classList.toggle('hidden', s !== 0 || !this.game);
    }

    togglePause() { this.setSpeed(this.speed === 0 ? (this.resumeSpeed || 1) : 0); }

    // ---- コマンド入力 ---------------------------------------------------

    bindInput() {
      const inp = this.input;
      inp.addEventListener('keydown', (e) => {
        if (!this.game) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          if (this.draft && !inp.value.trim()) this.confirmDraft();
          else this.submit();
        } else if (e.key === 'Escape') {
          inp.value = '';
          if (this.draft) this.cancelDraft(); else this.select(null);
        } else if (e.key === 'Backspace' && this.draft && !inp.value) {
          e.preventDefault();
          this.undoDraft();
        }
        else if (e.key === ' ' && inp.value.trim() === '') { e.preventDefault(); this.togglePause(); }
        else if (e.key === 'Tab') { e.preventDefault(); this.cycleSelection(e.shiftKey ? -1 : 1); }
      });
      // 便名を打ち始めたらその機体を選択表示する
      inp.addEventListener('input', () => {
        if (!this.game) return;
        const tok = inp.value.trim().split(/\s+/)[0] || '';
        if (tok.length < 2 || ATC.commands.isCommandToken(this.game, tok)) return;
        const ac = ATC.commands.findAircraft(this.game, tok);
        if (ac) this.select(ac);
      });
      document.addEventListener('keydown', (e) => {
        if (this.modalOpen() || e.target === inp || e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key === ' ') { e.preventDefault(); this.togglePause(); return; }
        if (e.key.length === 1) inp.focus();
      });
    }

    send(text) {
      if (!this.game || this.game.over) return null;
      const res = ATC.commands.run(this.game, text, this.selected);
      if (res.error) this.game.emit(res.error, 'warn');
      else if (res.ac) this.select(res.ac);
      this.refreshUI();
      return res;
    }

    submit() {
      const text = this.input.value;
      if (!text.trim()) return;
      const res = this.send(text);
      if (res && !res.error) this.input.value = '';
    }

    select(ac) {
      if (this.selected !== ac) this.panelKey = null;
      if (this.draft && this.draft.ac !== ac) this.draft = null;   // 別の機体を選んだら下書きは破棄
      this.selected = ac;
    }

    cycleSelection(dir) {
      const list = this.sortedAircraft();
      if (!list.length) return;
      const i = list.indexOf(this.selected);
      this.select(list[(i + dir + list.length) % list.length]);
      this.input.value = '';
    }

    // ---- マウス ---------------------------------------------------------

    bindCanvas() {
      const c = this.canvas;
      // 操作リング上で押したら、地図は動かさず離した位置の値で指示する。
      // ただしリングに重なった他の機体 (アイコン・ラベル) と Fix の記号のクリックを優先する
      const onWidget = (x, y) => {
        if (!this.renderer || !this.selected) return null;
        const other = this.renderer.hitAircraft(x, y);
        if (other && other !== this.selected) return null;
        if (this.renderer.hitFix(x, y, FIX_PRIORITY_PX)) return null;
        return this.renderer.widgetHit(this.selected, x, y);
      };
      c.addEventListener('pointerdown', (e) => {
        const widget = e.button === 0 && !!onWidget(e.clientX, e.clientY);
        this.drag = { x: e.clientX, y: e.clientY, moved: false, button: e.button, widget };
        c.setPointerCapture(e.pointerId);
      });
      c.addEventListener('pointermove', (e) => {
        const d = this.drag;
        const widget = !!onWidget(e.clientX, e.clientY);
        this.hover = { x: e.clientX, y: e.clientY, shift: e.shiftKey, widget };
        c.style.cursor = (d && d.widget) || (!d && widget) ? 'pointer' : '';
        if (!d || d.widget || !this.renderer) return;
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
        if (!d.moved) { d.moved = true; d.lx = d.x; d.ly = d.y; }
        this.renderer.panBy(e.clientX - d.lx, e.clientY - d.ly);
        d.lx = e.clientX; d.ly = e.clientY;
      });
      c.addEventListener('pointerleave', () => { this.hover = null; });
      c.addEventListener('pointerup', (e) => {
        const d = this.drag;
        this.drag = null;
        if (d && d.widget) {
          const w = onWidget(e.clientX, e.clientY);
          if (w) this.commitWidget(w, e.shiftKey);
        } else if (d && !d.moved && d.button === 0) {
          this.clickMap(e.clientX, e.clientY, e.shiftKey);
        }
        this.input.focus();
      });
      c.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const ac = this.selected;
        if (!ac || !this.renderer) return;
        const w = this.renderer.toWorld(e.clientX, e.clientY);
        const hdg = Math.round(ATC.geo.bearing(ac, w) / 5) * 5;
        this.send(`${ac.cs} H ${hdg || 360}`);
      });
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (this.renderer) this.renderer.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      }, { passive: false });
    }

    // 方位は近い方へ旋回 (Shift で遠回り)。ログには LH/RH として残る
    commitWidget(w, reverse) {
      const ac = this.selected;
      if (w.type === 'hdg') {
        let d = ATC.geo.angleDiff(ac.hdg, w.value);
        if (reverse) d = d > 0 ? d - 360 : d + 360;
        if (Math.abs(d) < 1) return;
        this.send(`${ac.cs} ${d < 0 ? 'LH' : 'RH'} ${w.value}`);
      } else {
        this.send(`${ac.cs} ${w.type === 'alt' ? 'A' : 'S'} ${w.value}`);
      }
    }

    clickMap(sx, sy, shift) {
      if (!this.renderer) return;
      const ac = this.renderer.hitAircraft(sx, sy);
      if (ac) { this.select(ac); this.input.value = ''; return; }
      const fix = this.renderer.hitFix(sx, sy);
      const sel = this.selected;
      if (fix && sel) {
        // 経路を組み立て中、または Shift+クリックなら新しい経路に足す。それ以外は直行
        if (this.draft || shift) this.addToDraft(fix);
        else this.send(`${sel.cs} ${fix.name}`);
        return;
      }
      if (!this.draft) this.select(null);
    }

    // ---- 経路の組み直し ------------------------------------------------
    // 元の経路はそのままにして新しい経路を下書きし、確定したときに VIA でまるごと置き換える

    startDraft() {
      if (!this.selected) return;
      this.draft = { ac: this.selected, fixes: [] };
      this.panelKey = null;
    }

    addToDraft(fix) {
      if (!this.draft || this.draft.ac !== this.selected) this.startDraft();
      const list = this.draft.fixes;
      if (list[list.length - 1] !== fix) list.push(fix);
      this.panelKey = null;
    }

    undoDraft() {
      if (!this.draft) return;
      this.draft.fixes.pop();
      this.panelKey = null;
    }

    cancelDraft() {
      this.draft = null;
      this.panelKey = null;
    }

    confirmDraft() {
      const d = this.draft;
      if (!d || !d.fixes.length) return;
      this.cancelDraft();
      this.send(`${d.ac.cs} VIA ${d.fixes.map((f) => f.name).join(' ')}`);
    }

    // ---- パネル・ストリップ ------------------------------------------

    bindPanels() {
      $('#strips').addEventListener('pointerdown', (e) => {
        const row = e.target.closest('.strip');
        if (!row || !this.game) return;
        e.preventDefault();
        const ac = this.game.aircraft.find((a) => a.cs === row.dataset.cs);
        if (!ac) return;
        if (e.target.closest('button')) this.send(`${ac.cs} T`);
        else this.select(ac);
        this.input.focus();
      });
      $('#acpanel').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        const ac = this.selected;
        if (!b || !ac) return;
        const act = b.dataset.act;
        if (act === 'draft') this.startDraft();
        else if (act === 'draft-ok') this.confirmDraft();
        else if (act === 'draft-undo') this.undoDraft();
        else if (act === 'draft-cancel') this.cancelDraft();
        else if (b.dataset.alt) {
          const v = Math.max(2000, Math.round(ac.tAlt / 1000) * 1000 + Number(b.dataset.alt));
          this.send(`${ac.cs} A ${v}`);
        } else if (b.dataset.cmd) {
          this.send(`${ac.cs} ${b.dataset.cmd}`);
        }
        this.input.focus();
      });
    }

    sortedAircraft() {
      const order = (a) => (a.state === 'waiting' ? 0 : { dep: 1, arr: 2, ovf: 3 }[a.kind]);
      return this.game.aircraft.slice().sort((a, b) => order(a) - order(b) || a.cs.localeCompare(b.cs));
    }

    statusText(ac) {
      const g = this.game;
      if (ac.state === 'waiting') return `離陸待ち RWY${ac.rwy.id}  ${clock(ac.waitTime).slice(3)}`;
      if (ac.state === 'takeoff') return `離陸滑走中 RWY${ac.rwy.id}`;
      const alt = `${Math.round(ac.alt / 100) * 100}ft ${Math.round(ac.spd)}kt`;
      if (ac.ils) return `${ac.ils.app.lda ? 'LDA' : 'ILS'} ${ac.ils.id} 進入中  ${alt}`;
      if (ac.hold) return `${ac.hold.fix.name} で待機中  ${alt}`;
      if (ac.approach) return `進入許可 ${ac.approach.id}  ${alt}`;
      if (ac.exit) return `${alt}  出口まで ${ATC.geo.dist(ac, ac.exit).toFixed(0)}NM`;
      const apt = g.airports[ac.dest];
      return `${alt}  ${apt.short}まで ${ATC.geo.dist(ac, apt).toFixed(0)}NM`;
    }

    renderStrips() {
      const g = this.game;
      $('#strips').innerHTML = this.sortedAircraft().map((ac) => {
        const route = ac.kind === 'arr' ? `${ac.entry}→${g.airports[ac.dest].short}`
          : ac.kind === 'ovf' ? `通過 →${ac.exit.name}`
          : `${g.airports[ac.origin].short}→${ac.exit.name}`;
        const cls = ['strip', ac.kind, ac === this.selected ? 'sel' : '', ac.alert || ''].join(' ');
        const att = g.attention(ac);
        const badge = att ? `<b class="att l${att.level}" title="${esc(att.text)}">${att.level > 1 ? '!!' : '!'}</b>` : '';
        const note = att ? `<span class="why l${att.level}">${esc(att.text)}</span>` : '';
        return `<div class="${cls}" data-cs="${ac.cs}">
          <span class="cs">${badge}${ac.cs}</span><span class="type">${ac.type}</span><span class="route">${route}</span>
          ${ac.state === 'waiting' ? '<button>離陸</button>' : ''}
          <span class="st">${esc(this.statusText(ac))}${note}</span></div>`;
      }).join('');
    }

    renderPanel() {
      const ac = this.selected, el = $('#acpanel');
      if (!ac || !this.game) { el.classList.add('hidden'); this.panelKey = null; return; }
      el.classList.remove('hidden');
      const key = [ac.cs, ac.state, !!ac.ils, !!ac.hold, ac.approach && ac.approach.id,
        ac.directs[0] && ac.directs[0].name, ac.plan.map((f) => f.name).join('-'),
        this.draft ? 'draft:' + this.draft.fixes.map((f) => f.name).join('-') : ''].join('|');
      if (key !== this.panelKey) {
        this.panelKey = key;
        el.innerHTML = this.panelHtml(ac);
      }
      const pv = el.querySelector('.pv');
      const fmtH = ATC.commands.fmtHdg;
      let nav = ac.hold ? `${ac.hold.fix.name} でホールディング中`
        : ac.directs.length ? `経路 ${ac.directs.map((f) => f.name).join('→')}`
        : `方位 ${fmtH(ac.hdg)} → ${fmtH(ac.tHdg)} (レーダー誘導)`;
      if (ac.approach && !ac.ils) nav += `\n進入許可 ${ac.approach.app.lda ? 'LDA' : 'ILS'} ${ac.approach.id}`;
      // 指示中の高度・速度のボタンに青い枠
      for (const b of el.querySelectorAll('button[data-cmd]')) {
        const m = b.dataset.cmd.match(/^([AS]) (\d+)$/);
        if (m) b.classList.toggle('cur', Number(m[2]) === (m[1] === 'A' ? ac.tAlt : ac.tSpd));
      }
      pv.textContent = `高度 ${String(Math.round(ac.alt)).padStart(5)} → ${ac.tAlt}ft\n` +
        `速度 ${String(Math.round(ac.spd)).padStart(5)} → ${Math.round(ac.spdTarget || ac.tSpd)}kt${this.speedNote(ac)}\n${nav}`;
    }

    // 指示速度より遅くしている理由
    speedNote(ac) {
      const K = ATC.consts;
      const t = ac.spdTarget || ac.tSpd;
      if (ac.state !== 'air' || t >= ac.tSpd) return '';
      if (ac.ils) return '  (進入速度)';
      if (ac.hold && t === K.HOLD_SPD) return '  (待機中の制限)';
      if (t === ac.routeSpdLimit) return '  (STARの制限)';
      if (t === K.LOW_ALT_SPD && ac.alt < K.LOW_ALT) return `  (${K.LOW_ALT}ft未満)`;
      if (ac.approach && t === K.ILS_MAX_SPD) return '  (進入のため減速)';
      return '';
    }

    panelHtml(ac) {
      const g = this.game;
      const btns = (items) => items.map(([label, cmd, extra]) =>
        `<button ${cmd.startsWith('alt:') ? `data-alt="${cmd.slice(4)}"` : `data-cmd="${cmd}"`} ${extra || ''}>${label}</button>`).join('');
      const desc = ac.kind === 'arr' ? `${ac.type}  ${ac.entry} → ${g.airports[ac.dest].name}`
        : ac.kind === 'ovf' ? `${ac.type}  上空通過 → ${ac.exit.name}`
        : `${ac.type}  ${g.airports[ac.origin].name} → ${ac.exit.name}`;
      let html = `<div class="ph"><b>${ac.cs}</b><span>${esc(desc)}</span></div><div class="pv"></div>`;

      if (ac.state === 'waiting') html += `<div class="row">${btns([['離陸許可 (T)', 'T', 'class="big"']])}</div>`;
      if (ac.ils) {
        html += `<div class="row">${btns([['復行 (GA)', 'GA', 'class="big"']])}</div>`;
        html += `<div class="row"><label>速度</label>${btns([150, 160, 170, 180, 190, 210].map((v) => [String(v), `S ${v}`]))}</div>`;
        html += `<div class="hint">ILSで最終進入中。速度の指示は5NMまで有効で、その後は進入速度へ減速します (3NMで170ktを超えていると復行)。方位や直行を指示するとILSから外れます。</div>`;
        return html;
      }
      // 巡航で抜けていく上空通過機は、進む方向に合った高度 (奇数/偶数) を並べる
      const alts = ac.parity
        ? Array.from({ length: 5 }, (_, k) => g.nearestExitAlt(ac, ac.exitAlt) + k * 2000)
        : [2000, 3000, 4000, 6000, 9000, 11000, 13000];
      html += `<div class="row"><label>高度</label>${btns([['-1000', 'alt:-1000'], ['+1000', 'alt:1000'],
        ...alts.map((v) => [ac.parity ? ATC.fmtAlt(v) : String(v / 1000) + 'k', `A ${v}`])])}</div>`;
      html += `<div class="row"><label>速度</label>${btns([160, 180, 210, 250, 280].map((v) => [String(v), `S ${v}`]))}</div>`;
      html += `<div class="row"><label>旋回</label>${btns([['L30', 'L 30'], ['L10', 'L 10'], ['R10', 'R 10'], ['R30', 'R 30']])}</div>`;
      // 飛行計画の経路。押すとその Fix へ直行し、先は計画どおり
      if (this.draft && this.draft.ac === ac) {
        const names = this.draft.fixes.map((f) => f.name);
        html += `<div class="draft"><div class="dh">新しい経路を組み立て中 — 地図の Fix を順にクリック</div>
          <div class="dl">${names.length ? esc(names.join(' → ')) : '(まだ Fix がありません)'}</div>
          <div class="row">
            <button data-act="draft-ok" class="big" ${names.length ? '' : 'disabled'}>確定 (Enter)</button>
            <button data-act="draft-undo" ${names.length ? '' : 'disabled'}>1つ戻す (BS)</button>
            <button data-act="draft-cancel">やめる (Esc)</button>
          </div>${ac.exit ? `<div class="hint">出口の ${ac.exit.name} を入れなかった場合は最後に自動で足します。</div>` : ''}</div>`;
      } else {
        const plan = ac.plan.filter((f) => g.fixes[f.name]);
        const cur = plan.indexOf(ac.directs[0]);
        html += `<div class="row"><label>経路</label>${plan.map((f, i) => {
          const cls = i === cur ? 'cur' : cur >= 0 && i < cur ? 'past' : '';
          return `<button data-cmd="${f.name}" class="${cls}">${f.name}</button>`;
        }).join('')}<button data-act="draft" class="rebuild">組み直す</button></div>`;
      }
      if (ac.kind === 'arr') {
        // 同じ入口から選べる標準到着経路 (STAR)。押すとその経路と滑走路に切り替える
        const stars = g.starOptions(ac);
        if (stars.length > 1) {
          html += `<div class="row"><label>標準経路</label>${stars.map((s) =>
            `<button data-cmd="STAR ${s.name}" class="${ac.entry === s.name ? 'cur' : ''}" title="${esc(s.route.join('-'))}">${s.name}<small> ${s.rwy}</small></button>`).join('')}</div>`;
        }
        html += `<div class="row"><label>進入</label>${g.activeArrivalRunways(ac.dest).map((rw) => {
          const kind = rw.app.lda ? 'LDA' : 'ILS';
          return `<button data-cmd="ILS ${rw.id}" class="${ac.approach === rw ? 'cur' : ''}">${kind} ${rw.id}</button>`;
        }).join('')}</div>`;
        html += `<div class="hint">黄色の扇形内で、進入コースに±60°以内の角度・目盛りの高度以下・210kt以下にすると自動でILS捕捉。<br>リング: 内側=方位 / 右=高度 / 左=速度　経路のFix: そこへ直行して先は経路どおり</div>`;
      } else {
        html += `<div class="hint">${esc(g.exitRangeText(ac))}通過させると次の管制へ引き継ぎ。<br>リング: 内側=方位 / 右=高度 / 左=速度　経路のFix: そこへ直行して先は経路どおり</div>`;
      }
      return html;
    }

    renderLog() {
      const g = this.game;
      if (g.logVersion === this.logVersion) return;
      this.logVersion = g.logVersion;
      $('#log').innerHTML = g.log.slice(-7).map((m) => `<div class="msg ${m.kind}">${esc(m.text)}</div>`).join('');
    }

    refreshUI() {
      const g = this.game;
      if (!g) return;
      $('#score').textContent = `SCORE ${g.score}`;
      $('#c-dep').textContent = g.stats.departed;
      $('#c-ovf').textContent = g.stats.passed || 0;
      $('#c-arr').textContent = g.stats.landed;
      $('#c-viol').textContent = g.stats.violations;
      $('#c-lost').textContent = g.stats.lost;
      $('#clock').textContent = clock(START_CLOCK + g.time);
      this.renderStrips();
      this.renderPanel();
      this.renderLog();
    }

    showResult() {
      const g = this.game;
      this.resultShown = true;
      this.clearSave();
      const key = this.hiKey();
      const prev = Number(store.get(key) || 0);
      const record = !g.autoUsed && g.score > prev;
      if (record) store.set(key, String(g.score));
      $('#r-title').textContent = g.over && g.over.reason === 'collision' ? '衝突発生' : '管制終了';
      const mins = Math.floor(g.time / 60);
      const best = g.autoUsed ? '  (コンピュータ管制あり・ハイスコア対象外)' : `  (最高 ${prev})`;
      $('#r-body').innerHTML = [
        `SCORE ${g.score}${record ? ' <span class="rec">ハイスコア更新!</span>' : best}`,
        `管制時間 ${mins}分`,
        `着陸 ${g.stats.landed} / ハンドオフ ${g.stats.departed} / 通過 ${g.stats.passed || 0}`,
        `間隔欠如 ${g.stats.violations} / 逸脱 ${g.stats.lost}`,
      ].join('<br>');
      this.showModal('#result');
    }

    // ---- ループ ---------------------------------------------------------

    frame(t) {
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      const g = this.game;
      if (g && !g.over && this.speed > 0 && !this.modalOpen()) {
        this.acc += dt * this.speed;
        while (this.acc >= STEP) {
          g.update(STEP);
          if (this.autoOn) this.auto.update(g, STEP);
          this.acc -= STEP;
        }
      }
      if (g && g.over && !this.resultShown) {
        this.overTimer += dt;
        if (this.overTimer > 1.8) this.showResult();
      }
      if (this.selected && this.selected.done) this.select(null);
      if (this.renderer) this.renderer.draw(this.selected, this.routeMode, t, this.hover, this.draft, this.prefs);
      this.uiTimer -= dt;
      if (this.uiTimer <= 0) { this.uiTimer = 0.2; this.refreshUI(); }
      this.saveTimer -= dt;
      // タイトル画面に戻った後は、捨てたゲームを保存し直さない
      if (this.saveTimer <= 0 && g && $('#start').classList.contains('hidden')) {
        this.saveTimer = SAVE_EVERY;
        this.save();
      }
      requestAnimationFrame((n) => this.frame(n));
    }
  }

  window.addEventListener('DOMContentLoaded', () => { ATC.app = new App(); });
})(window.ATC);

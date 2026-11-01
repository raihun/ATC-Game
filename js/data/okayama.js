// 岡山空港周辺マップデータ (中国・四国)
//
// AIP Japan (AIRAC 2026-01, yinlei.org 編集版) から取れたもの:
//   - 滑走路 07/25 (3000m, 標高 806ft)、ILS 07 の進入方位 066°(磁方位)
//   - 無線施設 KIBI VOR/DME (OYE)・OKAYAMA VORTAC (OKC) の座標
//   - SID: MIYAZU TWO / OTSU FIVE (OYE R-070 を東へ)、WASYU TWO (OKC R-256 を南西へ)、CHIZU TRANSITION
// 岡山の到着は関西アプローチのレーダー誘導が中心で、RNAV の STAR や Fix の座標表は資料にない。
// そのため次の点は AIP の方位・距離の記述や地名から「推定」して置いている:
//   CHIZU (OYE R-070 約40NM)、WASYU (OKC R-256 約35NM)、SAYOH・TAMBA (CHIZU TRANSITION の図から)、
//   有視界の位置通報点 KURASHIKI・TAKAHASHI・SANYO・EYOMI (地名の位置)
// 滑走路の向きは真方位 (ILS 066° - 偏差約7.5° = 058.5°)。
// 実際の運航には使えません。ゲーム用の参考データです。書式は kanto.js と同じです。
window.ATC = window.ATC || {};
ATC.maps = ATC.maps || {};

ATC.maps.okayama = {
  id: 'okayama',
  name: '岡山',
  subtitle: '岡山空港',
  bounds: { west: 132.75, east: 135.25, south: 33.95, north: 35.40 },

  land: [
    // 本州 (尾道 → 福山 → 倉敷 → 児島 → 岡山 → 牛窓 → 赤穂 → 姫路 → 明石 → 神戸)
    [
      [132.50, 34.25], [132.75, 34.30], [132.95, 34.35], [133.08, 34.40], [133.20, 34.41],
      [133.30, 34.45], [133.40, 34.48], [133.50, 34.50], [133.60, 34.50], [133.68, 34.50],
      [133.73, 34.47], [133.80, 34.45], [133.85, 34.47], [133.90, 34.50], [133.96, 34.57],
      [134.05, 34.60], [134.15, 34.62], [134.22, 34.68], [134.30, 34.73], [134.40, 34.74],
      [134.50, 34.76], [134.60, 34.77], [134.70, 34.76], [134.80, 34.72], [134.90, 34.66],
      [135.00, 34.65], [135.10, 34.66], [135.20, 34.69], [135.30, 34.70], [135.50, 34.70],
      [135.50, 35.80], [132.50, 35.80],
    ],
    // 四国 (今治 → 新居浜 → 観音寺 → 丸亀 → 坂出 → 高松 → 引田 → 鳴門)
    [
      [132.50, 33.85], [132.80, 33.98], [132.95, 34.08], [133.00, 34.07], [133.10, 33.98],
      [133.20, 33.93], [133.30, 33.96], [133.45, 33.98], [133.57, 34.00], [133.62, 34.08],
      [133.66, 34.15], [133.70, 34.22], [133.79, 34.29], [133.86, 34.32], [133.95, 34.35],
      [134.05, 34.35], [134.15, 34.33], [134.25, 34.30], [134.35, 34.25], [134.45, 34.21],
      [134.60, 34.20], [134.62, 34.10], [134.65, 34.00], [134.70, 33.80], [132.50, 33.80],
    ],
    // 小豆島
    [[134.13, 34.50], [134.20, 34.54], [134.30, 34.56], [134.37, 34.52], [134.33, 34.46], [134.22, 34.45], [134.15, 34.47]],
    // 淡路島
    [[134.75, 34.25], [134.85, 34.40], [134.95, 34.57], [135.02, 34.60], [134.98, 34.45], [134.90, 34.30], [134.80, 34.20]],
    // 直島
    [[133.97, 34.45], [134.00, 34.47], [134.01, 34.45], [133.98, 34.43]],
    // 因島・向島あたり
    [[133.15, 34.30], [133.20, 34.32], [133.22, 34.27], [133.17, 34.25]],
  ],

  water: [],

  cities: [
    { name: '岡山', lat: 34.66, lon: 133.92 },
    { name: '倉敷', lat: 34.585, lon: 133.77 },
    { name: '福山', lat: 34.49, lon: 133.36 },
    { name: '尾道', lat: 34.41, lon: 133.20 },
    { name: '姫路', lat: 34.82, lon: 134.69 },
    { name: '赤穂', lat: 34.75, lon: 134.39 },
    { name: '津山', lat: 35.07, lon: 134.00 },
    { name: '高松', lat: 34.34, lon: 134.05 },
    { name: '丸亀', lat: 34.29, lon: 133.80 },
  ],

  fixes: {
    // 無線施設 (AIP の座標)
    OYE: { lat: 34.75028, lon: 133.83500, type: 'vor' }, // KIBI VOR/DME
    OKC: { lat: 34.67139, lon: 134.01500, type: 'vor' }, // OKAYAMA VORTAC
    // AIP の経路記述から推定
    CHIZU: { lat: 35.058, lon: 134.555 },   // OYE R-070 約40NM
    WASYU: { lat: 34.458, lon: 133.354 },   // OKC R-256 約35NM
    SAYOH: { lat: 34.980, lon: 134.360 },
    TAMBA: { lat: 35.170, lon: 135.050 },
    // 有視界の位置通報点 (地名の位置)
    KURASHIKI: { lat: 34.585, lon: 133.770 },
    TAKAHASHI: { lat: 34.790, lon: 133.620 },
    SANYO: { lat: 34.730, lon: 134.030 },
    EYOMI: { lat: 34.950, lon: 133.870 },
  },

  airports: {
    RJOB: {
      name: '岡山', short: 'OKJ', elev: 806,
      runways: [
        { ids: ['07', '25'], thr: [34.7497, 133.8411], hdg: 58.5, len: 3000 },
      ],
    },
  },

  arrivalAlts: [10000, 11000, 12000],
  departureAlt: { initial: 5000, exit: 9000 },

  departures: [
    // MIYAZU TWO / OTSU FIVE: OYE R-070 を東へ。CHIZU 方面で関西の管制へ
    { apt: 'RJOB', name: 'MIYAZU', exit: 'CHIZU', exitAlt: 11000, weight: 3,
      route: { default: ['CHIZU'], '25': ['OYE', 'CHIZU'] }, turn: { '25': 'L' } },
    // WASYU TWO: OKC R-256 を南西へ
    { apt: 'RJOB', name: 'WASYU', exit: 'WASYU', exitAlt: 9000, weight: 2,
      route: { default: ['WASYU'], '07': ['OYE', 'WASYU'] }, turn: { '07': 'R', '25': 'L' } },
  ],

  configs: {
    east: {
      name: '東風運用 (RWY07)',
      airports: { RJOB: { arr: ['07'], dep: ['07'] } },
      arrivals: [
        { dest: 'RJOB', rwy: '07', name: 'TAMBA', from: [60, 80, 40], weight: 3,
          route: ['TAMBA', 'SAYOH', 'OKC', 'KURASHIKI'] },
        { dest: 'RJOB', rwy: '07', name: 'WASYU', from: [240, 210, 260], weight: 2, route: ['WASYU'] },
        { dest: 'RJOB', rwy: '07', name: 'TAKAHASHI', from: [330, 300], weight: 1, route: ['EYOMI', 'TAKAHASHI'] },
      ],
    },
    west: {
      name: '西風運用 (RWY25)',
      airports: { RJOB: { arr: ['25'], dep: ['25'] } },
      arrivals: [
        { dest: 'RJOB', rwy: '25', name: 'CHIZU', from: [60, 80, 40], weight: 3, route: ['TAMBA', 'CHIZU'] },
        { dest: 'RJOB', rwy: '25', name: 'SANYO', from: [240, 210, 260], weight: 2, route: ['WASYU', 'KURASHIKI', 'SANYO'] },
        { dest: 'RJOB', rwy: '25', name: 'EYOMI', from: [330, 300], weight: 1, route: ['TAKAHASHI', 'EYOMI'] },
      ],
    },
  },
};

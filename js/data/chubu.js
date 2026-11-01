// 中部 (セントレア・小牧・静岡) マップデータ
//
// 担当範囲: セントレアの進入管制に、小牧・静岡の出入りと、中部上空を通る航空路 (東京〜関西・福岡) の一部を加えたもの。
//
// AIP Japan (AIRAC 2026-01, yinlei.org 編集版) から取れたもの:
//   - セントレア: RNAV の Fix 30か所と CHUBU VOR (CBE)。STAR (SOUTH → RWY36 の PROBE / NORTH → RWY18 の QUEST)、
//     SID の CHITA ONE (→ LAURA → ENSYU)。滑走路は実在の PROBE と QUEST を結ぶ線から真方位 349°
//   - 小牧: NAGOYA VORTAC (KCC)、KOWA VORTAC (XMC)、TALMI・HEIAN の座標。滑走路は磁方位 159°/339° (真方位 152°/332°)
//     SID: TALMI (→ HEIAN 方面)・HOUBA・MORIZ、STAR: EXPOH (XMC または SWING から)
//   - 静岡: SHIZUOKA VOR (SZE)。滑走路は磁方位 119°/299° (真方位 112°/292°)。STAR: ENSYU / BAIKU (→ SUZKI → OHCHA)、SID: UNODA
// 2本の方位線の交点から求めたもの (AIP の「〇〇から何度」の記述どうしの交点):
//   CHAUS (CBE R067 × SZE R356)、HIKNE (CBE R314 × CUE R060)、MORIZ (KCC R137 × XMC R039)、TSUGU (CBE R067/36DME)
// 方位と距離から推定したもの:
//   EXPOH (KCC R159 約9NM)、HOUBA (KCC R033 約25NM)、OHCHA (SZE R119 約12.5NM)、SUZKI (SZE R119/30DME)、UNODA (SZE R179/30DME)
// 磁方位から真方位への換算は偏差 7°W。実際の運航には使えません。書式は kanto.js と同じです。
//   overflights    : 上空通過機の流れ。exit を exitAlt〜exitAltMax の高度で通過させると次の管制へ引き継ぎ
//   overflightShare: 出現する機体のうち上空通過機の割合
window.ATC = window.ATC || {};
ATC.maps = ATC.maps || {};

ATC.maps.chubu = {
  id: 'chubu',
  name: '中部',
  subtitle: 'セントレア・小牧・静岡',
  bounds: { west: 135.60, east: 138.90, south: 34.15, north: 35.75 },
  // 実際の混み具合に近い同時機数と出現間隔 (開始画面の「実際のピーク」)。セントレア・小牧・静岡の離着陸と上空通過で1時間に約60機
  peak: { max: 20, interval: 60 },

  land: [
    // 本州 (紀伊半島東岸 → 志摩 → 伊勢湾 → 知多半島 → 三河湾 → 渥美半島 → 遠州灘 → 御前崎 → 駿河湾 → 伊豆西岸)
    [
      [135.50, 33.60], [135.90, 33.60], [136.10, 33.85], [136.22, 34.05], [136.35, 34.20],
      [136.55, 34.25], [136.85, 34.28], [136.90, 34.35], [136.88, 34.45], [136.85, 34.50],
      [136.75, 34.52], [136.60, 34.60], [136.55, 34.70], [136.60, 34.85], [136.62, 34.95],
      [136.67, 35.05], [136.75, 35.07], [136.85, 35.05], [136.88, 35.02], [136.85, 34.95],
      [136.84, 34.88], [136.86, 34.80], [136.88, 34.73], [136.92, 34.68], [136.97, 34.72],
      [136.98, 34.80], [137.00, 34.88], [137.05, 34.90], [137.15, 34.82], [137.25, 34.78],
      [137.32, 34.76], [137.35, 34.72], [137.30, 34.68], [137.15, 34.65], [137.03, 34.60],
      [137.10, 34.58], [137.30, 34.63], [137.45, 34.66], [137.60, 34.68], [137.75, 34.67],
      [137.90, 34.66], [138.00, 34.65], [138.15, 34.62], [138.22, 34.60], [138.25, 34.68],
      [138.30, 34.78], [138.33, 34.85], [138.40, 34.92], [138.47, 34.98], [138.52, 35.03],
      [138.57, 35.10], [138.65, 35.13], [138.72, 35.14], [138.80, 35.12], [138.86, 35.08],
      [138.80, 35.02], [138.77, 34.93], [138.76, 34.82], [138.78, 34.72], [138.83, 34.63],
      [138.85, 34.60], [138.92, 34.62], [138.96, 34.67], [139.02, 34.71], [139.10, 34.85],
      [139.10, 36.00], [135.50, 36.00],
    ],
    // セントレアの空港島
    [[136.793, 34.835], [136.818, 34.832], [136.822, 34.880], [136.797, 34.884]],
  ],

  water: [
    // 琵琶湖 (南半分)
    [[135.86, 35.00], [135.95, 35.10], [136.05, 35.20], [136.10, 35.30], [136.20, 35.40], [136.25, 35.45],
      [136.15, 35.50], [136.00, 35.40], [135.95, 35.30], [135.90, 35.15]],
    // 浜名湖
    [[137.53, 34.68], [137.60, 34.70], [137.63, 34.76], [137.57, 34.79], [137.52, 34.73]],
  ],

  cities: [
    { name: '名古屋', lat: 35.17, lon: 136.90 },
    { name: '岐阜', lat: 35.42, lon: 136.76 },
    { name: '豊田', lat: 35.08, lon: 137.16 },
    { name: '岡崎', lat: 34.95, lon: 137.17 },
    { name: '豊橋', lat: 34.77, lon: 137.39 },
    { name: '浜松', lat: 34.71, lon: 137.73 },
    { name: '静岡', lat: 34.98, lon: 138.38 },
    { name: '四日市', lat: 34.97, lon: 136.62 },
    { name: '津', lat: 34.72, lon: 136.50 },
    { name: '伊勢', lat: 34.49, lon: 136.71 },
    { name: '彦根', lat: 35.27, lon: 136.26 },
    { name: '京都', lat: 35.01, lon: 135.77 },
    { name: '常滑', lat: 34.88, lon: 136.85 },
  ],

  fixes: {
    // 無線施設 (AIP)
    CBE: { lat: 34.85806, lon: 136.80306, type: 'vor' },   // CHUBU VOR/DME
    KCC: { lat: 35.26528, lon: 136.91500, type: 'vor' },   // NAGOYA VORTAC
    XMC: { lat: 34.70472, lon: 136.95806, type: 'vor' },   // KOWA VORTAC
    SZE: { lat: 34.79694, lon: 138.19333, type: 'vor' },   // SHIZUOKA VOR/DME
    // セントレアの RNAV Fix (AIP)
    ATENA: { lat: 34.84128, lon: 136.70103 },
    CARDS: { lat: 34.41875, lon: 136.40086 },
    CHESS: { lat: 35.34244, lon: 136.48486 },
    COSTA: { lat: 34.67706, lon: 136.91650 },
    DARTS: { lat: 35.07261, lon: 137.44153 },
    DELFI: { lat: 34.76361, lon: 136.72750 },
    DUGON: { lat: 34.57681, lon: 136.79056 },
    ENSYU: { lat: 34.54331, lon: 138.03403 },
    FAROL: { lat: 34.72492, lon: 136.81214 },
    GG18Y: { lat: 35.21531, lon: 136.63600 },
    GG18Z: { lat: 34.78464, lon: 136.53425 },
    GG36A: { lat: 34.83239, lon: 136.71089 },
    GG36Z: { lat: 34.49936, lon: 136.62106 },
    IRAGO: { lat: 34.68669, lon: 137.08108 },
    ISUZU: { lat: 34.79667, lon: 136.71181 },
    KUMOZ: { lat: 34.77806, lon: 136.59875 },
    LAGNA: { lat: 34.84267, lon: 137.16094 },
    LAURA: { lat: 34.62394, lon: 137.37081 },
    LICOR: { lat: 35.11289, lon: 136.65503 },
    MALUS: { lat: 35.01328, lon: 136.76811 },
    MEIJI: { lat: 35.22250, lon: 137.11442 },
    MINEL: { lat: 34.99897, lon: 136.68056 },
    PASSO: { lat: 34.95856, lon: 136.52403 },
    PIASS: { lat: 35.17172, lon: 136.91528 },
    POLPO: { lat: 34.60261, lon: 136.94900 },
    PROBE: { lat: 34.58972, lon: 136.86978 },
    QUEST: { lat: 35.12692, lon: 136.74067 },
    SANGU: { lat: 34.72181, lon: 136.54803 },
    SLIDE: { lat: 35.29294, lon: 137.39339 },
    SWING: { lat: 35.38942, lon: 137.25819 },
    // 小牧の Fix (AIP)
    TALMI: { lat: 35.47100, lon: 136.62381 },
    HEIAN: { lat: 35.34639, lon: 135.76211 },
    // 2本の方位線の交点から
    CHAUS: { lat: 35.44200, lon: 138.03900 },   // CBE R067 × SZE R356
    HIKNE: { lat: 35.23900, lon: 136.18600 },   // CBE R314 × CUE R060
    MORIZ: { lat: 35.05300, lon: 137.22400 },   // KCC R137 × XMC R039
    TSUGU: { lat: 35.15800, lon: 137.43700 },   // CBE R067/36DME
    // 方位と距離から推定
    EXPOH: { lat: 35.13290, lon: 137.00120 },   // KCC R159 約9NM (小牧 ILS34 の手前)
    HOUBA: { lat: 35.64000, lon: 137.13900 },   // KCC R033 約25NM
    OHCHA: { lat: 34.71890, lon: 138.42840 },   // SZE R119 約12.5NM (静岡 ILS30 の手前)
    SUZKI: { lat: 34.60970, lon: 138.75750 },   // SZE R119/30DME
    UNODA: { lat: 34.30200, lon: 138.27800 },   // SZE R179/30DME
  },

  airports: {
    RJGG: {
      name: 'セントレア', short: 'NGO', elev: 15,
      runways: [{ ids: ['36', '18'], thr: [34.84282, 136.80896], hdg: 349, len: 3500 }],
    },
    RJNA: {
      name: '小牧', short: 'NKM', elev: 46,
      runways: [{ ids: ['34', '16'], thr: [35.24440, 136.93130], hdg: 332, len: 2740 }],
    },
    RJNS: {
      name: '静岡', short: 'FSZ', elev: 432,
      runways: [{ ids: ['12', '30'], thr: [34.80030, 138.17670], hdg: 112, len: 2500 }],
    },
  },

  arrivalAlts: [11000, 12000, 13000],
  departureAlt: { initial: 5000, exit: 11000 },

  departures: [
    // セントレア
    { apt: 'RJGG', name: 'CHITA', exit: 'ENSYU', exitAlt: 13000, weight: 3, turn: { '36': 'L' },
      route: { '18': ['FAROL', 'COSTA', 'LAURA', 'ENSYU'], '36': ['GG36A', 'DELFI', 'COSTA', 'LAURA', 'ENSYU'] } },
    { apt: 'RJGG', name: 'OUMI', exit: 'HIKNE', exitAlt: 11000, weight: 2, turn: { '18': 'R' }, route: ['HIKNE'] },
    { apt: 'RJGG', name: 'MEIJYO', exit: 'KCC', exitAlt: 9000, weight: 2, turn: { '18': 'R' }, route: ['KCC'] },
    { apt: 'RJGG', name: 'TOYOTA', exit: 'CHAUS', exitAlt: 14000, weight: 2, route: ['MORIZ', 'TSUGU', 'CHAUS'] },
    // 小牧
    { apt: 'RJNA', name: 'TALMI', exit: 'HEIAN', exitAlt: 13000, weight: 1, turn: { '34': 'L', '16': 'R' }, route: ['TALMI', 'HEIAN'] },
    { apt: 'RJNA', name: 'HOUBA', exit: 'HOUBA', exitAlt: 11000, weight: 1, turn: { '34': 'R', '16': 'L' }, route: ['HOUBA'] },
    { apt: 'RJNA', name: 'MORIZ', exit: 'CHAUS', exitAlt: 14000, weight: 1, turn: { '34': 'R', '16': 'L' }, route: ['MORIZ', 'TSUGU', 'CHAUS'] },
    // 静岡
    { apt: 'RJNS', name: 'UNODA', exit: 'UNODA', exitAlt: 9000, weight: 1, turn: { '12': 'R', '30': 'L' }, route: ['UNODA'] },
    { apt: 'RJNS', name: 'CHAUS', exit: 'CHAUS', exitAlt: 13000, weight: 1, turn: { '12': 'R', '30': 'L' }, route: ['SZE', 'CHAUS'] },
  ],

  // 中部上空の航空路を通る機体 (東京〜関西・福岡)
  overflightShare: 0.3,
  overflights: [
    // 東京方面から伊丹・関西へ: 中部の上空で降下を始め、HEIAN を 9000〜13000ft で関西の管制へ
    { name: 'ITAMI', from: [70, 50, 90], route: ['CHAUS', 'TSUGU', 'HIKNE', 'HEIAN'],
      exit: 'HEIAN', exitAlt: 9000, exitAltMax: 13000, alts: [20000, 22000], weight: 2 },
    // 関西から東京方面へ: 上昇しながら北側を東へ
    { name: 'KANTO', from: [260, 280], route: ['HEIAN', 'TALMI', 'HOUBA'],
      exit: 'HOUBA', exitAlt: 17000, alts: [13000, 14000, 15000], weight: 2 },
    // 福岡・那覇方面と東京の間を、南側の高い高度で横切る (東行き・西行き)
    { name: 'EAST', from: [250, 270], route: ['CARDS', 'COSTA', 'LAURA', 'ENSYU'],
      exit: 'ENSYU', exitAlt: 20000, alts: [21000, 23000], weight: 1 },
    { name: 'WEST', from: [80, 100], route: ['SUZKI', 'ENSYU', 'LAURA', 'COSTA', 'CARDS'],
      exit: 'CARDS', exitAlt: 20000, alts: [22000, 24000], weight: 1 },
  ],

  configs: {
    north: {
      name: '北風運用 (RWY36)',
      airports: {
        RJGG: { arr: ['36'], dep: ['36'] },
        RJNA: { arr: ['34'], dep: ['34'] },
        RJNS: { arr: ['30'], dep: ['30'] },
      },
      arrivals: [
        { dest: 'RJGG', rwy: '36', name: 'CARDS', from: [230, 260, 200], weight: 2, route: ['CARDS', 'GG36Z', 'PROBE'] },
        { dest: 'RJGG', rwy: '36', name: 'CHESS', from: [330, 300, 0], weight: 2,
          route: ['CHESS', 'PASSO', 'SANGU', 'DUGON', 'PROBE'] },
        { dest: 'RJGG', rwy: '36', name: 'SWING', from: [20, 45], weight: 2,
          route: ['SWING', 'LAGNA', 'IRAGO', 'POLPO', 'PROBE'] },
        { dest: 'RJGG', rwy: '36', name: 'SLIDE', from: [50, 70], weight: 1,
          route: ['SLIDE', 'LAGNA', 'IRAGO', 'POLPO', 'PROBE'] },
        { dest: 'RJGG', rwy: '36', name: 'DARTS', from: [80, 100, 120], weight: 2,
          route: ['DARTS', 'LAGNA', 'IRAGO', 'POLPO', 'PROBE'] },
        { dest: 'RJNA', rwy: '34', name: 'EXPOH S', from: [200, 230, 170], weight: 1, route: ['XMC', 'EXPOH'] },
        { dest: 'RJNA', rwy: '34', name: 'EXPOH N', from: [20, 45], weight: 1, route: ['SWING', 'EXPOH'] },
        { dest: 'RJNS', rwy: '30', name: 'ENSYU', from: [250, 270], weight: 1, route: ['ENSYU', 'UNODA', 'SUZKI', 'OHCHA'] },
        { dest: 'RJNS', rwy: '30', name: 'BAIKU', from: [180, 200, 160], weight: 1, route: ['UNODA', 'SUZKI', 'OHCHA'] },
      ],
    },
    south: {
      name: '南風運用 (RWY18)',
      airports: {
        RJGG: { arr: ['18'], dep: ['18'] },
        RJNA: { arr: ['16'], dep: ['16'] },
        RJNS: { arr: ['12'], dep: ['12'] },
      },
      arrivals: [
        { dest: 'RJGG', rwy: '18', name: 'CARDS', from: [230, 260, 200], weight: 2, route: ['CARDS', 'GG18Z', 'LICOR', 'QUEST'] },
        { dest: 'RJGG', rwy: '18', name: 'CHESS', from: [330, 300, 0], weight: 2, route: ['CHESS', 'GG18Y', 'QUEST'] },
        { dest: 'RJGG', rwy: '18', name: 'SWING', from: [20, 45], weight: 2, route: ['SWING', 'MEIJI', 'PIASS', 'QUEST'] },
        { dest: 'RJGG', rwy: '18', name: 'SLIDE', from: [50, 70], weight: 1, route: ['SLIDE', 'MEIJI', 'PIASS', 'QUEST'] },
        { dest: 'RJGG', rwy: '18', name: 'DARTS', from: [80, 100, 120], weight: 2, route: ['DARTS', 'MEIJI', 'PIASS', 'QUEST'] },
        { dest: 'RJNA', rwy: '16', name: 'EXPOH S', from: [200, 230, 170], weight: 1, route: ['XMC', 'EXPOH'] },
        { dest: 'RJNA', rwy: '16', name: 'EXPOH N', from: [20, 45], weight: 1, route: ['SWING', 'EXPOH'] },
        { dest: 'RJNS', rwy: '12', name: 'ENSYU', from: [250, 270], weight: 1, route: ['ENSYU', 'UNODA', 'SUZKI', 'OHCHA'] },
        { dest: 'RJNS', rwy: '12', name: 'BAIKU', from: [180, 200, 160], weight: 1, route: ['UNODA', 'SUZKI', 'OHCHA'] },
      ],
    },
  },
};

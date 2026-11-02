// 中国・四国マップデータ (広島・岡山・高松・松山・高知)
//
// AIP Japan (AIRAC 2026-01, yinlei.org 編集版) から取れたもの:
//   - 広島 RJOA: STAR (MISEN / VISTA)、RNAV SID (KIJYY / MOMOT / SINFO) の Fix、HONGO VOR/DME (HGE)、ILS の FAF
//   - 高松 RJOT: OLIVE RNAV ARRIVAL の Fix、KAGAWA VOR/DME (KTE)、SHODO VOR/DME (STE)
//   - 松山 RJOM: EAST / WEST RNAV ARRIVAL の Fix、MATSUYAMA VOR/DME (MPE)、KUGA VORTAC (IWC)
//   - 高知 RJOK: STAR (POPPY・PANCH・OKITU・KABIL から ANPAN へ)、RNAV SID (KARIN / KAIFU / MUROT / OMOGO) の Fix、KOCHI VOR/DME (KRE)
//   - 岡山 RJOB: 滑走路 07/25、KIBI VOR/DME (OYE)・OKAYAMA VORTAC (OKC)、SID の方位の記述
// 推定で置いているもの:
//   - 岡山の CHIZU・WASYU・SAYOH・TAMBA (AIP の方位・距離の記述から)、有視界の位置通報点 (地名の位置)
//   - 滑走路の向き: 広島は ILS 10/28 の FAF を結ぶ線、高松・松山・高知は STAR の最後の Fix から逆算した真方位
//   - 高松・松山の SID: 座標表が資料になかったので、出口を既知の Fix にしている
//   - 上空通過機の経路: 福岡・那覇方面と関西・東京方面を結ぶ瀬戸内の流れを、無線施設を結んだ線で表したもの
// 実際の運航には使えません。ゲーム用の参考データです。書式は kanto.js と同じです。
window.ATC = window.ATC || {};
ATC.maps = ATC.maps || {};

ATC.maps.okayama = {
  id: 'okayama',
  name: '中国・四国',
  subtitle: '広島・岡山・高松・松山・高知',
  bounds: { west: 131.85, east: 135.15, south: 32.95, north: 35.35 },
  magVar: 7,
  // 上空通過機の割合 (瀬戸内の上は福岡・那覇と関西・東京を結ぶ幹線)
  overflightShare: 0.25,
  // 実際の混み具合に近い同時機数と出現間隔 (開始画面の「実際のピーク」)。5空港で1時間に約40回の離着陸と、瀬戸内の上空通過が約30機
  peak: { max: 20, interval: 50 },

  land: [
    // 本州 (柳井 → 岩国 → 広島 → 呉 → 三原 → 尾道 → 福山 → 倉敷 → 岡山 → 赤穂 → 姫路 → 明石 → 神戸)
    [
      [131.80, 34.02], [132.05, 33.93], [132.15, 33.95], [132.22, 34.05], [132.22, 34.15],
      [132.30, 34.25], [132.40, 34.32], [132.47, 34.36], [132.52, 34.33], [132.55, 34.25],
      [132.62, 34.20], [132.72, 34.23], [132.82, 34.28], [132.92, 34.32], [133.05, 34.37],
      [133.20, 34.41], [133.30, 34.45], [133.40, 34.48], [133.50, 34.50], [133.60, 34.50],
      [133.68, 34.50], [133.73, 34.47], [133.80, 34.45], [133.85, 34.47], [133.90, 34.50],
      [133.96, 34.57], [134.05, 34.60], [134.15, 34.62], [134.22, 34.68], [134.30, 34.73],
      [134.40, 34.74], [134.50, 34.76], [134.60, 34.77], [134.70, 34.76], [134.80, 34.72],
      [134.90, 34.66], [135.00, 34.65], [135.10, 34.66], [135.20, 34.69], [135.30, 34.70],
      [135.30, 35.80], [131.80, 35.80],
    ],
    // 四国 (佐田岬 → 松山 → 今治 → 新居浜 → 丸亀 → 高松 → 鳴門 → 徳島 → 室戸岬 → 高知 → 足摺岬 → 宇和島)
    [
      [132.02, 33.34], [132.25, 33.45], [132.40, 33.52], [132.48, 33.62], [132.55, 33.70],
      [132.65, 33.78], [132.69, 33.84], [132.70, 33.93], [132.78, 34.00], [132.90, 34.08],
      [133.00, 34.07], [133.10, 33.98], [133.20, 33.93], [133.30, 33.96], [133.45, 33.98],
      [133.57, 34.00], [133.62, 34.08], [133.66, 34.15], [133.70, 34.22], [133.79, 34.29],
      [133.86, 34.32], [133.95, 34.35], [134.05, 34.35], [134.15, 34.33], [134.25, 34.30],
      [134.35, 34.25], [134.45, 34.21], [134.60, 34.20], [134.62, 34.10], [134.65, 34.00],
      [134.70, 33.85], [134.60, 33.75], [134.45, 33.62], [134.30, 33.45], [134.18, 33.25],
      [134.12, 33.30], [134.00, 33.45], [133.85, 33.50], [133.70, 33.53], [133.55, 33.47],
      [133.40, 33.38], [133.25, 33.25], [133.10, 33.10], [133.00, 32.95], [132.98, 32.80],
      [133.02, 32.73], [132.90, 32.75], [132.70, 32.85], [132.55, 32.95], [132.45, 33.10],
      [132.40, 33.25], [132.30, 33.30],
    ],
    // 九州の国東半島・大分あたり (西の端)
    [[131.70, 33.70], [131.75, 33.55], [131.88, 33.40], [131.90, 33.25], [131.95, 33.10], [131.85, 32.90], [131.60, 32.90], [131.60, 33.70]],
    // 周防大島
    [[132.15, 33.95], [132.35, 33.97], [132.42, 33.90], [132.20, 33.87]],
    // 江田島・倉橋島
    [[132.45, 34.25], [132.55, 34.25], [132.58, 34.15], [132.48, 34.12]],
    // 大三島・因島など (芸予諸島)
    [[132.95, 34.28], [133.10, 34.30], [133.20, 34.32], [133.22, 34.25], [133.05, 34.18], [132.95, 34.20]],
    // 小豆島
    [[134.13, 34.50], [134.20, 34.54], [134.30, 34.56], [134.37, 34.52], [134.33, 34.46], [134.22, 34.45], [134.15, 34.47]],
    // 淡路島
    [[134.75, 34.25], [134.85, 34.40], [134.95, 34.57], [135.02, 34.60], [134.98, 34.45], [134.90, 34.30], [134.80, 34.20]],
    // 直島
    [[133.97, 34.45], [134.00, 34.47], [134.01, 34.45], [133.98, 34.43]],
  ],

  water: [],

  cities: [
    { name: '広島', lat: 34.39, lon: 132.46 },
    { name: '呉', lat: 34.25, lon: 132.57 },
    { name: '岩国', lat: 34.17, lon: 132.22 },
    { name: '三次', lat: 34.80, lon: 132.85 },
    { name: '尾道', lat: 34.41, lon: 133.20 },
    { name: '福山', lat: 34.49, lon: 133.36 },
    { name: '倉敷', lat: 34.585, lon: 133.77 },
    { name: '岡山', lat: 34.66, lon: 133.92 },
    { name: '津山', lat: 35.07, lon: 134.00 },
    { name: '姫路', lat: 34.82, lon: 134.69 },
    { name: '高松', lat: 34.34, lon: 134.05 },
    { name: '丸亀', lat: 34.29, lon: 133.80 },
    { name: '徳島', lat: 34.07, lon: 134.55 },
    { name: '今治', lat: 34.07, lon: 133.00 },
    { name: '新居浜', lat: 33.96, lon: 133.28 },
    { name: '松山', lat: 33.84, lon: 132.77 },
    { name: '高知', lat: 33.56, lon: 133.53 },
    { name: '宇和島', lat: 33.22, lon: 132.56 },
  ],

  fixes: {
    // 無線施設 (AIP の座標)
    HGE: { lat: 34.43389, lon: 132.92389, type: 'vor' }, // HONGO VOR/DME
    OYE: { lat: 34.75028, lon: 133.83500, type: 'vor' }, // KIBI VOR/DME
    OKC: { lat: 34.67139, lon: 134.01500, type: 'vor' }, // OKAYAMA VORTAC
    KTE: { lat: 34.21250, lon: 134.02250, type: 'vor' }, // KAGAWA VOR/DME
    STE: { lat: 34.51250, lon: 134.27417, type: 'vor' }, // SHODO VOR/DME
    MPE: { lat: 33.81306, lon: 132.71750, type: 'vor' }, // MATSUYAMA VOR/DME
    IWC: { lat: 34.07944, lon: 132.14728, type: 'vor' }, // KUGA VORTAC
    KRE: { lat: 33.54167, lon: 133.68028, type: 'vor' }, // KOCHI VOR/DME
    // 広島 (STAR・SID)
    AMURO: { lat: 34.69192, lon: 133.34072 },
    SAILA: { lat: 34.66211, lon: 133.21047 },
    SEAWA: { lat: 34.53003, lon: 132.64161 },
    MISEN: { lat: 34.43572, lon: 132.64192 },
    OA28A: { lat: 34.59358, lon: 133.27017 },
    TIIDA: { lat: 34.50433, lon: 133.20625 },
    VISTA: { lat: 34.43597, lon: 133.15742 },
    OA10Z: { lat: 34.43600, lon: 132.98356 },
    OA28Z: { lat: 34.42786, lon: 132.82314 },
    TOJYO: { lat: 34.88208, lon: 133.28017 },
    KIJYY: { lat: 35.15050, lon: 134.09858 },
    MOMOT: { lat: 35.01497, lon: 133.92281 },
    AKANA: { lat: 34.96347, lon: 132.81800 },
    SINFO: { lat: 35.20017, lon: 132.77039 },
    // 高松 (OLIVE RNAV ARRIVAL)
    OLIVE: { lat: 34.75492, lon: 134.45006 },
    TSUDA: { lat: 34.55294, lon: 134.39358 },
    BRUTE: { lat: 34.34361, lon: 134.33531 },
    POPAI: { lat: 34.27644, lon: 134.25989 },
    // 松山 (EAST / WEST RNAV ARRIVAL)
    ITUKI: { lat: 34.11092, lon: 132.81639 },
    OM450: { lat: 34.07111, lon: 132.70294 },
    OM451: { lat: 34.00372, lon: 132.51192 },
    ROMAN: { lat: 34.01447, lon: 132.33194 },
    ROBIN: { lat: 33.94100, lon: 132.53939 },
    // 高知 (STAR・SID)
    POPPY: { lat: 33.81808, lon: 133.82092 },
    JYAMU: { lat: 33.75525, lon: 133.84233 },
    BATAK: { lat: 33.56786, lon: 133.90592 },
    CHEEZ: { lat: 33.43194, lon: 133.91864 },
    ANPAN: { lat: 33.41875, lon: 133.84681 },
    PANCH: { lat: 33.18925, lon: 134.08822 },
    OKITU: { lat: 33.09653, lon: 133.29208 },
    BIRKN: { lat: 33.36183, lon: 133.78831 },
    KABIL: { lat: 33.48167, lon: 133.28817 },
    DOKIN: { lat: 33.45525, lon: 133.39933 },
    KARIN: { lat: 33.67344, lon: 134.18747 },
    KAIFU: { lat: 33.60278, lon: 134.54200 },
    MUROT: { lat: 33.34489, lon: 134.33631 },
    OMOGO: { lat: 33.65944, lon: 133.28464 },
    // 岡山 (AIP の経路記述から推定)
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
    RJOA: {
      name: '広島', short: 'HIJ', elev: 1088,
      runways: [{ ids: ['10', '28'], thr: [34.44057, 132.90285], hdg: 87.7, len: 3000 }],
    },
    RJOB: {
      name: '岡山', short: 'OKJ', elev: 806,
      runways: [{ ids: ['07', '25'], thr: [34.7497, 133.8411], hdg: 58.5, len: 3000 }],
    },
    RJOT: {
      name: '高松', short: 'TAK', elev: 607,
      runways: [{ ids: ['08', '26'], thr: [34.21089, 134.00260], hdg: 72.9, len: 2500 }],
    },
    RJOM: {
      name: '松山', short: 'MYJ', elev: 25,
      runways: [{ ids: ['14', '32'], thr: [33.83451, 132.68941], hdg: 130.6, len: 2500 }],
    },
    RJOK: {
      name: '高知', short: 'KCZ', elev: 42,
      runways: [{ ids: ['14', '32'], thr: [33.55343, 133.65917], hdg: 130.7, len: 2500 }],
    },
  },

  arrivalAlts: [10000, 11000, 12000],
  departureAlt: { initial: 5000, exit: 9000 },

  departures: [
    // 広島: RNAV SID。28 から出た機体は右に回って北東へ
    { apt: 'RJOA', name: 'KIJYY', exit: 'KIJYY', exitAlt: 13000, weight: 3, turn: { '28': 'R' },
      route: { '10': ['OA10Z', 'TOJYO', 'KIJYY'], '28': ['OA28Z', 'TOJYO', 'KIJYY'] } },
    { apt: 'RJOA', name: 'MOMOT', exit: 'MOMOT', exitAlt: 12000, weight: 2, turn: { '28': 'R' },
      route: { '10': ['OA10Z', 'TOJYO', 'MOMOT'], '28': ['OA28Z', 'TOJYO', 'MOMOT'] } },
    { apt: 'RJOA', name: 'SINFO', exit: 'SINFO', exitAlt: 11000, weight: 1, turn: { '28': 'R', '10': 'L' },
      route: { '10': ['OA10Z', 'AKANA', 'SINFO'], '28': ['OA28Z', 'AKANA', 'SINFO'] } },
    { apt: 'RJOA', name: 'KUGA', exit: 'IWC', exitAlt: 11000, weight: 2, turn: { '10': 'R' },
      route: { '10': ['OA10Z', 'IWC'], '28': ['OA28Z', 'IWC'] } },
    // 岡山: MIYAZU TWO / OTSU FIVE (OYE R-070 を東へ)、WASYU TWO (OKC R-256 を南西へ)
    { apt: 'RJOB', name: 'MIYAZU', exit: 'CHIZU', exitAlt: 11000, weight: 2,
      route: { default: ['CHIZU'], '25': ['OYE', 'CHIZU'] }, turn: { '25': 'L' } },
    { apt: 'RJOB', name: 'WASYU', exit: 'WASYU', exitAlt: 9000, weight: 1,
      route: { default: ['WASYU'], '07': ['OYE', 'WASYU'] }, turn: { '07': 'R', '25': 'L' } },
    // 高松: 東へは SAYOH、西へは WASYU (座標表がないので出口は推定の Fix)
    { apt: 'RJOT', name: 'SAYOH', exit: 'SAYOH', exitAlt: 10000, weight: 2, turn: { '26': 'R' },
      route: { default: ['STE', 'SAYOH'] } },
    { apt: 'RJOT', name: 'WASYU', exit: 'WASYU', exitAlt: 9000, weight: 1, turn: { '08': 'L' },
      route: { default: ['WASYU'] } },
    // 松山: 東へ ITUKI、西へ KUGA (IWC)
    { apt: 'RJOM', name: 'ITUKI', exit: 'ITUKI', exitAlt: 9000, weight: 2, turn: { '14': 'L', '32': 'R' },
      route: { default: ['ITUKI'] } },
    { apt: 'RJOM', name: 'KUGA', exit: 'IWC', exitAlt: 10000, weight: 2, turn: { '14': 'R', '32': 'L' },
      route: { default: ['ROMAN', 'IWC'] } },
    // 高知: RNAV SID (出口の Fix だけ。最初の旋回は出口の側へ)
    { apt: 'RJOK', name: 'KARIN', exit: 'KARIN', exitAlt: 9000, weight: 2, turn: { '14': 'L', '32': 'R' },
      route: { default: ['KARIN'] } },
    { apt: 'RJOK', name: 'KAIFU', exit: 'KAIFU', exitAlt: 11000, weight: 1, turn: { '14': 'L', '32': 'R' },
      route: { default: ['KAIFU'] } },
    { apt: 'RJOK', name: 'MUROT', exit: 'MUROT', exitAlt: 9000, weight: 1, turn: { '14': 'L', '32': 'R' },
      route: { default: ['MUROT'] } },
    { apt: 'RJOK', name: 'OMOGO', exit: 'OMOGO', exitAlt: 11000, weight: 1, turn: { '14': 'R', '32': 'L' },
      route: { default: ['OMOGO'] } },
  ],

  // 瀬戸内の上を抜けていく機体 (福岡・那覇・アジア方面と関西・東京の間。巡航高度 FL290〜FL390 のまま。方向で奇数/偶数の高度)
  overflights: [
    { name: 'EAST', from: [250, 270], route: ['IWC', 'HGE', 'OYE', 'CHIZU'],
      exit: 'CHIZU', exitAlt: 29000, alts: [29000, 33000, 35000, 37000, 39000], weight: 2 },
    { name: 'WEST', from: [60, 80], route: ['STE', 'KTE', 'MPE', 'IWC'],
      exit: 'IWC', exitAlt: 28000, alts: [28000, 32000, 34000, 36000, 38000], weight: 2 },
  ],

  configs: {
    east: {
      name: '東寄りの風', when: '07・10・08・14',
      note: '広島 10・岡山 07・高松 08・松山 14・高知 14 を使います。STAR の多くは逆向きの滑走路用なので、最後は回り込みが必要です。',
      airports: {
        RJOA: { arr: ['10'], dep: ['10'] },
        RJOB: { arr: ['07'], dep: ['07'] },
        RJOT: { arr: ['08'], dep: ['08'] },
        RJOM: { arr: ['14'], dep: ['14'] },
        RJOK: { arr: ['14'], dep: ['14'] },
      },
      arrivals: [
        { dest: 'RJOA', rwy: '10', name: 'MISEN', from: [80, 60, 100], weight: 2, route: ['AMURO', 'SAILA', 'SEAWA', 'MISEN'] },
        { dest: 'RJOA', rwy: '10', from: [270, 250], weight: 1, route: ['SEAWA', 'MISEN'] },
        { dest: 'RJOB', rwy: '07', name: 'TAMBA', from: [60, 80, 40], weight: 2, route: ['TAMBA', 'SAYOH', 'OKC', 'KURASHIKI'] },
        { dest: 'RJOB', rwy: '07', name: 'WASYU', from: [240, 210, 260], weight: 1, route: ['WASYU'] },
        { dest: 'RJOT', rwy: '08', name: 'OLIVE', from: [60, 40, 80], weight: 2, route: ['OLIVE', 'TSUDA', 'BRUTE', 'POPAI'] },
        { dest: 'RJOM', rwy: '14', name: 'EAST', from: [60, 80, 40], weight: 2, route: ['ITUKI', 'OM450', 'OM451', 'ROBIN'] },
        { dest: 'RJOM', rwy: '14', name: 'WEST', from: [270, 250], weight: 1, route: ['IWC', 'ROMAN', 'ROBIN'] },
        { dest: 'RJOK', rwy: '14', name: 'POPPY', from: [40, 20, 60], weight: 2, route: ['POPPY', 'JYAMU', 'BATAK', 'CHEEZ', 'ANPAN'] },
        { dest: 'RJOK', rwy: '14', name: 'OKITU', from: [210, 230], weight: 1, route: ['OKITU', 'BIRKN', 'ANPAN'] },
      ],
    },
    west: {
      name: '西寄りの風', when: '25・28・26・32',
      note: '広島 28・岡山 25・高松 26・松山 32・高知 32 を使います。高松 (OLIVE) と高知 (ANPAN) の STAR はこの向き用です。',
      airports: {
        RJOA: { arr: ['28'], dep: ['28'] },
        RJOB: { arr: ['25'], dep: ['25'] },
        RJOT: { arr: ['26'], dep: ['26'] },
        RJOM: { arr: ['32'], dep: ['32'] },
        RJOK: { arr: ['32'], dep: ['32'] },
      },
      arrivals: [
        { dest: 'RJOA', rwy: '28', name: 'VISTA', from: [80, 60, 100], weight: 2, route: ['AMURO', 'OA28A', 'TIIDA', 'VISTA'] },
        { dest: 'RJOA', rwy: '28', from: [270, 250], weight: 1, route: ['SEAWA', 'MISEN'] },
        { dest: 'RJOB', rwy: '25', name: 'CHIZU', from: [60, 80, 40], weight: 2, route: ['TAMBA', 'CHIZU'] },
        { dest: 'RJOB', rwy: '25', name: 'SANYO', from: [240, 210, 260], weight: 1, route: ['WASYU', 'KURASHIKI', 'SANYO'] },
        { dest: 'RJOT', rwy: '26', name: 'OLIVE', from: [60, 40, 80], weight: 2, route: ['OLIVE', 'TSUDA', 'BRUTE', 'POPAI'] },
        { dest: 'RJOM', rwy: '32', name: 'EAST', from: [60, 80, 40], weight: 2, route: ['ITUKI', 'OM450', 'OM451', 'ROBIN'] },
        { dest: 'RJOM', rwy: '32', name: 'WEST', from: [270, 250], weight: 1, route: ['IWC', 'ROMAN', 'ROBIN'] },
        { dest: 'RJOK', rwy: '32', name: 'POPPY', from: [40, 20, 60], weight: 1, route: ['POPPY', 'JYAMU', 'BATAK', 'CHEEZ', 'ANPAN'] },
        { dest: 'RJOK', rwy: '32', name: 'PANCH', from: [150, 130, 170], weight: 1, route: ['PANCH', 'ANPAN'] },
        { dest: 'RJOK', rwy: '32', name: 'OKITU', from: [210, 230], weight: 1, route: ['OKITU', 'BIRKN', 'ANPAN'] },
        { dest: 'RJOK', rwy: '32', name: 'KABIL', from: [270, 250], weight: 1, route: ['KABIL', 'DOKIN', 'BIRKN', 'ANPAN'] },
      ],
    },
  },
};

// 関東マップデータ (羽田・成田)
//
// Fix・無線施設の座標と STAR / SID の経路は AIP Japan (AIRAC 2026-01) から取ったものです。
// 抽出元: yinlei.org が AIP Japan から編集した RJTT / RJAA の資料 (AIRAC 2026-01)
//   - SID の途中にある TT051 などの RNAV 点は座標が取れなかったので省いています
//   - 滑走路の位置はおおよそで、向きは FAF の座標から逆算した真方位です (磁方位ではありません)
//   - 地形 (海岸線) は手描きの概略です
// 実際の運航には使えません。ゲーム用の参考データです。
//
// 書式メモ
//   land / water : [経度, 緯度] の多角形
//   fixes        : { 名前: { lat, lon, type: 'vor' | 'fix' } }
//   runways      : ids[0] 側の滑走路末端(thr)・真方位(hdg)・長さ(m)。反対側は自動計算
//   configs      : 運用ごとの使用滑走路と到着経路 (STAR)。最終進入 (FAF→滑走路) は自動で付け足す
//     arrivals.from : 到着機が空域に入ってくる方角 (経路の最初の Fix から見た方位)。地図の端に出現する
//   departures   : 出発経路 (SID)。route は滑走路ごとに書ける ({ default: [...], '16R': [...] })
//     exit / exitAlt : 最後の Fix をこの高度以上で通過させるとハンドオフ成功
//     turn           : 離陸後の最初の旋回方向 (AIP の "turn right/left direct to ..."): { 滑走路: 'R' | 'L' }
//   arrivalAlts  : 到着機が入域するときの高度の候補
window.ATC = window.ATC || {};
ATC.maps = ATC.maps || {};

ATC.maps.kanto = {
  id: 'kanto',
  name: '関東',
  subtitle: '羽田・成田',
  bounds: { west: 138.00, east: 141.95, south: 34.40, north: 36.55 },

  land: [
    // 本州 (遠州灘 → 駿河湾 → 伊豆 → 相模湾 → 三浦 → 東京湾 → 房総 → 鹿島灘)
    [
      [137.30, 34.66], [137.60, 34.66], [137.90, 34.68], [138.10, 34.64], [138.22, 34.60],
      [138.25, 34.68], [138.30, 34.78], [138.33, 34.85], [138.40, 34.92], [138.47, 34.98],
      [138.52, 35.03], [138.57, 35.10], [138.65, 35.13], [138.72, 35.14], [138.80, 35.12],
      [138.86, 35.08],
      [138.80, 35.02], [138.77, 34.93], [138.76, 34.82], [138.78, 34.72], [138.83, 34.63],
      [138.85, 34.60], [138.92, 34.62], [138.96, 34.67], [139.02, 34.71], [139.08, 34.77],
      [139.10, 34.85], [139.13, 34.92], [139.11, 34.98], [139.08, 35.05], [139.09, 35.11],
      [139.14, 35.20], [139.17, 35.25], [139.28, 35.30], [139.40, 35.32], [139.48, 35.31],
      [139.55, 35.30], [139.58, 35.27], [139.60, 35.21], [139.61, 35.16], [139.63, 35.13],
      [139.67, 35.14], [139.72, 35.18], [139.74, 35.25], [139.69, 35.28], [139.65, 35.32],
      [139.65, 35.38], [139.67, 35.43], [139.70, 35.47], [139.74, 35.50], [139.745, 35.53],
      [139.755, 35.575], [139.77, 35.60], [139.79, 35.625], [139.83, 35.635], [139.87, 35.64],
      [139.92, 35.645], [139.98, 35.68], [140.04, 35.65], [140.08, 35.61], [140.10, 35.56],
      [140.07, 35.52], [140.00, 35.48], [139.95, 35.43], [139.90, 35.38], [139.86, 35.34],
      [139.80, 35.31], [139.82, 35.25], [139.83, 35.18], [139.82, 35.13], [139.84, 35.05],
      [139.82, 34.98], [139.86, 34.92], [139.90, 34.90], [139.96, 34.95], [140.05, 35.05],
      [140.14, 35.12], [140.25, 35.13], [140.32, 35.16], [140.40, 35.25], [140.42, 35.32],
      [140.48, 35.42], [140.56, 35.55], [140.66, 35.64], [140.76, 35.68], [140.87, 35.71],
      [140.84, 35.76], [140.78, 35.82], [140.70, 35.92], [140.64, 36.02], [140.60, 36.15],
      [140.58, 36.30], [140.60, 36.40], [140.64, 36.52], [140.70, 36.80], [137.30, 36.80],
    ],
    // 羽田空港の埋立地
    [[139.750, 35.538], [139.762, 35.570], [139.790, 35.568], [139.808, 35.540], [139.804, 35.529], [139.770, 35.528]],
    // 羽田 D滑走路の人工島
    [[139.807, 35.522], [139.812, 35.518], [139.836, 35.539], [139.831, 35.545]],
    // 伊豆大島
    [[139.36, 34.78], [139.40, 34.80], [139.45, 34.77], [139.45, 34.71], [139.40, 34.67], [139.36, 34.70]],
    // 利島
    [[139.27, 34.53], [139.30, 34.53], [139.30, 34.51], [139.27, 34.51]],
  ],

  water: [
    // 霞ヶ浦
    [[140.22, 36.05], [140.32, 36.12], [140.42, 36.08], [140.52, 35.97], [140.45, 35.93], [140.35, 35.98]],
  ],

  cities: [
    { name: '東京', lat: 35.69, lon: 139.70 },
    { name: '横浜', lat: 35.45, lon: 139.60 },
    { name: '千葉', lat: 35.61, lon: 140.12 },
    { name: 'さいたま', lat: 35.86, lon: 139.65 },
    { name: 'つくば', lat: 36.08, lon: 140.11 },
    { name: '水戸', lat: 36.37, lon: 140.47 },
    { name: '熊谷', lat: 36.15, lon: 139.39 },
    { name: '八王子', lat: 35.66, lon: 139.32 },
    { name: '甲府', lat: 35.66, lon: 138.57 },
    { name: '富士山', lat: 35.36, lon: 138.73 },
    { name: '静岡', lat: 34.98, lon: 138.38 },
    { name: '小田原', lat: 35.26, lon: 139.15 },
    { name: '銚子', lat: 35.73, lon: 140.86 },
    { name: '館山', lat: 34.99, lon: 139.87 },
  ],

  fixes: {
    // 無線施設
    TLE: { lat: 36.02111, lon: 140.20556, type: 'vor' }, // 阿見
    SYE: { lat: 36.01083, lon: 139.83917, type: 'vor' }, // 関宿
    KZE: { lat: 35.40250, lon: 139.90333, type: 'vor' }, // 木更津
    PQE: { lat: 34.94639, lon: 139.89556, type: 'vor' }, // 館山
    XAC: { lat: 34.71222, lon: 139.41389, type: 'vor' }, // 大島
    OSE: { lat: 34.78778, lon: 139.36472, type: 'vor' },
    OJC: { lat: 35.18361, lon: 140.37083, type: 'vor' }, // 御宿
    TYE: { lat: 35.78361, lon: 140.26306, type: 'vor' }, // 佐倉
    SNE: { lat: 35.93472, lon: 139.98139, type: 'vor' },
    HYE: { lat: 35.25583, lon: 139.58750, type: 'vor' },
    CVC: { lat: 35.72639, lon: 140.79944, type: 'vor' }, // 銚子
    // RNAV の Fix
    ACELA: { lat: 36.12022, lon: 140.32211 },
    ADDUM: { lat: 34.89153, lon: 140.23908 },
    ARIES: { lat: 35.93539, lon: 140.25164 },
    ARLON: { lat: 35.25703, lon: 139.98328 },
    ASPEN: { lat: 35.58083, lon: 140.50781 },
    AWARD: { lat: 34.99292, lon: 140.16839 },
    BACON: { lat: 35.53194, lon: 140.20419 },
    BALAN: { lat: 35.60492, lon: 139.99106 },
    BAYGE: { lat: 35.42650, lon: 139.72428 },
    BEACH: { lat: 35.45617, lon: 140.65636 },
    BEAMS: { lat: 35.59250, lon: 140.53142 },
    BETEL: { lat: 35.53133, lon: 140.77506 },
    BLITZ: { lat: 35.12553, lon: 140.34456 },
    BOXER: { lat: 35.87028, lon: 140.33100 },
    BRASS: { lat: 35.39847, lon: 140.25044 },
    CACAO: { lat: 35.37022, lon: 139.92503 },
    CAMEL: { lat: 35.28839, lon: 139.98272 },
    CLOAK: { lat: 35.26333, lon: 140.03561 },
    CLUST: { lat: 35.86414, lon: 140.74483 },
    CORGI: { lat: 35.50886, lon: 140.59144 },
    COUPE: { lat: 35.61561, lon: 140.21606 },
    CREAM: { lat: 35.29539, lon: 140.10344 },
    CREEK: { lat: 35.94539, lon: 140.27656 },
    CUPID: { lat: 35.49175, lon: 141.09925 },
    CURRY: { lat: 35.85858, lon: 140.20975 },
    CUTIE: { lat: 35.46342, lon: 140.24019 },
    DAISY: { lat: 35.49747, lon: 140.56764 },
    DAIYA: { lat: 35.63053, lon: 139.97719 },
    DARKS: { lat: 35.57078, lon: 139.98414 },
    DATUM: { lat: 35.71656, lon: 140.14008 },
    DENNY: { lat: 35.80800, lon: 140.09900 },
    DREAD: { lat: 36.06644, lon: 139.98247 },
    DREAM: { lat: 35.49283, lon: 140.71042 },
    GEMIN: { lat: 35.96072, lon: 140.41408 },
    HATBA: { lat: 35.43983, lon: 139.72108 },
    HILLS: { lat: 35.76472, lon: 139.72783 },
    JELLY: { lat: 35.69239, lon: 140.73881 },
    JYOGA: { lat: 35.14603, lon: 139.52636 },
    JYOSO: { lat: 36.27956, lon: 139.85264 },
    KAIHO: { lat: 35.31606, lon: 139.77844 },
    KAIJI: { lat: 35.73600, lon: 139.96850 },
    KAMAT: { lat: 35.56489, lon: 139.69692 },
    KANEK: { lat: 35.81092, lon: 139.33164 },
    KUJYU: { lat: 35.35111, lon: 140.45550 },
    LARKS: { lat: 36.03608, lon: 140.23922 },
    LD223: { lat: 35.58542, lon: 140.03306 },
    LD224: { lat: 35.54792, lon: 140.03333 },
    LD225: { lat: 35.43725, lon: 139.89817 },
    LOCUP: { lat: 35.45522, lon: 139.93569 },
    LUPUS: { lat: 35.79608, lon: 139.46006 },
    MARCH: { lat: 36.03647, lon: 140.28856 },
    MELON: { lat: 35.84919, lon: 140.86422 },
    METIS: { lat: 35.99600, lon: 140.23972 },
    MIURA: { lat: 35.08392, lon: 139.77397 },
    NANSO: { lat: 35.10711, lon: 139.97811 },
    NORMA: { lat: 35.98356, lon: 140.54833 },
    NYLON: { lat: 35.67181, lon: 140.15553 },
    OPPAR: { lat: 35.37103, lon: 139.73456 },
    PAPAS: { lat: 35.37819, lon: 140.94961 },
    PHLOX: { lat: 35.76572, lon: 140.37947 },
    PIXUS: { lat: 36.11903, lon: 140.17644 },
    PLOKY: { lat: 35.72319, lon: 140.80969 },
    PLUTO: { lat: 35.60892, lon: 139.96022 },
    SAMMY: { lat: 35.59075, lon: 140.34500 },
    SCREW: { lat: 36.05033, lon: 139.90011 },
    SEKID: { lat: 35.65706, lon: 139.47486 },
    SOHSA: { lat: 35.67547, lon: 140.62992 },
    SQUAD: { lat: 36.10997, lon: 139.99256 },
    STEAM: { lat: 35.93147, lon: 139.95233 },
    STONE: { lat: 36.27958, lon: 140.25678 },
    TAURA: { lat: 35.31281, lon: 139.74647 },
    TETRA: { lat: 35.77400, lon: 140.26550 },
    TOADS: { lat: 36.04703, lon: 140.17042 },
    TORAM: { lat: 35.61022, lon: 139.83639 },
    TWINS: { lat: 35.83217, lon: 140.62611 },
    UMUKI: { lat: 35.20531, lon: 139.81367 },
    URAGA: { lat: 35.23089, lon: 139.83358 },
    VENUS: { lat: 35.25519, lon: 140.74075 },
    VIXEN: { lat: 35.54008, lon: 140.73072 },
    WELDA: { lat: 35.49483, lon: 139.99908 },
    YANAG: { lat: 35.48458, lon: 139.50139 },
  },

  airports: {
    RJTT: {
      name: '羽田', short: 'HND', elev: 20,
      runways: [
        { ids: ['34L', '16R'], thr: [35.5400, 139.7800], hdg: 330, len: 3000 },
        { ids: ['34R', '16L'], thr: [35.5340, 139.8020], hdg: 330, len: 3360 },
        { ids: ['04', '22'], thr: [35.5360, 139.7560], hdg: 35, len: 2500 },
        { ids: ['05', '23'], thr: [35.5245, 139.8110], hdg: 42, len: 2500 },
      ],
    },
    RJAA: {
      name: '成田', short: 'NRT', elev: 140,
      runways: [
        { ids: ['34L', '16R'], thr: [35.7495, 140.3852], hdg: 329.7, len: 4000 },
        { ids: ['34R', '16L'], thr: [35.7803, 140.3950], hdg: 329.7, len: 2500 },
      ],
    },
  },

  // STAR に書かれた速度制限 (この Fix に近づいたら、ここ以降はこの速度以下)
  speedLimits: { STONE: 250, ADDUM: 230, LD225: 220, MARCH: 185 },

  arrivalAlts: [12000, 13000, 14000],
  departureAlt: { initial: 4000, exit: 10000 },

  departures: [
    // 羽田
    { apt: 'RJTT', name: 'PLUTO', exit: 'SYE', exitAlt: 12000, weight: 2,
      turn: { '34R': 'R', '05': 'R', '16L': 'L', '16R': 'L' },
      route: { default: ['TORAM', 'PLUTO', 'KAIJI', 'SYE'], '16L': ['WELDA', 'PLUTO', 'KAIJI', 'SYE'],
        '16R': ['WELDA', 'PLUTO', 'KAIJI', 'SYE'], '05': ['PLUTO', 'KAIJI', 'SYE'] } },
    { apt: 'RJTT', name: 'SEKID', exit: 'SEKID', exitAlt: 13000, weight: 2, turn: { '34R': 'R', '05': 'R' },
      route: { default: ['TORAM', 'PLUTO', 'KAIJI', 'HILLS', 'SEKID'], '16R': ['HATBA', 'KAMAT', 'SEKID'],
        '16L': ['WELDA', 'PLUTO', 'KAIJI', 'HILLS', 'SEKID'], '05': ['LOCUP', 'KAMAT', 'SEKID'] } },
    { apt: 'RJTT', name: 'YANAG', exit: 'YANAG', exitAlt: 11000, weight: 2, turn: { '34R': 'R', '05': 'R' },
      route: { default: ['LOCUP', 'BAYGE', 'YANAG'], '16R': ['BAYGE', 'YANAG'], '16L': ['BAYGE', 'YANAG'] } },
    { apt: 'RJTT', name: 'JYOGA', exit: 'JYOGA', exitAlt: 13000, weight: 3, turn: { '34R': 'R', '05': 'R' },
      route: { default: ['LOCUP', 'TAURA', 'JYOGA'], '16R': ['TAURA', 'JYOGA'], '16L': ['TAURA', 'JYOGA'] } },
    { apt: 'RJTT', name: 'MIURA', exit: 'MIURA', exitAlt: 9000, weight: 2, turn: { '34R': 'R', '05': 'R' },
      route: { default: ['LOCUP', 'URAGA', 'MIURA'], '16R': ['URAGA', 'MIURA'], '16L': ['URAGA', 'MIURA'] } },
    { apt: 'RJTT', name: 'KANEK', exit: 'KANEK', exitAlt: 15000, weight: 1, turn: { '34R': 'R' },
      route: { default: ['TORAM', 'PLUTO', 'KAIJI', 'HILLS', 'LUPUS', 'KANEK'],
        '16L': ['WELDA', 'PLUTO', 'KAIJI', 'HILLS', 'LUPUS', 'KANEK'],
        '16R': ['WELDA', 'PLUTO', 'KAIJI', 'HILLS', 'LUPUS', 'KANEK'],
        '05': ['PLUTO', 'KAIJI', 'HILLS', 'LUPUS', 'KANEK'] } },
    // 成田
    { apt: 'RJAA', name: 'TETRA', exit: 'TETRA', exitAlt: 6000, weight: 2, route: ['TETRA'] },
    { apt: 'RJAA', name: 'JYOSO', exit: 'JYOSO', exitAlt: 12000, weight: 2, route: ['BOXER', 'ARIES', 'JYOSO'] },
    { apt: 'RJAA', name: 'PAPAS', exit: 'PAPAS', exitAlt: 11000, weight: 2,
      route: { default: ['PAPAS'], '16L': ['ASPEN', 'PAPAS'] } },
    { apt: 'RJAA', name: 'CUPID', exit: 'CUPID', exitAlt: 11000, weight: 2,
      route: { default: ['CUPID'], '16L': ['ASPEN', 'CUPID'] } },
    { apt: 'RJAA', name: 'BAY', exit: 'KZE', exitAlt: 11000, weight: 1,
      route: { default: ['SAMMY', 'KZE'], '16L': ['KUJYU', 'KZE'] } },
  ],

  configs: {
    north: {
      name: '北風運用',
      airports: {
        RJTT: { arr: ['34L', '34R'], dep: ['05', '34R'] },
        RJAA: { arr: ['34L'], dep: ['34R'] },
      },
      arrivals: [
        { dest: 'RJTT', rwy: '34L', name: 'CREAM', from: [350, 20, 45], weight: 3,
          route: ['STONE', 'TLE', 'CURRY', 'COUPE', 'CUTIE', 'CREAM'] },
        { dest: 'RJTT', rwy: '34R', name: 'CACAO', from: [350, 20, 45], weight: 1,
          route: ['STONE', 'TLE', 'CURRY', 'COUPE', 'CUTIE', 'CREAM', 'CLOAK', 'CAMEL', 'CACAO'] },
        { dest: 'RJTT', rwy: '34L', name: 'ARLON', from: [250, 210, 170], weight: 3,
          route: ['ADDUM', 'AWARD', 'ARLON'] },
        { dest: 'RJAA', rwy: '34L', name: 'DAISY', from: [60, 30, 90], weight: 2,
          route: ['MELON', 'PLOKY', 'VIXEN', 'DREAM', 'BEACH', 'DAISY'] },
        { dest: 'RJAA', rwy: '34L', name: 'CORGI', from: [200, 240, 150], weight: 2,
          route: ['VENUS', 'CORGI'] },
      ],
    },
    south: {
      name: '南風運用',
      airports: {
        RJTT: { arr: ['22', '23'], dep: ['16L', '16R'] },
        RJAA: { arr: ['16R'], dep: ['16L'] },
      },
      arrivals: [
        { dest: 'RJTT', rwy: '22', name: 'DATUM', from: [350, 20, 45], weight: 2,
          route: ['STONE', 'DREAD', 'DENNY', 'DATUM'] },
        { dest: 'RJTT', rwy: '22', name: 'STEAM', from: [350, 20, 45], weight: 1,
          route: ['STONE', 'SQUAD', 'SCREW', 'STEAM'] },
        { dest: 'RJTT', rwy: '23', name: 'BACON', from: [250, 210, 170], weight: 2,
          route: ['ADDUM', 'BLITZ', 'BRASS', 'BACON'] },
        { dest: 'RJTT', rwy: '22', name: 'NYLON', from: [250, 210, 170], weight: 1,
          route: ['ADDUM', 'BLITZ', 'BRASS', 'NYLON'] },
        { dest: 'RJTT', rwy: '22', name: 'DARKS', from: [250, 210, 170], weight: 1,
          route: ['ADDUM', 'AWARD', 'NANSO', 'UMUKI', 'KAIHO', 'LD225', 'LD224', 'DARKS'] },
        { dest: 'RJTT', rwy: '23', name: 'BALAN', from: [250, 210, 170], weight: 1,
          route: ['ADDUM', 'AWARD', 'NANSO', 'UMUKI', 'KAIHO', 'LD225', 'LD224', 'LD223', 'BALAN'] },
        { dest: 'RJAA', rwy: '16R', name: 'PIXUS', from: [60, 30, 90], weight: 2,
          route: ['MELON', 'CLUST', 'NORMA', 'ACELA', 'PIXUS'] },
        { dest: 'RJAA', rwy: '16R', name: 'MARCH', from: [200, 240, 150], weight: 2,
          route: ['VENUS', 'BETEL', 'CVC', 'TWINS', 'GEMIN', 'MARCH'] },
      ],
    },
  },
};

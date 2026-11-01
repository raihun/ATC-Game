// 座標計算の小道具。ゲーム内の平面座標は NM 単位 (x = 東, y = 北)
window.ATC = window.ATC || {};
(function (ATC) {
  'use strict';
  const DEG = Math.PI / 180;

  function norm360(h) { return ((h % 360) + 360) % 360; }

  // a から b への最短の角度差 (-180..180)
  function angleDiff(a, b) {
    const d = norm360(b - a);
    return d > 180 ? d - 360 : d;
  }

  function bearing(from, to) { return norm360(Math.atan2(to.x - from.x, to.y - from.y) / DEG); }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function unit(hdg) { return { x: Math.sin(hdg * DEG), y: Math.cos(hdg * DEG) }; }

  function offset(p, hdg, d) {
    const u = unit(hdg);
    return { x: p.x + u.x * d, y: p.y + u.y * d };
  }

  function distToSegment(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2)) : 0;
    return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
  }

  function distToPolyline(p, pts) {
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i - 1], pts[i]));
    return best;
  }

  // 滑走路から見た位置: along = 進入側への距離(NM), xt = 進入方向に対して右が正の横ずれ(NM)
  function runwayFrame(p, rw) {
    const u = unit(rw.course);
    const dx = p.x - rw.x, dy = p.y - rw.y;
    return { along: -(dx * u.x + dy * u.y), xt: dx * u.y - dy * u.x };
  }

  // 緯度経度 → 地図中心を原点とする平面座標 (正距円筒の簡易投影)
  function makeProjection(b) {
    const lat0 = (b.north + b.south) / 2, lon0 = (b.east + b.west) / 2;
    const k = Math.cos(lat0 * DEG) * 60;
    return { toXY: (lat, lon) => ({ x: (lon - lon0) * k, y: (lat - lat0) * 60 }) };
  }

  ATC.geo = { DEG, norm360, angleDiff, bearing, dist, unit, offset, distToPolyline, runwayFrame, makeProjection };
})(window.ATC);

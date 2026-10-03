#!/usr/bin/env python3
"""Simplify OCHA COD-AB adm2 (26 districts) and derive adm1 (8 governorates) with consistent shared borders.

Method: topological simplification. Rings are cut into arcs at vertices where the set of features sharing
the vertex changes; each arc is simplified once (Douglas-Peucker, endpoints fixed) so neighbouring districts
keep identical shared borders. adm1 is dissolved from the simplified adm2 rings by cancelling shared edges,
so its outlines coincide with the adm2 outlines.

Run: python3 research/geo/build_boundaries.py
Outputs: build/geo/lbn-adm1.json, build/geo/lbn-adm2.json (GeoJSON, 4-decimal coordinates, < 150 KB total)
"""
import collections
import json
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, "cache", "geo")
OUTDIR = os.path.join(ROOT, "build", "geo")
BUDGET = 140_000


def area(ring):
    return sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1)) / 2


def dp(pts, eps):
    """Iterative Douglas-Peucker on an open polyline; endpoints kept."""
    n = len(pts)
    if n <= 2:
        return list(pts)
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / L if L else math.hypot(px - ax, py - ay)
            if d > best:
                best, bi = d, i
        if best > eps:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]


def load_rings(path):
    d = json.load(open(path, encoding="utf-8"))
    feats = []
    for f in d["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        out = []
        for poly in polys:
            rings = []
            for k, r in enumerate(poly):
                r = [(round(x, 6), round(y, 6)) for x, y in r]
                if r[0] != r[-1]:
                    r.append(r[0])
                a = area(r)
                if (k == 0 and a < 0) or (k > 0 and a > 0):      # RFC 7946: outer CCW, holes CW
                    r.reverse()
                rings.append(r)
            out.append(rings)
        feats.append((f["properties"], out))
    return feats


def simplify(feats, eps):
    owners = collections.defaultdict(set)
    for fi, (_, polys) in enumerate(feats):
        for rings in polys:
            for r in rings:
                for p in r[:-1]:
                    owners[p].add(fi)
    cache = {}

    def simp_arc(pts):
        key = tuple(pts)
        rkey = tuple(reversed(pts))
        if rkey in cache:
            return list(reversed(cache[rkey]))
        if key not in cache:
            cache[key] = dp(pts, eps)
        return cache[key]

    new = []
    for fi, (props, polys) in enumerate(feats):
        npolys = []
        for rings in polys:
            nr_list = []
            for ri, r in enumerate(rings):
                pts = r[:-1]
                n = len(pts)
                node = [owners[pts[i]] != owners[pts[i - 1]] or owners[pts[i]] != owners[pts[(i + 1) % n]] for i in range(n)]
                if any(node):
                    s = node.index(True)
                    pts = pts[s:] + pts[:s]
                    node = node[s:] + node[:s]
                    idx = [i for i in range(n) if node[i]] + [n]
                    out = []
                    for a, b in zip(idx, idx[1:]):
                        seg = pts[a:b] + [pts[b % n]]
                        out += simp_arc(seg)[:-1]
                    shared = any(len(owners[p]) > 1 for p in pts)
                else:                                              # isolated ring: split at the farthest vertex
                    m = max(range(n), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
                    out = dp(pts[: m + 1], eps)[:-1] + dp(pts[m:] + [pts[0]], eps)[:-1]
                    shared = False
                out = [(round(x, 4), round(y, 4)) for x, y in out]
                ded = [p for i, p in enumerate(out) if p != out[i - 1]]
                if len(ded) < 3 or (not shared and abs(area(ded + [ded[0]])) < 6e-5):
                    if ri == 0:
                        nr_list = None
                        break
                    continue
                nr_list.append(ded + [ded[0]])
            if nr_list:
                npolys.append(nr_list)
        new.append((props, npolys))
    return new


def self_intersections(rings):
    """Count proper segment crossings inside each ring (cheap sanity check on the simplification)."""
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    bad = 0
    for r in rings:
        segs = list(zip(r, r[1:]))
        for i in range(len(segs)):
            for j in range(i + 2, len(segs)):
                if i == 0 and j == len(segs) - 1:
                    continue
                p1, p2 = segs[i]
                p3, p4 = segs[j]
                if (max(p1[0], p2[0]) < min(p3[0], p4[0]) or max(p3[0], p4[0]) < min(p1[0], p2[0])
                        or max(p1[1], p2[1]) < min(p3[1], p4[1]) or max(p3[1], p4[1]) < min(p1[1], p2[1])):
                    continue
                d1, d2, d3, d4 = cross(p1, p2, p3), cross(p1, p2, p4), cross(p3, p4, p1), cross(p3, p4, p2)
                if d1 * d2 < 0 and d3 * d4 < 0:
                    bad += 1
    return bad


def dissolve(groups):
    """groups: {key: [polys]} -> {key: polys}; cancels shared edges, chains the remainder into rings."""
    res = {}
    for key, polys in groups.items():
        edges = collections.Counter()
        for rings in polys:
            for r in rings:
                for a, b in zip(r, r[1:]):
                    edges[(a, b)] += 1
        live = {e for e in edges if (e[1], e[0]) not in edges}
        nxt = collections.defaultdict(list)
        for a, b in live:
            nxt[a].append(b)
        rings = []
        while nxt:
            start = next(iter(nxt))
            ring = [start]
            cur = start
            while True:
                cands = nxt[cur]
                b = cands.pop()
                if not cands:
                    del nxt[cur]
                ring.append(b)
                cur = b
                if cur == start:
                    break
                if cur not in nxt:
                    break
            if ring[0] == ring[-1] and len(ring) >= 4:
                rings.append(ring)
        outer = [r for r in rings if area(r) > 0]
        holes = [r for r in rings if area(r) < 0]
        polys_out = [[o] for o in outer]
        for h in holes:                                            # attach hole to the outer ring containing it
            for po in polys_out:
                if point_in(h[0], po[0]):
                    po.append(h)
                    break
        res[key] = polys_out
    return res


def point_in(p, ring):
    x, y = p
    ins = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            ins = not ins
    return ins


def to_geojson(items):
    feats = []
    for props, polys in items:
        if not polys:
            continue
        geom = ({"type": "Polygon", "coordinates": polys[0]} if len(polys) == 1
                else {"type": "MultiPolygon", "coordinates": polys})
        feats.append({"type": "Feature", "properties": props, "geometry": geom})
    return {"type": "FeatureCollection", "features": feats}


def dump(obj, path):
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(s)
    return len(s.encode("utf-8"))


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    feats = load_rings(os.path.join(CACHE, "lbn_admin2.geojson"))
    raw = {f[0]["adm2_pcode"]: sum(abs(area(r)) * (1 if k == 0 else -1) for rings in f[1] for k, r in enumerate(rings)) for f in feats}
    chosen = None
    for eps in (0.0003, 0.0005, 0.0008, 0.001, 0.0013, 0.0016, 0.002, 0.0025, 0.003):
        simp = simplify(feats, eps)
        a2 = [({"name": p["adm2_name"], "name_ar": p.get("adm2_name1"), "pcode": p["adm2_pcode"], "adm1": p["adm1_pcode"]}, polys)
              for p, polys in simp]
        groups = collections.defaultdict(list)
        names = {}
        for p, polys in simp:
            groups[p["adm1_pcode"]] += polys
            names[p["adm1_pcode"]] = (p["adm1_name"], p.get("adm1_name1"))
        dis = dissolve(groups)
        a1 = [({"name": names[k][0], "name_ar": names[k][1], "pcode": k}, dis[k]) for k in sorted(dis)]
        g2, g1 = to_geojson(a2), to_geojson(a1)
        total = len(json.dumps(g2, ensure_ascii=False, separators=(",", ":")).encode()) + len(json.dumps(g1, ensure_ascii=False, separators=(",", ":")).encode())
        print("eps", eps, "bytes", total)
        if total <= BUDGET:
            chosen = (eps, g1, g2, simp)
            break
    if not chosen:
        sys.exit("no tolerance fits the budget")
    eps, g1, g2, simp = chosen
    s2 = dump(g2, os.path.join(OUTDIR, "lbn-adm2.json"))
    s1 = dump(g1, os.path.join(OUTDIR, "lbn-adm1.json"))
    bad = sum(self_intersections(r) for _, polys in simp for rings in polys for r in [rings[0]])
    dev = {}
    for (p, polys) in simp:
        a = sum(area(rings[0]) - sum(abs(area(h)) for h in rings[1:]) for rings in polys)
        dev[p["adm2_name"]] = round(100 * (a - raw[p["adm2_pcode"]]) / raw[p["adm2_pcode"]], 2)
    print(json.dumps({"eps_deg": eps, "adm2_bytes": s2, "adm1_bytes": s1, "total_bytes": s1 + s2,
                      "self_intersections": bad, "adm2_features": len(g2["features"]), "adm1_features": len(g1["features"]),
                      "max_area_change_pct": max(abs(v) for v in dev.values())}))


if __name__ == "__main__":
    main()

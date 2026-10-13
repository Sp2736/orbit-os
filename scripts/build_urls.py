"""Builds urls.json: one image URL per deep-sky object in data/deepsky.json.
Usage: python scripts/build_urls.py public/data/deepsky.json public/data/urls.json
Images come from CDS hips2fits (DSS2 colour survey, whole-sky coverage), a cutout
centred on the object's RA/Dec, with field of view scaled from its angular size."""
import json, sys
from urllib.parse import quote

BASE = "https://alasky.cds.unistra.fr/hips-image-services/hips2fits"
HIPS = quote("CDS/P/DSS2/color", safe="")

def url(hips, ra, dec, fov, px):
    return (f"{BASE}?hips={hips}&width={px}&height={px}&fov={fov}"
            f"&projection=TAN&ra={ra}&dec={dec}&format=jpg")

def fov_for(size_arcmin):
    # object fills roughly 40% of the frame; clamp to sane limits (degrees)
    f = (size_arcmin or 6) * 2.5 / 60
    return round(min(max(f, 0.08), 10), 3)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python build_urls.py <deepsky.json> <urls.json>")
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    d = json.load(open(src, "r", encoding="utf-8"))
    col = {c: i for i, c in enumerate(d["cols"])}
    out = {}
    for r in d["rows"]:
        oid = r[col["id"]]
        ra, dec = round(r[col["raDeg"]], 5), round(r[col["decDeg"]], 5)
        fov = fov_for(r[col["sizArcmin"]])
        if oid in out:  # repeated ids are sub-components (NED01...); keep the parent row
            continue
        out[oid] = {
            "image": url(HIPS, ra, dec, fov, 512),
            "thumb": url(HIPS, ra, dec, fov, 160),
        }
    json.dump({"source": "CDS hips2fits / DSS2 (STScI/POSS-II/UKSTU)", "count": len(out), "objects": out},
              open(dst, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print(len(out), "objects ->", dst)


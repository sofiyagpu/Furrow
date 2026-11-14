"""Post-process build/furrow.pptx -> Furrow.pptx: theme colours and fonts, wipe transitions, auto-playing builds,
the crawl video set to play on its own, blank scatter points removed. Plain stdlib.
    python animate.py
"""
import json
import re
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC, DST = HERE / "build" / "furrow.pptx", HERE / "Furrow.pptx"
cfg = json.loads((HERE / "build" / "anim.json").read_text())
PRESET = {"fade": (10, 0), "zoom": (53, 16), "rise": (42, 0), "wipeR": (22, 8), "wipeU": (22, 4)}


class Ids:
    def __init__(self):
        self.n = 2  # 1 = root, 2 = main sequence

    def __call__(self):
        self.n += 1
        return self.n


def tgt(spid):
    return f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'


def anim_prop(nid, spid, attr, a, b, dur):
    return (f'<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="{nid()}" dur="{dur}" fill="hold"/>{tgt(spid)}'
            f'<p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst>'
            f'<p:tav tm="0"><p:val><p:strVal val="{a}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="{b}"/></p:val></p:tav>'
            f'</p:tavLst></p:anim>')


def effect(nid, fx, spid, dur, delay, first, dy=0.06):
    pid, sub = PRESET[fx]
    body = (f'<p:set><p:cBhvr><p:cTn id="{nid()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>{tgt(spid)}'
            f'<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>')
    if fx == "zoom":
        body += anim_prop(nid, spid, "ppt_w", "0", "#ppt_w", dur) + anim_prop(nid, spid, "ppt_h", "0", "#ppt_h", dur)
    if fx == "rise":
        body += anim_prop(nid, spid, "ppt_y", f"#ppt_y+{dy}", "#ppt_y", dur)
    filt = {"wipeR": "wipe(left)", "wipeU": "wipe(up)"}.get(fx, "fade")
    body += f'<p:animEffect transition="in" filter="{filt}"><p:cBhvr><p:cTn id="{nid()}" dur="{dur}"/>{tgt(spid)}</p:cBhvr></p:animEffect>'
    node = "afterEffect" if first else "withEffect"
    return (f'<p:par><p:cTn id="{nid()}" presetID="{pid}" presetClass="entr" presetSubtype="{sub}" fill="hold" grpId="0" nodeType="{node}" decel="100000">'
            f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>')


def media(nid, spid, dur):
    return (f'<p:par><p:cTn id="{nid()}" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="afterEffect">'
            f'<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr>'
            f'<p:cTn id="{nid()}" dur="{dur}" fill="hold"/>{tgt(spid)}</p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par>')


def timing(xml, steps):
    ids = dict((name, spid) for spid, name in re.findall(r'<p:cNvPr id="(\d+)" name="([^"]*)"', xml))
    kind = {}
    for tag, spid in re.findall(r'<p:(sp|pic|graphicFrame|cxnSp)>\s*<p:nv\w+>\s*<p:cNvPr id="(\d+)"', xml):
        kind[spid] = tag
    nid = Ids()
    pars, extra, t, first = [], "", 0, True
    for st in steps:
        if "media" in st:
            spid = ids[st["media"]]
            pars.append(media(nid, spid, st["dur"]))
            extra = (f'<p:video><p:cMediaNode vol="80000"><p:cTn id="{{VID}}" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst>'
                     f'</p:cTn>{tgt(spid)}</p:cMediaNode></p:video>')
            first = False
            continue
        start = max(0, t + st.get("gap", 0))
        end = start
        for k, name in enumerate(st["names"]):
            if name not in ids:
                raise KeyError(f"no shape named {name}")
            d = start + k * st.get("stagger", 0)
            pars.append(effect(nid, st["fx"], ids[name], st["dur"], d, first, st.get("dy", 0.06)))
            first = False
            end = max(end, d + st["dur"])
        t = end
    group_a, group_b = nid(), nid()
    seq = (f'<p:par><p:cTn id="{group_a}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>'
           f'</p:stCondLst><p:childTnLst><p:par><p:cTn id="{group_b}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
           + "".join(pars) + '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>')
    if extra:
        extra = extra.replace("{VID}", str(nid()))
    animated = sorted({ids[n] for st in steps for n in st.get("names", [])}, key=int)
    bld = "".join(f'<p:bldP spid="{s}" grpId="0" animBg="1"/>' if kind.get(s) == "sp" else
                  (f'<p:bldGraphic spid="{s}" grpId="0"><p:bldAsOne/></p:bldGraphic>' if kind.get(s) == "graphicFrame" else "")
                  for s in animated)
    out = ('<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
           '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' + seq +
           '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
           '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>' + extra +
           '</p:childTnLst></p:cTn></p:par></p:tnLst>' + (f'<p:bldLst>{bld}</p:bldLst>' if bld else "") + '</p:timing>')
    return out


MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
P14 = 'xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"'


def transition(n):
    """PowerPoint 2010+ 'Fly Through' between slides, like a jump to hyperspace; fade through black on the ends.
    Older readers take the plain fade in mc:Fallback."""
    if cfg["trans"].get(str(n)) == "fade":
        return '<p:transition spd="slow"><p:fade thruBlk="1"/></p:transition>'
    return (f'<mc:AlternateContent {MC}><mc:Choice {P14} Requires="p14">'
            '<p:transition spd="slow" p14:dur="1400"><p14:flythrough/></p:transition></mc:Choice>'
            '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')


def theme(xml):
    th = cfg["theme"]
    cols = th["colors"]
    order = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]
    scheme = f'<a:clrScheme name="{th["name"]}">' + "".join(f'<a:{k}><a:srgbClr val="{cols[k]}"/></a:{k}>' for k in order) + "</a:clrScheme>"
    xml = re.sub(r"<a:clrScheme .*?</a:clrScheme>", scheme, xml, flags=re.S)
    xml = re.sub(r'(<a:majorFont>\s*<a:latin typeface=")[^"]*', rf'\g<1>{th["headFontFace"]}', xml)
    xml = re.sub(r'(<a:minorFont>\s*<a:latin typeface=")[^"]*', rf'\g<1>{th["bodyFontFace"]}', xml)
    return re.sub(r'(<a:theme [^>]*name=")[^"]*', rf'\g<1>{th["name"]}', xml)


def main():
    zin = zipfile.ZipFile(SRC)
    with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename.endswith("/"):
                continue
            data = zin.read(item.filename)
            name = item.filename
            if name.startswith("ppt/theme/theme") and name.endswith(".xml"):
                data = theme(data.decode()).encode()
            elif re.fullmatch(r"ppt/slides/slide\d+\.xml", name):
                n = int(re.search(r"(\d+)", name.split("/")[-1]).group(1))
                xml = data.decode()
                steps = cfg["anim"].get(str(n))
                add = transition(n) + (timing(xml, steps) if steps else "")
                xml = xml.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + add, 1)
                data = xml.encode()
            elif re.fullmatch(r"ppt/charts/chart\d+\.xml", name):
                data = re.sub(rb'<c:pt idx="\d+"><c:v></c:v></c:pt>', b"", data)
            zout.writestr(item, data, compress_type=zipfile.ZIP_STORED if name.endswith(".mp4") else zipfile.ZIP_DEFLATED)
    print("wrote", DST)


if __name__ == "__main__":
    main()

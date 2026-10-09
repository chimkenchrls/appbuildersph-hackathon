#!/usr/bin/env python3
"""Build the full-body Kwagi used in the mobile app.

One set of vector parts is the source for:
  - src/components/kwagi/KwagiArt.tsx   layered react-native-svg components
  - assets/mascot/kwagi-full.svg        static reference of the same drawing

The drawing follows the owner's full-body design in
assets/mascot/reference/kwagi-fullbody-reference.png.
Layers are split by what moves: the viewer's-right wing waves, the open eyes blink.

Usage: python3 scripts/build_kwagi_app.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Drawn in the reference image's own 1024-unit coordinates.
VIEWBOX = "64 40 896 940"
# Shoulder joint the waving wing turns around, in drawing units.
PIVOT = (728, 622)

TEAL, TEAL_LIGHT, TEAL_DARK = "#346A74", "#3F7A80", "#2A5861"
MINT, MINT_SHADE, AMBER, AMBER_DARK, WHITE = "#CBECCF", "#A6D0B4", "#E68A1D", "#C97514", "#FBF8EC"
INK, TIE = "#070B0B", "#292927"
S = f'stroke="{INK}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"'
CX = 512  # centre line


def mirror(d):
    """Mirror an absolute-coordinate path across the centre line."""
    out, is_x = [], True
    for token in re.findall(r"[A-Za-z]|-?\d+(?:\.\d+)?", d):
        if token.isalpha():
            out.append(token); is_x = True
        else:
            out.append(f"{2 * CX - float(token):g}" if is_x else token)
            is_x = not is_x
    return " ".join(out)


# Small wing hugging the body: rounded shoulder, three feather tips at the bottom.
WING = ("M300 598 C252 618 222 668 229 720 C232 746 242 766 256 783 C258 771 262 761 266 753 "
        "C268 781 274 801 283 819 C291 801 301 781 311 761 C324 720 330 678 325 636 Z")
WING_SHADE = ("M233 724 C246 738 256 742 266 753 C268 781 274 801 283 819 C291 801 301 781 311 761 "
              "C300 770 290 772 282 770 C262 764 244 748 233 724 Z")
TUFT = ("M378 152 C330 125 280 95 232 65 C232 100 238 130 250 150 C236 140 220 130 205 125 "
        "C212 158 228 185 248 205 C234 206 220 208 207 212 C222 232 245 246 272 250 Z")
TUFT_SHADE = "M250 150 C262 172 282 196 306 214 C286 214 264 210 248 205 C228 185 212 158 205 125 C220 130 236 140 250 150 Z"


def wing(d, shade):
    return f'<path d="{d}" fill="{TEAL}" {S}/><path d="{shade}" fill="{TEAL_DARK}"/><path d="{d}" fill="none" {S}/>'


def foot(side):
    toes = ((372, 15), (402, 0), (434, -12))
    return "".join(
        f'<ellipse cx="{x if side < 0 else 2 * CX - x}" cy="926" rx="15" ry="27" '
        f'transform="rotate({rot * -side} {x if side < 0 else 2 * CX - x} 900)" fill="{AMBER}" {S}/>'
        for x, rot in toes)


def eye_open(cx, look):
    """look is -1 for the viewer's-left eye and 1 for the right; both glance slightly inward."""
    ix, px = cx - 10 * look, cx - 23 * look
    return (f'<circle cx="{cx}" cy="388" r="90" fill="{WHITE}" {S}/>'
            f'<circle cx="{ix}" cy="392" r="77" fill="{AMBER}"/>'
            f'<circle cx="{ix}" cy="392" r="77" fill="none" stroke="{AMBER_DARK}" stroke-width="6"/>'
            f'<circle cx="{px}" cy="380" r="63" fill="{INK}"/>'
            f'<circle cx="{px + 15 * look}" cy="345" r="22" fill="{WHITE}"/>')


def eye_closed(cx):
    return (f'<path d="M{cx - 66} 386 Q{cx} 444 {cx + 66} 386" fill="none" '
            f'stroke="{INK}" stroke-width="11" stroke-linecap="round"/>')


HEAD = ("M512 120 C400 120 290 150 235 230 C185 300 175 400 190 450 C205 530 250 580 300 603 "
        "C400 640 624 640 724 603 C774 580 819 530 834 450 C849 400 839 300 789 230 C734 150 624 120 512 120 Z")
BODY = "M302 590 C278 660 276 760 300 820 C330 890 420 921 512 921 C604 921 694 890 724 820 C748 760 746 660 722 590 Z"

LAYERS = {
    # Feet, torso, belly, tie and the wing that stays still.
    "Body": (
        foot(-1) + foot(1)
        + f'<path d="{BODY}" fill="{TEAL}" {S}/>'
        + f'<path d="M400 612 C355 680 335 760 345 820 C360 880 430 914 512 915 C594 914 664 880 679 820 '
          f'C689 760 669 680 624 612 Z" fill="{MINT}"/>'
        + f'<path d="M347 832 C400 878 624 878 677 832 C664 884 600 914 512 915 C424 914 360 884 347 832 Z" fill="{MINT_SHADE}"/>'
        + f'<path d="{BODY}" fill="none" {S}/>'
        + f'<path d="M366 612 Q512 646 658 612 L550 668 H474 Z" fill="{TIE}" {S}/>'
        + f'<path d="M488 640 H536 L551 663 L538 689 H486 L473 663 Z" fill="{TIE}" {S}/>'
        + f'<path d="M490 691 H534 L556 780 L512 816 L468 780 Z" fill="{TIE}" {S}/>'
        + wing(WING, WING_SHADE)
    ),
    # The viewer's-right wing, drawn at rest. The app rotates this layer to wave.
    "WavingWing": wing(mirror(WING), mirror(WING_SHADE)),
    # Head, tufts, face disc and beak. Sits above the wings so a raised wing tucks behind it.
    "Head": (
        "".join(f'<path d="{t}" fill="{TEAL}" {S}/><path d="{sh}" fill="{TEAL_DARK}"/><path d="{t}" fill="none" {S}/>'
                for t, sh in ((TUFT, TUFT_SHADE), (mirror(TUFT), mirror(TUFT_SHADE))))
        + f'<path d="{HEAD}" fill="{TEAL}" {S}/>'
        + f'<path d="M193 462 C240 556 380 598 512 598 C644 598 784 556 831 462 C822 524 780 580 724 603 '
          f'C624 640 400 640 300 603 C244 580 202 524 193 462 Z" fill="{TEAL_DARK}"/>'
        + f'<path d="{HEAD}" fill="none" {S}/>'
        + "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{TEAL_LIGHT}"/>'
                  for x, y, rx, ry in ((466, 141, 26, 21), (556, 141, 24, 21), (432, 171, 16, 12), (592, 171, 16, 12), (512, 205, 17, 17)))
        + f'<path d="M512 320 C470 260 420 228 372 228 C285 232 218 310 218 400 C218 490 290 552 380 552 '
          f'C430 552 480 535 512 512 C544 535 594 552 644 552 C734 552 806 490 806 400 '
          f'C806 310 739 232 652 228 C604 228 554 260 512 320 Z" fill="{MINT}" {S}/>'
        + eye_closed(362) + eye_closed(662)
        + f'<path d="M512 420 Q486 448 470 490 Q488 520 512 548 Q538 518 554 488 Q540 448 512 420 Z" fill="{AMBER}" {S}/>'
        + f'<path d="M477 494 Q512 508 547 492 Q535 514 512 540 Q490 516 477 494 Z" fill="{AMBER_DARK}"/>'
    ),
    # Open eyes. Hiding this layer shows the closed lids drawn on the head.
    "OpenEyes": eye_open(362, -1) + eye_open(662, 1),
}

TAGS = {"path": "Path", "circle": "Circle", "ellipse": "Ellipse"}


def to_jsx(markup):
    for tag, component in TAGS.items():
        markup = markup.replace(f"<{tag} ", f"<{component} ")
    markup = re.sub(r"([a-z]+)-([a-z])([a-z]*)=", lambda m: f"{m.group(1)}{m.group(2).upper()}{m.group(3)}=", markup)
    return markup.replace("/>", " />\n      ").rstrip()


def write_component():
    parts = []
    for name, markup in LAYERS.items():
        parts.append(
            f"export function Kwagi{name}() {{\n  return (\n    <Svg width=\"100%\" height=\"100%\" viewBox={{KWAGI_VIEWBOX}}>\n"
            f"      {to_jsx(markup)}\n    </Svg>\n  );\n}}\n")
    x, y, w, h = map(float, VIEWBOX.split())
    header = (
        "// Generated by scripts/build_kwagi_app.py. Edit the script, not this file.\n"
        "import Svg, { Circle, Ellipse, Path } from 'react-native-svg';\n\n"
        f"export const KWAGI_VIEWBOX = '{VIEWBOX}';\n"
        f"export const KWAGI_ASPECT_RATIO = {w:g} / {h:g};\n"
        "// Shoulder joint of the waving wing, as a fraction of the drawing's width and height.\n"
        f"export const KWAGI_WING_PIVOT = {{ x: {(PIVOT[0] - x) / w:.4f}, y: {(PIVOT[1] - y) / h:.4f} }};\n\n")
    out = ROOT / "src/components/kwagi/KwagiArt.tsx"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(header + "\n".join(parts))
    return out


def write_svg(path, wing_angle=0, eyes_open=True):
    body = (f'<g id="body">{LAYERS["Body"]}</g>'
            f'<g id="waving-wing" transform="rotate({wing_angle} {PIVOT[0]} {PIVOT[1]})">{LAYERS["WavingWing"]}</g>'
            f'<g id="head">{LAYERS["Head"]}</g>'
            + (f'<g id="open-eyes">{LAYERS["OpenEyes"]}</g>' if eyes_open else ""))
    path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}" role="img" '
                    f'aria-label="Kwagi the owl, full body">{body}</svg>\n')
    return path


if __name__ == "__main__":
    print("wrote", write_component().relative_to(ROOT))
    print("wrote", write_svg(ROOT / "assets/mascot/kwagi-full.svg").relative_to(ROOT))

# Gera o ícone do app e o splash a partir dos próprios sprites do jogo.
#   python tools/make-icons.py
# Saídas: resources/icon-only.png, icon-foreground.png, icon-background.png,
#         splash.png (para @capacitor/assets) e icons/*.png (PWA / web)
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
os.makedirs("resources", exist_ok=True)
os.makedirs("icons", exist_ok=True)

def gradient(size, top, bottom):
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
        d.line([(0, y), (size, y)], fill=c)
    return img


def glow(size, radius, color, alpha):
    g = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    c = size // 2
    d.ellipse([c - radius, c - radius, c + radius, c + radius], fill=color + (alpha,))
    return g.filter(ImageFilter.GaussianBlur(radius * 0.45))


def pine(h):
    """Pinheiro pixelado (silhueta) com h pixels de arte."""
    w = h // 2 + 3
    p = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(p)
    col = (13, 28, 27, 255)
    for L in range(3):
        top = L * h // 4
        bot = top + h // 2
        half = int((w // 2) * (0.5 + L * 0.25))
        d.polygon([(w // 2, top), (w // 2 - half, bot), (w // 2 + half, bot)], fill=col)
    d.rectangle([w // 2 - 1, h - 5, w // 2 + 1, h], fill=col)
    return p


def background(size):
    bg = gradient(size, (14, 30, 38), (22, 52, 40))
    bg.alpha_composite(glow(size, int(size * 0.42), (242, 193, 78), 150))
    bg.alpha_composite(glow(size, int(size * 0.22), (255, 229, 143), 120))
    # vaga-lumes pixelados
    d = ImageDraw.Draw(bg)
    px = size // 64
    import random
    rnd = random.Random(7)
    for _ in range(18):
        x, y = rnd.randrange(size), rnd.randrange(size)
        if abs(x - size / 2) < size * 0.28 and abs(y - size / 2) < size * 0.3:
            continue
        d.rectangle([x, y, x + px, y + px], fill=(255, 245, 184, 230))
    return bg


def outlined(img, color, n=1):
    """Contorno de n pixels de arte ao redor do sprite (antes de ampliar)."""
    w, h = img.size
    out = Image.new("RGBA", (w + 2 * n, h + 2 * n), (0, 0, 0, 0))
    a = img.split()[3]
    for dx in range(-n, n + 1):
        for dy in range(-n, n + 1):
            if dx or dy:
                sil = Image.new("RGBA", img.size, color + (255,))
                sil.putalpha(a)
                out.alpha_composite(sil, (n + dx, n + dy))
    out.alpha_composite(img, (n, n))
    return out


def hero_frame():
    """Quadro 0 do herói (exportado do jogo: resources/hero_guardian_strip.png),
    centralizado num quadrado."""
    strip = Image.open("resources/hero_guardian_strip.png").convert("RGBA")
    f = strip.crop((0, 0, 24, 28))
    sq = Image.new("RGBA", (28, 28), (0, 0, 0, 0))
    sq.alpha_composite(f, (2, 0))
    return sq


def hero(size, scale_frac):
    h = outlined(hero_frame(), (255, 229, 143))
    s = int(size * scale_frac) // h.width * h.width
    return h.resize((s, s), Image.NEAREST)


def icon(size, hero_frac=0.62, with_bg=True):
    img = background(size) if with_bg else Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hr = hero(size, hero_frac)
    # sombra
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse(
        [size // 2 - hr.width // 3, size // 2 + hr.height // 2 - size // 40,
         size // 2 + hr.width // 3, size // 2 + hr.height // 2 + size // 40],
        fill=(0, 0, 0, 120),
    )
    img.alpha_composite(sh)
    img.alpha_composite(hr, ((size - hr.width) // 2, (size - hr.height) // 2 - size // 40))
    return img


# Ícone completo (loja, PWA) e camadas do ícone adaptativo do Android
icon(1024).save("resources/icon-only.png")
background(1024).save("resources/icon-background.png")
icon(1024, hero_frac=0.46, with_bg=False).save("resources/icon-foreground.png")
for s in (192, 512):
    icon(s).convert("RGB").save(f"icons/icon-{s}.png")
# Maskable: herói menor, dentro da zona segura (80%)
icon(512, hero_frac=0.46).convert("RGB").save("icons/maskable-512.png")
# Ícone de alta resolução da Play Store (512×512, sem transparência)
icon(512).convert("RGB").save("resources/playstore-icon-512.png")

# Splash: céu + herói pequeno central
sp = background(2732)
hr = hero(2732, 0.16)
sp.alpha_composite(hr, ((2732 - hr.width) // 2, (2732 - hr.height) // 2))
sp.convert("RGB").save("resources/splash.png")
sp.convert("RGB").save("resources/splash-dark.png")
print("ícones gerados")

# Gera a arte do servidor do Discord a partir do próprio jogo (sprites por código + sons do jogo).
#   python tools/discord/arte.py   → tools/discord/arte/{emoji,figurinhas,sons}/ e capa do evento
# Emojis: 128×128, escala inteira (pixel art nítida) com contorno de tinta para ler no tema claro e escuro.
# Figurinhas: APNG 320×320 (animadas para todo mundo no servidor). Sons: mp3 ≤ 5 s (painel de efeitos).
import os, subprocess, tempfile, shutil, random
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, "arte")
INK = (26, 20, 32, 255)

# nome do emoji → (tira do jogo, quadro)
EMOJIS = {
    "curupira": ("hero_guardian", 0), "caipora": ("hero_huntress", 0), "iara": ("hero_druid", 0), "saci": ("hero_shaman", 0),
    "fulozinha": ("hero_fulozinha", 0), "maedoouro": ("hero_maedoouro", 0), "anhanga": ("hero_anhanga", 0),
    "mapinguari": ("mon_boss", 0), "mula": ("mon_alpha", 0), "caboclo": ("mon_caboclo", 0), "corposeco": ("mon_elder", 0),
    "carranca": ("obj_carranca", 0),
    "fogo": ("ico_el_fire", 0), "gelo": ("ico_el_ice", 0), "raio": ("ico_el_bolt", 0), "vento": ("ico_el_wind", 0),
    "vapor": ("ico_cloud", 0), "cristal": ("ico_heart_ice", 0), "sobrecarga": ("ico_bolt_gold", 0),
    "labareda": ("ico_whirl_fire", 0), "geada": ("ico_orb_frost", 0), "temporal": ("ico_folhas_bolt", 0),
    "moeda": ("ico_coin", 0), "coracao": ("ico_heart", 0), "bau": ("ico_chest", 0), "trofeu": ("ico_trophy", 0),
    "estrela": ("ico_star", 0), "caveira": ("ico_skull", 0), "vagalume": ("ico_firefly_gold", 0), "fogueira": ("ico_bonfire", 0),
    "dash": ("ico_dash", 0), "escudo": ("ico_shield", 0), "ampulheta": ("ico_hourglass", 0), "semente": ("ico_seed", 0),
    "milho": ("ico_corn", 0), "pamonha": ("ico_dish_pamonha", 0), "tapioca": ("ico_dish_tapioca", 0), "moqueca": ("ico_dish_moqueca", 0),
    "tucunare": ("ico_tucunare", 0), "caju": ("ico_caju", 0),
}
# figurinha → (tira, quadros, ms por quadro, emoji de busca, descrição)
WALK = [5, 6, 7, 8, 9, 10, 11, 12]
FIGURINHAS = {
    "Curupira": ("hero_guardian", WALK, 83, "🔥", "O guardião da mata, de pés virados"),
    "Saci": ("hero_shaman", WALK, 77, "🌪️", "Redemoinho travesso, pulando numa perna só"),
    "Iara": ("hero_druid", WALK, 111, "🌊", "A senhora das águas"),
    "Anhangá": ("hero_anhanga", WALK, 83, "🦌", "O cervo branco que protege a caça"),
    "Mapinguari": ("mon_boss", [0, 9, 1, 10], 330, "👹", "O chefe final, tomado pela Podridão"),
}
# som → (arquivo do jogo, emoji, volume)
SONS = {
    "Grito do Mapinguari": ("sfx_boss_roar", "👹", 0.8), "Assobio do Saci": ("sfx_assobio", "🌪️", 0.8),
    "VAPOR!": ("sfx_react_vapor", "☁️", 0.8), "SOBRECARGA!": ("sfx_react_overload", "⚡", 0.8),
    "Subiu de nível": ("sfx_levelup", "⭐", 0.7), "Baú premiado": ("sfx_chest_jackpot", "🎁", 0.7),
    "Galope da Mula": ("sfx_hooves", "🔥", 0.8), "Carranca": ("sfx_carranca", "🗿", 0.8),
}


def exportar(lista):
    tmp = tempfile.mkdtemp()
    subprocess.run(["node", os.path.join(ROOT, "tools", "sprite-export.mjs"), tmp, ",".join(f"{k}:{f}" for k, f in lista)], check=True, capture_output=True)
    return tmp


def contorno(img, cor=INK):
    w, h = img.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    a = img.split()[3].point(lambda v: 255 if v > 0 else 0)
    sil = Image.new("RGBA", img.size, cor)
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        out.paste(sil, (1 + dx, 1 + dy), a)
    out.alpha_composite(img, (1, 1))
    return out


def recorta(img):
    bb = img.getbbox()
    return img.crop(bb) if bb else img


def emojis():
    d = os.path.join(OUT, "emoji"); os.makedirs(d, exist_ok=True)
    tmp = exportar(EMOJIS.values())
    for nome, (tira, q) in EMOJIS.items():
        p = os.path.join(tmp, f"{tira}_{q}.png")
        if not os.path.exists(p):
            print("  sem sprite", tira); continue
        im = contorno(recorta(Image.open(p).convert("RGBA")))
        s = max(1, 128 // max(im.size))
        im = im.resize((im.width * s, im.height * s), Image.NEAREST)
        quad = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        quad.alpha_composite(im, ((128 - im.width) // 2, (128 - im.height) // 2))
        quad.save(os.path.join(d, f"{nome}.png"))
    shutil.rmtree(tmp)
    print(f"  {len(os.listdir(d))} emojis")


def figurinhas():
    d = os.path.join(OUT, "figurinhas"); os.makedirs(d, exist_ok=True)
    pedidos = [(t, q) for (t, qs, *_r) in FIGURINHAS.values() for q in qs]
    tmp = exportar(pedidos)
    for nome, (tira, qs, ms, _e, _d) in FIGURINHAS.items():
        frames = [contorno(Image.open(os.path.join(tmp, f"{tira}_{q}.png")).convert("RGBA")) for q in qs]
        # mesma caixa para todos os quadros (sem tremer)
        W = max(f.width for f in frames); H = max(f.height for f in frames)
        s = max(1, 300 // max(W, H))
        quadros = []
        for f in frames:
            c = Image.new("RGBA", (320, 320), (0, 0, 0, 0))
            big = f.resize((f.width * s, f.height * s), Image.NEAREST)
            # sombra no chão
            sh = Image.new("RGBA", (320, 320), (0, 0, 0, 0))
            ImageDraw.Draw(sh).ellipse([160 - W * s // 3, 160 + H * s // 2 - 10, 160 + W * s // 3, 160 + H * s // 2 + 8], fill=(0, 0, 0, 90))
            c.alpha_composite(sh)
            c.alpha_composite(big, ((320 - W * s) // 2 + (W - f.width) * s // 2, (320 - H * s) // 2 + (H - f.height) * s - 6))
            quadros.append(c)
        arq = os.path.join(d, f"{nome}.png")
        quadros[0].save(arq, save_all=True, append_images=quadros[1:], duration=ms, loop=0, disposal=1, optimize=True)
        print(f"  figurinha {nome}: {len(quadros)} quadros, {os.path.getsize(arq) // 1024} KB")
    shutil.rmtree(tmp)


def sons():
    d = os.path.join(OUT, "sons"); os.makedirs(d, exist_ok=True)
    src = os.path.join(ROOT, "videos", "promo", "audio", "out", "sfx")
    for nome, (sfx, _e, _v) in SONS.items():
        wav = os.path.join(src, f"{sfx}.wav")
        out = os.path.join(d, f"{sfx}.mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-t", "5", "-af", "loudnorm=I=-16:TP=-1.5,afade=t=out:st=4.6:d=0.4", "-ar", "44100", "-b:a", "128k", out], check=True)
        print(f"  som {nome}: {os.path.getsize(out) // 1024} KB")


def capa_evento():
    """Capa do evento do Dia do Saci (800×320): noite na mata, Saci grande, vaga-lumes."""
    W, H = 800, 320
    img = Image.new("RGBA", (W, H))
    dr = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        dr.line([(0, y), (W, y)], fill=(int(11 + 12 * t), int(20 + 30 * t), int(28 + 10 * t), 255))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([W // 2 - 220, H // 2 - 180, W // 2 + 220, H // 2 + 220], fill=(242, 193, 78, 90))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(70)))
    # vaga-lumes atrás dos heróis
    r = random.Random(7)
    dr = ImageDraw.Draw(img)
    for _ in range(40):
        x, y, z = r.randrange(W), r.randrange(H - 60), r.choice([3, 3, 6])
        dr.rectangle([x, y, x + z, y + z], fill=(255, 243, 184, r.randrange(120, 255)))
    tmp = exportar([("hero_shaman", 0), ("hero_guardian", 0), ("hero_druid", 0)])
    for i, (t, x, s) in enumerate([("hero_guardian", 220, 6), ("hero_shaman", 400, 9), ("hero_druid", 580, 6)]):
        sp = contorno(Image.open(os.path.join(tmp, f"{t}_0.png")).convert("RGBA"))
        sp = sp.resize((sp.width * s, sp.height * s), Image.NEAREST)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([x - sp.width // 3, 280, x + sp.width // 3, 300], fill=(0, 0, 0, 110))
        img.alpha_composite(sh)
        img.alpha_composite(sp, (x - sp.width // 2, 290 - sp.height))
    shutil.rmtree(tmp)
    img.convert("RGB").save(os.path.join(OUT, "evento_dia_do_saci.png"))
    print("  capa do evento")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    emojis(); figurinhas(); sons(); capa_evento()

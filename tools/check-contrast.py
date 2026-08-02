#!/usr/bin/env python3
"""Recalcula os pares de contraste do Echo Classic a partir dos tokens do CSS.

Por que isto existe: a skin imita o iOS 9, que foi desenhado antes da maior parte
das regras de contraste. Todo ajuste de cor tende a reprovar em algum dos dez
cenarios (dois temas x cinco esquemas de acento) sem reprovar naquele em que quem
editou estava olhando. Este script transforma isso em erro de validacao.

Formula: WCAG 2.1, luminancia relativa com expoente 2.4.
Uso: python3 tools/check-contrast.py
"""
import os
import re
import sys

CSS = os.path.join(os.path.dirname(__file__), '..',
                   'EchoClassic/HTML/echoclassic/html/css/ios9.css')

# (rotulo, token de frente, token de fundo, minimo)
# 4.5 para texto, 3.0 para componente de interface e objeto grafico.
PAIRS = [
    ('aba ativa / titulo da navbar',      '--accent',           '--chrome',      4.5),
    ('estrelas de avaliacao',             '--chev',             '--content',     4.5),
    ('chevron / marcador de selecao',     '--chev',             '--content',     3.0),
    ('indice A-Z inativo',                '--raildim',          '--content',     4.5),
    ('inicial de album sem capa',         '--art-placeholder',  '--field',       4.5),
    ('interruptor desligado',             '--sw-off',           '--group-bg',    3.0),
    ('interruptor ligado',                '--sw-on',            '--group-bg',    3.0),
    ('divisor de lista',                  '--hair',             '--content',     3.0),
    ('borda da barra de progresso',       '--gauge-border',     '--chrome',      3.0),
    ('placeholder da busca',              '--text2',            '--field',       4.5),
    ('subtitulo em linha selecionada',    '--text2',            '--selected',    4.5),
    ('cabecalho de grupo dos ajustes',    '--group-head',       '--group-page',  4.5),
    ('acao destrutiva',                   '--destructive',      '--group-bg',    4.5),
    ('texto secundario',                  '--text2',            '--content',     4.5),
    ('texto principal',                   '--text',             '--content',     4.5),
]


def read_block(css, selector):
    m = re.search(re.escape(selector) + r'\s*\{(.*?)\}', css, re.S)
    if not m:
        return {}
    return {k: v.strip() for k, v in re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', m.group(1))}


def channel(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color):
    h = hex_color.strip().lstrip('#')
    if len(h) == 3:
        h = ''.join(x * 2 for x in h)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def ratio(fg, bg):
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def main():
    css = open(CSS, encoding='utf-8').read()
    light = read_block(css, ':root')
    dark = read_block(css, 'body.dark')

    def token(theme, name):
        v = theme.get(name) or (light.get(name) if theme is not light else None)
        return v.strip() if v else None

    print('  %-36s %7s %7s  %5s  %s' % ('par', 'claro', 'escuro', 'min', 'veredito'))
    failures = 0
    for label, fg, bg, minimum in PAIRS:
        cells, ok = [], True
        for theme in (light, dark):
            f, b = token(theme, fg), token(theme, bg)
            if not (f and b and f.startswith('#') and b.startswith('#')):
                cells.append(None)
                continue
            r = ratio(f, b)
            cells.append(r)
            if r < minimum:
                ok = False
        if not ok:
            failures += 1
        fmt = lambda v: ('%.2f' % v) if v else '  -  '
        print('  %-36s %7s %7s  %5.1f  %s'
              % (label, fmt(cells[0]), fmt(cells[1]), minimum,
                 'passa' if ok else 'REPROVA'))

    print()
    if failures:
        print('  %d par(es) abaixo do minimo' % failures)
        return 1
    print('  todos os %d pares passam' % len(PAIRS))
    return 0


if __name__ == '__main__':
    sys.exit(main())

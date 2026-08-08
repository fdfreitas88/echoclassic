#!/usr/bin/env python3
"""Recalcula os pares de contraste do Echo Classic a partir dos tokens do CSS.

Por que isto existe: a skin imita o iOS 9, que foi desenhado antes da maior parte
das regras de contraste. Todo ajuste de cor tende a reprovar em algum dos varios
cenarios (temas x esquemas de acento x app/superficie) sem reprovar naquele em
que quem editou estava olhando. Este script transforma isso em erro de validacao.

3.2.6b estendeu a enumeracao: alem de :root e body.dark, agora le todo bloco
[data-color-scheme] e [data-surface-scheme], e testa os blocos de superficie
(data-surface-theme="light"/"dark") como o proprio contexto que representam --
uma superficie clara dentro de um app escuro e vice-versa -- em vez de so os
dois defaults azuis que o script testava antes.

Formula: WCAG 2.1, luminancia relativa com expoente 2.4.
Uso: python3 tools/check-contrast.py
"""
import os
import re
import sys

CSS = os.path.join(os.path.dirname(__file__), '..',
                   'EchoClassic/HTML/echoclassic/html/css/ios9.css')

SCHEMES = ['blue', 'teal', 'crimson', 'indigo', 'amber']

# Tokens que um bloco de esquema pode sobrescrever. Um par so precisa ser
# reexaminado por esquema quando um dos dois lados esta nesta lista -- os
# outros dezoito pares nao mudam de valor entre "blue" e "amber", so entre
# claro e escuro (ou app e superficie), e repeti-los por esquema so inflaria
# a tabela sem testar nada novo.
SCHEME_TOKENS = {'--accent', '--accent-ink', '--selection-accent', '--selection-highlight'}

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
    ('limpar filtro no chip',             '--accent',           '--content',     4.5),
    # Pares novos do painel de filtros. Um token ja existente nao garante par
    # medido: e a combinacao que reprova, e nenhuma linha desta lista cobria
    # texto sobre --accent nem opcao ligada sobre --selected.
    ('numero no funil de filtros',        '--chrome',           '--accent',      4.5),
    ('opcao ligada no painel',            '--text',             '--selected',    4.5),
    ('cabecalho de secao da lista',       '--text2',            '--group-bg',    4.5),
    ('rotulo de grupo do painel',         '--text2',            '--group-page',  4.5),
    ('texto do chip de filtro',           '--text2',            '--content',     4.5),
    ('subtitulo em linha selecionada',    '--text2',            '--selected',    4.5),
    ('cabecalho de grupo dos ajustes',    '--group-head',       '--group-page',  4.5),
    ('acao destrutiva',                   '--destructive',      '--group-bg',    4.5),
    ('texto secundario',                  '--text2',            '--content',     4.5),
    ('texto principal',                   '--text',             '--content',     4.5),
    # WP4 (3.2.6b): a faixa .surface-preview pinta a partir dos tokens da
    # PROPRIA superficie (--chrome/--text/--text2), nao dos tokens do --group-bg
    # dos ajustes -- por isso e um par novo, e nao uma repeticao de
    # 'texto secundario' ou 'cabecalho de secao da lista' acima. O rotulo
    # ("Full player" etc.) usa --text sobre --chrome; o traco decorativo de
    # progresso usa --text2 sobre --chrome. (A ficha --accent/--chrome do
    # circulo de esquema ja e coberta por 'aba ativa / titulo da navbar'.)
    ('rotulo da previa de superficie',    '--text',             '--chrome',      4.5),
    ('traco de progresso na previa',      '--text2',            '--chrome',      3.0),
    # C5 (3.2.6c): a Appearance ficou inline e o accent colour ganhou uma fila
    # de 5 swatches com anel de selecao -- o anel usa --accent (o mesmo token
    # do swatch selecionado, por definicao) sobre --group-bg, porque a fila
    # vive dentro do .sgroup (nunca direto sobre --group-page: o mesmo anel
    # ali da 4.28 para teal claro, que passa 3.0 mas reprova 4.5).
    ('anel do swatch selecionado',        '--accent',           '--group-bg',    3.0),
    # C6 (3.2.6c): .gauge-segmented generalizou para .segmented e passou a
    # cobrir Presentation/Position/Theme, alem do estilo de barra que ja
    # tinha -- o texto do segmento ligado (--accent-ink sobre --accent) nunca
    # tinha par proprio ate agora, apesar de o mesmo estilo já existir em
    # .navbar .segmented .seg.on desde antes desta passada.
    ('texto do segmento ligado',          '--accent-ink',       '--accent',      4.5),
]


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def parse_rules(css):
    """Mapa selector-exato (apos split por virgula e strip) -> dict de
       custom properties declaradas naquele seletor. Uma regra com lista de
       seletores (como 'body.dark,\\n[data-surface-theme="dark"]{...}')
       aplica as mesmas declaracoes a cada seletor da lista -- e assim que o
       bloco escuro combinado do WP2 aparece tanto em 'body.dark' quanto em
       '[data-surface-theme="dark"]' sem duplicar uma linha do CSS. """
    rules = {}
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', css):
        selectors = [s.strip() for s in m.group(1).split(',')]
        decls = {k: v.strip() for k, v in re.findall(r'(--[\w-]+)\s*:\s*([^;]+);', m.group(2))}
        if not decls:
            continue
        for sel in selectors:
            rules.setdefault(sel, {}).update(decls)
    return rules


def merge(base, overrides):
    out = dict(base)
    out.update(overrides)
    return out


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


def pair_relevant(fg, bg, scheme_only):
    if not scheme_only:
        return True
    return fg in SCHEME_TOKENS or bg in SCHEME_TOKENS


def build_contexts(rules):
    root = rules.get(':root', {})
    dark = rules.get('body.dark', {})
    surf_light = rules.get('[data-surface-theme="light"]', {})
    surf_dark = rules.get('[data-surface-theme="dark"]', {})

    contexts = [('app / default (blue)', root, dark, False)]
    for k in SCHEMES:
        contexts.append((
            'app / %s' % k,
            merge(root, rules.get('body[data-color-scheme="%s"]' % k, {})),
            merge(dark, rules.get('body.dark[data-color-scheme="%s"]' % k, {})),
            True
        ))
    contexts.append(('superficie / default (blue)', surf_light, surf_dark, False))
    for k in SCHEMES:
        # Superficie com o PROPRIO tema tambem sobrescrito (o par so aparece
        # quando o proprio elemento traz data-surface-theme="light"/"dark" --
        # ver ios9.css). Este e o caso ja auto-contido: o bloco de tema traz
        # o resto dos tokens junto, entao a base e surf_light/surf_dark.
        contexts.append((
            'superficie+tema / %s' % k,
            merge(surf_light, rules.get('[data-surface-theme="light"][data-surface-scheme="%s"]' % k, {})),
            merge(surf_dark, rules.get('[data-surface-theme="dark"][data-surface-scheme="%s"]' % k, {})),
            True
        ))
        # A combinacao que o defeito relatado pelo coordenador expunha: SO o
        # esquema sobrescrito, tema de superficie continua em 'app' (o
        # atributo data-surface-theme esta ausente do elemento). Sem a
        # correcao, [data-surface-scheme="k"] era incondicional e o par claro
        # caia sobre o chao ESCURO do app (ou vice-versa) sempre que o app
        # ambiente discordava do par. As chaves abaixo sao as mesmas que
        # ios9.css usa para o seletor "sem tema, ambiente X" -- lidas do CSS
        # de verdade, e nao assumidas iguais ao par de app-nivel, para que um
        # hex diferente aqui (por exemplo um typo) reprove sozinho. */
        contexts.append((
            'superficie(sem tema) / %s' % k,
            merge(root, rules.get(
                'body:not(.dark) [data-surface-scheme="%s"]:not([data-surface-theme="dark"])' % k, {})),
            merge(dark, rules.get(
                'body.dark [data-surface-scheme="%s"]:not([data-surface-theme="light"])' % k, {})),
            True
        ))
    return contexts


def token(theme, name):
    v = theme.get(name)
    return v.strip() if v else None


def main():
    css = strip_comments(open(CSS, encoding='utf-8').read())
    rules = parse_rules(css)
    contexts = build_contexts(rules)

    print('  %-32s %-36s %7s %7s  %5s  %s'
          % ('contexto', 'par', 'claro', 'escuro', 'min', 'veredito'))
    failures = 0
    total = 0
    for ctx_label, light, dark, scheme_only in contexts:
        for label, fg, bg, minimum in PAIRS:
            if not pair_relevant(fg, bg, scheme_only):
                continue
            total += 1
            cells, ok = [], True
            for theme in (light, dark):
                f, b = token(theme, fg), token(theme, bg)
                if not (f and b and f.startswith('#') and b.startswith('#')):
                    cells.append(None)
                    ok = False
                    continue
                r = ratio(f, b)
                cells.append(r)
                if r < minimum:
                    ok = False
            if not ok:
                failures += 1
            fmt = lambda v: ('%.2f' % v) if v else '  -  '
            print('  %-32s %-36s %7s %7s  %5.1f  %s'
                  % (ctx_label, label, fmt(cells[0]), fmt(cells[1]), minimum,
                     'passa' if ok else 'REPROVA'))

    print()
    if failures:
        print('  %d de %d par(es) abaixo do minimo' % (failures, total))
        return 1
    print('  todos os %d pares passam' % total)
    return 0


if __name__ == '__main__':
    sys.exit(main())

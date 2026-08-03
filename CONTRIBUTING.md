# Contributing

## Ground rules

There is **no build step**. The files in `EchoClassic/HTML/echoclassic/html/` are
what the server sends to the browser. Keep it that way — a build step would make
the skin impossible to debug from the browser's Sources panel, which is currently
its best debugging property.

The code is ES5-flavoured on purpose: `var`, `function`, no arrow functions, no
template literals outside Vue `template:` strings, no `const`/`let`. Vue 2 is loaded
as a global, and every module attaches itself to `window` under an `Lms*` name.
Match the surrounding style rather than the style you prefer.

## Before you open a pull request

```sh
npm ci
npm test
npm run validate
npm run check-version
```

Four gates, all of which must pass:

1. `node --check` on every `.js` file.
2. Every Vue `template:` string compiles with `vue-template-compiler`.
3. No `LmsStore.*` / `LmsUi.*` / `LmsNav.*` / `LmsApi.*` / `LmsFmt.*` reference points
   at something the owning module does not export.
4. Every WCAG contrast pair recomputed from the CSS tokens still passes.

The version check also requires `install.xml`, `Plugin.pm`, and `repo.xml` to
declare the same release.

Gate 4 is the one people are surprised by. If you change a colour token in
`ios9.css`, the script recalculates it across both themes and all five accent
schemes. A token that reads fine in light blue often fails in dark amber.

## Commit messages

Conventional Commits, in the imperative:

```
fix(queue): fecha o popover com botao proprio, nao so com Esc
feat(settings): pagina de ajustes do plugin no LMS
style(css): contraste WCAG AA em 13 pares que reprovavam
```

Scopes follow the file that changed: `api`, `store`, `ui`, `nav`, `browse`, `queue`,
`player`, `settings`, `opml`, `css`, `build`, `docs`.

## Claims in commit messages and in review

If you say a change fixes something, say how you know. "Verified live" and "verified
in code" are different claims, and the difference matters when someone else has to
decide whether to trust the fix six months from now. If you could not reproduce the
failure, say so — an unverified fix is still worth merging, it is just not worth
describing as verified.

## Accessibility

The skin imitates iOS 9, which was designed before most of the contrast rules existed.
Where the imitation and the rules conflict, the rules win: this is meant to be usable
by people with low vision, not to be a museum piece. Minimum 4.5:1 for text, 3:1 for
UI components and graphical objects, 24×24 CSS pixels for pointer targets.

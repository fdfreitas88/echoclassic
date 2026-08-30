# Translating Echo Classic

Everything a translation needs lives in one file: **`EchoClassic/strings.txt`**.
There is nothing else to register — no code to edit, no list of languages to
update, no plugin to rebuild. Add the lines, restart LMS, pick the language in
Settings.

If you only read one section, read **"Check your work"** at the bottom. Most
translations that "don't work" fail for a mechanical reason the checker finds in
a second.

---

## The format

```
ECHOCLASSIC_UI_ALBUMS
→EN→Albums
→DE→Alben
→FR→Albums
→PT→Álbuns

ECHOCLASSIC_UI_SETTINGS
→EN→Settings
→DE→Einstellungen
...
```

Where `→` is a **real TAB character**. The rules:

| Rule | Why |
|---|---|
| The key starts at column 0, uppercase, no indent | anything indented is read as a translation line |
| Each translation line is `TAB` + 2-letter code + `TAB` + text | this is matched exactly; spaces will not do |
| **Tabs, never spaces** | the single most common cause of a translation that silently does nothing |
| One blank line between blocks | keeps the file readable; the parser is happy either way |
| UTF-8, **no BOM**, LF line endings | a BOM glues itself to the first key and that entry vanishes |
| `EN` first, other languages alphabetical | convention; `tools/check-strings.js --fix` will do it for you |

Accented characters are fine. Just save as UTF-8.

> **Copying from a chat window or an AI assistant?** Tabs very often arrive as
> spaces, and some editors add a BOM. That breaks the file even though it looks
> perfect on screen. Run the checker before you conclude anything is wrong with
> the skin.

---

## Adding a new language

1. Pick the two-letter code: `DE`, `FR`, `ES`, `IT`, `NL`, `SV`, `DA`, `FI`,
   `NO`, `CS`, `PL`, `RU`, `HE`.
2. Add a line with that code to each block you want translated.
3. Restart LMS. The language appears in **Settings → Language**.

That is the whole procedure. The skin discovers languages by reading the file —
`getLanguages()` in `Plugin.pm` — and the language names are already known.

**You do not have to translate everything.** Any phrase without a line in your
language falls back to English. A half-finished translation is safe to ship: it
can never produce a blank screen or a raw `ECHOCLASSIC_UI_...` key on screen.
Start with the short labels people see constantly and leave the long help text
for later.

---

## The one rule that isn't obvious

**The English text is the lookup key, not the key name.**

The interface templates contain English. At load time each English phrase is
swapped for your language. So the `EN` line must match the phrase in the
interface *character for character* — and two blocks with the **same English
text must get the same translation**, because one of them would otherwise be
thrown away silently. The checker flags this.

Three consequences worth knowing:

**Leading and trailing spaces are part of the text.** Some phrases are fragments
that get joined to a name at runtime:

```
ECHOCLASSIC_UI_ACTIONS_FOR
→EN→Actions for 
→DE→Aktionen für 
```

That trailing space is deliberate. Keep it. Same for phrases that begin with a
space, and for the ones that open or close a curly quote (`“` `”`) around an
album or playlist name — your translation has to open and close them the same
way, or the assembled sentence comes out crooked.

**Placeholders must survive.** `{n}`, `{count}`, `{total}`, `{folder}`,
`{edition}`, `{{mode}}`, `{{provider}}`, `{{hours}}`, `{{minutes}}` are filled
in at runtime. Keep them spelled exactly as they are — you may move them within
the sentence, and you should, if your language wants them elsewhere.

**A translation identical to the English is simply skipped.** That is fine and
intended for `Album`, `Radio`, `Apps` and similar. You do not need to delete
those lines.

---

## Length matters more than you'd think

This skin imitates the iOS 9 Music app, so the bottom tab bar has five or six
fixed slots and the mini player packs four lines into 74 pixels. German and
French run 30–60% longer than English.

On a phone a tab label has roughly **78 pixels**. For comparison, at the tab-bar
font `Wiedergabelisten` measures 81 px and does not fit; `Playlists` measures
37 px and does. When a natural translation is much longer than the English,
prefer the shorter idiomatic word — and if your platform's own music app has
already chosen a word for this concept, that is almost always the right one.

The same applies to buttons and to `Settings`-row values.

---

## Check your work

```bash
node tools/check-strings.js
```

No dependencies, no network. It reports coverage per language and then every
problem it can find, with a line number. It exits non-zero if anything is
actually broken, so it also works in CI. It is gate 5 of `tools/validate.sh`.

```bash
node tools/check-strings.js --fix
```

Normalises formatting only — line order within a block, blank lines between
blocks, BOM and CRLF removal. **It never changes translated text.**

What it catches:

- indentation with spaces instead of a tab, malformed language lines, a BOM,
  CRLF endings, unknown or lowercase language codes
- a duplicate key — the parser resets the entry when it meets the key again, so
  the earlier block is discarded **in silence**
- an entry with no `EN` line, or an empty translation
- placeholders that don't match the English
- leading/trailing spaces that don't match the English, on the joined fragments
- curly quotes that don't balance on a fragment
- **two keys with the same English text but different translations** — one of
  them can never appear on screen, and nothing in the interface tells you

Then run the test suite, which parses the file the same way the skin does:

```bash
npm test
```

---

## Sending it back

A pull request or the file itself both work. Please say which language, and
whether you are a native speaker — a translation from a non-native speaker is
still welcome, it just gets labelled as needing review before it ships.

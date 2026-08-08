# fonts/

Two files are expected here, supplied by the project owner:

- `PodiumSans.woff2`
- `EspySans.woff2`

Until they are added, `css/ios9.css` falls back to Geneva/Verdana (see the
`@font-face` and `--app-font` rules there) — the "Podium Sans" and "Espy Sans"
choices work today, both at the app level and per player, they just render in
the fallback stack rather than the named face. The same applies to "Chicago":
it renders as the real face only on a machine that has it installed locally,
app-wide or per player; everywhere else it falls back too.

Git does not track empty directories, and `tools/release.sh` zips whatever
files it finds under `html/`; this README is what makes the `fonts/`
directory exist in a checkout and ship in a release archive.

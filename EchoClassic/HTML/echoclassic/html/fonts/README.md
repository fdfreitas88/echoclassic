# fonts/

Two files are expected here, supplied by the project owner:

- `PodiumSans.woff2`
- `EspySans.woff2`

Until they are added, `css/ios9.css` falls back to Geneva/Verdana (see the
`@font-face` and `--app-font` rules there) — the "Podium Sans" and "Espy Sans"
choices in Appearance settings work today, they just render in the fallback
stack rather than the named face.

Git does not track empty directories, and `tools/release.sh` zips whatever
files it finds under `html/`; this README is what makes the `fonts/`
directory exist in a checkout and ship in a release archive.

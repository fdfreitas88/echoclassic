# Forum post — Echo Classic 3.3.2

Draft for approval. This announces the complete 3.3 line (3.3.0–3.3.2). The
screenshots were taken during live 3.3 validation, not from design mockups.

---

## Echo Classic 3.3.2 — richer artist information, better large lists and properly responsive LMS Settings

Now folks, the proper 3.3 presentation:

**Version 3.3.2 is here.**

This one is mainly about information, long lists and the native LMS pages inside
Echo Classic. It rolls the changes from 3.3.0, 3.3.1 and 3.3.2 into one update.

### Artist and album information

Artist pages can now use Music & Artist Information for biographies and credited
photos, without changing the artist or albums in your local library.

Album pages can also show a review, reference artwork, the provider and the time
the information was retrieved.

The information is fetched once and kept in a bounded local cache, including
across page reloads. Returning to the same artist or album does not keep calling
the provider. **Refresh** is the explicit action that bypasses and replaces the
saved result.

Album information starts collapsed, so it does not take over the album page. When
opened, it shows a three-line review preview with **Show more / Show less**.
Source details and reference artwork have their own disclosure.

The screenshot below shows the expanded information during live 3.3 validation;
3.3.2 now starts this panel collapsed and uses the shorter disclosure controls
described above.

![Album information](https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/release-3.3.2-album-information.png)

If Music & Artist Information is not installed, Echo Classic keeps the feature in
place, explains the requirement and links to the native Plugin Manager.

### Advanced LMS Settings

The native File Types page has been restyled as a responsive Echo Classic table.
The original LMS selectors and Save behaviour are preserved; this is still the
server's own form, only presented in a way that works inside the skin.

![Responsive File Types](https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/docs/img/release-3.3.2-file-types.png)

Long Advanced LMS Settings pages now use one continuous scroll area. File Types
and other long forms no longer stop inside a fixed-height box or leave a large
empty area above the player.

### Media scan details

Media Scan Details now replaces the old dotted server bars with accessible progress
gauges. A live **Now scanning** field shows the most specific activity LMS provides.

Failures are kept in a bounded, deduplicated browser journal with redacted details.
The already completed work remains visible, history can be ignored, and a retry is
offered only when LMS exposes a safe retry action.

### Large Radio, Apps and Favourites lists

Large service lists now continue in pages of 100 items. Loaded rows stay in place,
duplicates at page boundaries are ignored, and a stalled service cannot trap the
interface in an endless loading loop.

If a later page fails, the items already loaded remain usable. Search and Back also
restore the previous list and its scroll position.

This was exercised against Qobuz through 100 → 200 → 300 → 400 → 434 items.

### Also in 3.3.2

- Artist and album requests are protected against stale responses, so an older
  request cannot overwrite a newer Refresh or restore information after it was
  hidden.
- Artist biographies keep long text collapsed until requested.
- Provider HTML is normalised into readable text before it reaches the page.
- Light, Dark and Legacy layouts were checked at wide and narrow sizes for the new
  Advanced Settings treatment.
- English and Português remain complete.

### Install / update

If the repository is already configured, there is nothing to change. LMS should
pick up the current manifest on its next repository check, or after a server restart.

**Settings → Manage Plugins → Additional Repositories:**

```text
https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/repo.xml
```

After updating, I recommend a hard refresh (**Cmd/Ctrl+Shift+R**) so the browser
does not keep assets from the previous version.

Release:
https://github.com/fdfreitas88/echoclassic/releases/tag/v3.3.2

Full changelog:
https://github.com/fdfreitas88/echoclassic/blob/main/CHANGELOG.md

As always, feedback is welcome. LMS version, browser, window size and a screenshot
are particularly useful for anything UI-related.

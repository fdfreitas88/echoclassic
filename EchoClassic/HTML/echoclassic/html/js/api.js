
/* The only module that knows the JSON-RPC wire format. Everything else calls
   named functions here. Same-origin by construction: ENDPOINT is relative, so
   no host or port is ever written into the skin. */
(function (global) {
  'use strict';

  var ENDPOINT = 'jsonrpc.js';
  var DEFAULT_TIMEOUT = 10000;
  var activeRoot = { type: 'all', id: '', name: 'All music' };

  function rootFrom(value) {
    if (!value || value === 'all') return { type: 'all', id: '', key: 'all', name: 'All music' };
    if (typeof value === 'object') return value;
    var at = String(value).indexOf(':');
    var type = at > 0 ? String(value).slice(0, at) : 'library';
    var id = at > 0 ? String(value).slice(at + 1) : String(value);
    return { type: type, id: id, key: type + ':' + id };
  }

  function scoped(cmd, rootValue) {
    var root = rootFrom(rootValue || activeRoot);
    var prefix = root.type === 'folder' ? 'folder_id:' : root.type === 'library' ? 'library_id:' : '';
    if (prefix && root.id && !cmd.some(function (part) { return String(part).indexOf(prefix) === 0; })) {
      cmd.push(prefix + root.id);
    }
    return cmd;
  }

  function setRoot(value) { activeRoot = rootFrom(value); }
  function setLibrary(id) { setRoot(id ? 'library:' + id : 'all'); }

  function LmsError(cmd, kind, detail) {
    var e = Error.call(this, '[' + kind + '] ' + cmd.join(' ') + ': ' + detail);
    this.message = e.message;
    this.name = 'LmsError';
    this.kind = kind;
    this.cmd = cmd;
    /* detail guardado a parte para a interface montar texto proprio sem ter
       que fatiar a string tecnica. */
    this.detail = detail == null ? '' : String(detail);
    this.status = 0;
  }
  LmsError.prototype = Object.create(Error.prototype);
  LmsError.prototype.constructor = LmsError;

  async function rpc(playerId, cmd, opts) {
    var timeout = (opts && opts.timeout) || DEFAULT_TIMEOUT;
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, timeout);
    /* O mesmo abort e o mesmo timer precisam cobrir fetch E leitura do corpo:
       um servidor que manda os cabecalhos e estanca o corpo faria o fetch
       resolver e res.json() ficar pendente para sempre sem timeout. */
    try {
      var res;
      try {
        res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            id: 1, method: 'slim.request', params: [playerId || '', cmd]
          }),
          signal: ctl.signal
        });
      } catch (err) {
        throw new LmsError(cmd, err && err.name === 'AbortError' ? 'timeout' : 'network',
                           (err && err.message) || 'sem detalhe');
      }
      if (!res.ok) {
        var httpError = new LmsError(cmd, 'http', 'HTTP ' + res.status);
        httpError.status = res.status | 0;
        throw httpError;
      }
      var body;
      try { body = await res.json(); }
      catch (err) {
        // abort durante a leitura do corpo continua sendo timeout, nao parse
        throw new LmsError(cmd, err && err.name === 'AbortError' ? 'timeout' : 'parse',
                           (err && err.message) || 'invalid JSON');
      }
      if (body && body.error) throw new LmsError(cmd, 'lms', String(body.error));
      return (body && body.result) || {};
    } finally {
      clearTimeout(timer);
    }
  }

  function loop(res, key) { return (res && res[key]) || []; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  /* O LMS nao tem uma unidade so para bitrate. No tag do `titles` ele manda a
     string pronta -- "5641kbps VBR" --, e em outros caminhos manda numero em
     bits por segundo. Quem consumia dividia por 1000 sempre, entao um FLAC de
     2116 kbps aparecia como "2 kbps" no cabecalho do album. Normalizar aqui, na
     fronteira, em vez de espalhar a duvida por cada tela. Devolve kbps. */
  function kbps(v) {
    if (v == null || v === '') return 0;
    var n = parseFloat(v);
    if (!isFinite(n) || n <= 0) return 0;
    if (/kbps/i.test(String(v))) return Math.round(n);
    /* Sem unidade declarada: acima de 10.000 so pode ser bits por segundo --
       none formato de audio chega a 10 Mbps, e todo lossless passa de 300. */
    return Math.round(n > 10000 ? n / 1000 : n);
  }
  function txt(v) { return v == null ? '' : String(v); }
  function plainText(v) {
    return txt(v).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'").replace(/\n{3,}/g, '\n\n').trim();
  }
  function readableText(v) {
    var value = txt(v);
    if (!/[<&]/.test(value)) return value;
    value = value
      .replace(/<\s*(?:style|script|link)\b[^>]*>(?:[\s\S]*?<\s*\/\s*(?:style|script)\s*>)?/gi, '')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*\/?\s*(?:p|div|h[1-6]|li|blockquote|section|article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    if (typeof document !== 'undefined' && document.createElement) {
      var area = document.createElement('textarea');
      area.innerHTML = value;
      value = area.value;
    } else {
      value = value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'");
    }
    return value.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function pageMeta(items, sourceCount) {
    Object.defineProperty(items, 'sourceCount', {
      value: sourceCount | 0, enumerable: false, configurable: true
    });
    return items;
  }

  var artistAliasTargets = Object.create(null);
  var artistCanonicalTargets = Object.create(null);
  var artistRawCache = Object.create(null);
  var artistRawOrder = [];

  function artistKey(value) {
    var s = txt(value).trim().toLowerCase();
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.replace(/[^a-z0-9]/g, '');
  }

  function abbreviatedArtist(name) {
    var value = txt(name).trim().replace(/^['’]+\s*/, '');
    var match = value.match(/^((?:[A-Za-zÀ-ÖØ-öø-ÿ]\.\s*)+)(.+)$/);
    if (!match) return null;
    var initials = (match[1].match(/[A-Za-zÀ-ÖØ-öø-ÿ](?=\.)/g) || []).join('');
    return initials && match[2] ? { initials: initials, rest: match[2] } : null;
  }

  function displayScore(name) {
    var s = txt(name);
    var allCaps = s === s.toUpperCase() && s !== s.toLowerCase();
    var accented = /[^\x00-\x7F]/.test(s);
    var malformed = /^['’]/.test(s) ? 20 : 0;
    var compactInitials = /^(?:[A-Za-zÀ-ÖØ-öø-ÿ]\.){2,}/.test(s) ? 1 : 0;
    return malformed + compactInitials + (allCaps ? 10 : 0) - (accented ? 1 : 0);
  }

  /* O mesmo artista pode aparecer com contribuidores separados. Quando inicial
     e restante do nome apontam para uma unica forma completa, os IDs sao
     consolidados. Abreviacoes sem correspondencia segura nao entram na lista. */
  function canonicalizeArtists(raw, keepUnresolvedAbbreviations) {
    var fullGroups = Object.create(null);
    raw.forEach(function (a) {
      if (abbreviatedArtist(a.name)) return;
      var key = artistKey(a.name);
      var group = fullGroups[key];
      if (!group) {
        group = fullGroups[key] = { id: a.id, ids: [], name: a.name };
      } else if (displayScore(a.name) < displayScore(group.name)) {
        group.id = a.id;
        group.name = a.name;
      }
      group.ids.push(a.id);
    });

    var signatures = Object.create(null);
    Object.keys(fullGroups).forEach(function (key) {
      var group = fullGroups[key];
      if (/[,/&+]/.test(group.name)) return;
      var words = group.name.trim().split(/\s+/);
      if (words.length < 2) return;
      for (var i = 1; i < words.length; i++) {
        var initials = words.slice(0, i).map(function (word) { return word.charAt(0); }).join('');
        var sig = artistKey(initials) + ':' + artistKey(words.slice(i).join(' '));
        if (!signatures[sig]) signatures[sig] = [];
        signatures[sig].push(group);
      }
    });

    artistAliasTargets = Object.create(null);
    artistCanonicalTargets = Object.create(null);
    var ownGroups = Object.create(null);
    raw.forEach(function (a) {
      var abbr = abbreviatedArtist(a.name);
      var target = null;
      if (abbr) {
        var matches = signatures[artistKey(abbr.initials) + ':' + artistKey(abbr.rest)] || [];
        if (matches.length === 1) target = matches[0];
      }
      if (abbr && !target && !keepUnresolvedAbbreviations) return;
      if (!target) {
        var ownKey = artistKey(a.name);
        target = fullGroups[ownKey] || ownGroups[ownKey];
        if (!target) {
          target = ownGroups[ownKey] = { id: a.id, ids: [], name: a.name };
        } else if (displayScore(a.name) < displayScore(target.name)) {
          target.id = a.id;
          target.name = a.name;
        }
      }
      if (target.ids.indexOf(a.id) < 0) target.ids.push(a.id);
      if (abbr && target.name !== a.name) artistAliasTargets[artistKey(a.name)] = target;
      artistCanonicalTargets[artistKey(a.name)] = target;
    });

    var seen = Object.create(null);
    var out = [];
    raw.forEach(function (a) {
      var target = artistAliasTargets[artistKey(a.name)] ||
                   fullGroups[artistKey(a.name)] || ownGroups[artistKey(a.name)];
      if (!target || seen[target.id]) return;
      seen[target.id] = true;
      out.push({ id: target.id, ids: target.ids.slice(), name: target.name });
    });
    return out;
  }

  function canonicalizeArtistSubset(raw) {
    var savedAliases = artistAliasTargets;
    var savedCanonicals = artistCanonicalTargets;
    var out = canonicalizeArtists(raw, true);
    artistAliasTargets = savedAliases;
    artistCanonicalTargets = savedCanonicals;
    return out;
  }

  function canonicalArtist(name) {
    var target = artistCanonicalTargets[artistKey(name)];
    return target ? target.name : txt(name);
  }

	  function canonicalArtistRef(id, name) {
	    var target = artistCanonicalTargets[artistKey(name)];
	    if (!target && abbreviatedArtist(name)) return null;
	    return target
	      ? { id: target.id, ids: target.ids.slice(), name: target.name }
	      : { id: id, ids: [id], name: txt(name) };
	  }

	  function searchText(value) {
	    var s = txt(value).trim().toLowerCase();
	    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
	    return s;
	  }

	  function searchScore(query, primary, secondary) {
	    var q = searchText(query);
	    var p = searchText(primary);
	    var s = searchText(secondary);
	    if (!q) return 99;
	    if (p === q) return 0;
	    if (p.indexOf(q) === 0) return 1;
	    if (p.split(/\s+/).some(function (word) { return word.indexOf(q) === 0; })) return 2;
	    if (p.indexOf(q) >= 0) return 3;
	    if (s.indexOf(q) >= 0) return 4;
	    return 9;
	  }

	  function sourceFromUrl(url, remote) {
	    var match = txt(url).match(/^([a-z][a-z0-9+.-]*):\/\//i);
	    var scheme = match ? match[1].toLowerCase() : '';
	    if (scheme === 'qobuz') return 'Qobuz';
	    if (/^(youtube|yt|ytmusic)$/.test(scheme)) return 'YouTube';
	    if (remote || (scheme && scheme !== 'file')) return 'Streaming';
	    return 'Local library';
	  }

	  function uniqueBy(items, keyFn) {
	    var seen = Object.create(null);
	    return items.filter(function (item) {
	      var key = keyFn(item);
	      if (!key || seen[key]) return false;
	      seen[key] = true;
	      return true;
	    });
	  }

  async function albumSearchInfo(playerId, album, root) {
	    if (!album || album.id == null ||
	        (album.artist && album.year && album.artworkTrackId)) return album;
	    try {
      var r = await rpc(playerId, scoped(['albums', 0, 1, 'album_id:' + album.id, 'tags:jlay'], root));
	      var row = loop(r, 'albums_loop')[0] || {};
	      album.artist = album.artist || canonicalArtist(row.artist);
	      album.year = album.year || LmsFmt.year(row.year);
	      album.originalYear = album.originalYear || LmsFmt.year(row.originalyear || row.original_year);
	      album.artworkTrackId = album.artworkTrackId || row.artwork_track_id || row.coverid || null;
	    } catch (e) {}
	    return album;
	  }

  async function trackSearchInfo(playerId, track, root) {
	    if (!track || track.id == null ||
	        (track.artist && track.album && track.duration && track.url)) return track;
	    try {
	      var info = await songInfo(playerId, track.id);
	      track.artist = track.artist || info.artist;
	      track.album = track.album || info.album;
	      track.albumId = track.albumId != null ? track.albumId : info.albumId;
	      track.coverId = track.coverId || info.coverId;
	      track.url = track.url || info.url;
	      track.duration = track.duration || info.duration;
	      track.year = track.year || info.year;
	      track.originalYear = track.originalYear || info.originalYear;
	      track.source = sourceFromUrl(track.url, false);
	    } catch (e) {}
	    return track;
	  }

  async function artists(playerId, start, count) {
    var r = await rpc(playerId, scoped(['artists', start | 0, count | 0]));
    var source = loop(r, 'artists_loop');
    var raw = source
      .filter(function (a) { return txt(a.artist).trim(); })
      .map(function (a) { return { id: a.id, name: txt(a.artist) }; });
    if ((start | 0) === 0) {
      artistRawCache = Object.create(null);
      artistRawOrder = [];
    }
    raw.forEach(function (artist) {
      var id = String(artist.id);
      if (!Object.prototype.hasOwnProperty.call(artistRawCache, id)) artistRawOrder.push(id);
      artistRawCache[id] = artist;
    });
    var accumulated = artistRawOrder.map(function (id) { return artistRawCache[id]; });
    return pageMeta(canonicalizeArtists(accumulated), source.length);
  }

  async function albums(playerId, start, count, filter) {
    if (filter && Array.isArray(filter.artistIds) && filter.artistIds.length) {
      var batches = await Promise.all(filter.artistIds.map(function (id) {
        return albums(playerId, 0, count, { artistId: id });
      }));
      var found = Object.create(null);
      var merged = [];
      batches.forEach(function (batch) {
        batch.forEach(function (album) {
          if (found[album.id]) return;
          found[album.id] = true;
          merged.push(album);
        });
      });
      return merged.slice(start | 0, (start | 0) + (count | 0));
    }
    var sort = filter && filter.sort ? filter.sort : 'album';
    var cmd = ['albums', start | 0, count | 0, 'tags:jaSlytW2', 'sort:' + sort];
    if (filter && filter.artistId != null) cmd.push('artist_id:' + filter.artistId);
    if (filter && filter.albumId != null) cmd.push('album_id:' + filter.albumId);
    if (filter && filter.genreId != null) cmd.push('genre_id:' + filter.genreId);
    if (filter && filter.year != null) cmd.push('year:' + filter.year);
    if (filter && filter.workId != null) cmd.push('work_id:' + filter.workId);
    if (filter && filter.releaseType) cmd.push('release_type:' + filter.releaseType);
    var r = await rpc(playerId, scoped(cmd));
    var source = loop(r, 'albums_loop');
    return pageMeta(source.map(function (a) {
      return {
        id: a.id, title: txt(a.album), rawTitle: txt(a.title || a.album),
        year: LmsFmt.year(a.year), originalYear: LmsFmt.year(a.originalyear || a.original_year),
        releaseType: txt(a.release_type), groupings: num(a.groupings),
        artist: canonicalArtist(a.artist), artistId: a.artist_id != null ? a.artist_id : null,
        artworkTrackId: a.artwork_track_id || null
      };
    }), source.length);
  }

  /* Resolve o artista de um album. Necessario porque um album aberto pela raiz
     "Albuns" nao carrega o id do artista, e sem ele nao da para listar o resto
     da discografia nem ligar o nome no cabecalho. */
  async function artistOfAlbum(playerId, albumId) {
    var rows = await albums(playerId, 0, 1, { albumId: albumId });
    var album = rows[0];
    return album && album.artist
      ? canonicalArtistRef(album.artistId, album.artist) : null;
  }

  async function artistsOfAlbum(playerId, albumId) {
    var r = await rpc(playerId, scoped(['artists', 0, 500, 'album_id:' + albumId]));
    var raw = loop(r, 'artists_loop')
      .filter(function (a) { return txt(a.artist).trim(); })
      .map(function (a) { return { id: a.id, name: txt(a.artist) }; });
    return canonicalizeArtistSubset(raw);
  }

	  async function tracks(playerId, albumId, start, count) {
	    var r = await rpc(playerId, scoped(['titles', start | 0, count | 0,
	                                 'album_id:' + albumId, 'sort:tracknum',
	                                 'tags:aAcCdefgiIjJkKlLmMnopPDUqrROSstTuvwxXyY']));
	    var source = loop(r, 'titles_loop');
	    return pageMeta(source.map(function (t) {
	      return {
	        id: t.id, title: txt(t.title), trackNum: num(t.tracknum),
        disc: num(t.disc), discCount: num(t.disccount),
        artist: canonicalArtist(t.artist), album: txt(t.album),
        duration: num(t.duration), sampleRate: num(t.samplerate),
        sampleSize: num(t.samplesize), format: txt(t.type).toUpperCase(),
        bitrate: kbps(t.bitrate), url: txt(t.url), remote: num(t.remote) === 1,
        rating: num(t.rating), playCount: num(t.playcount),
        year: LmsFmt.year(t.year), originalYear: LmsFmt.year(t.originalyear || t.original_year),
	        addedTime: num(t.addedTime), lastPlayed: num(t.lastplayed)
	      };
	    }), source.length);
	  }

  /* Metadata-only library scan used by the album facets. It is deliberately
     paged and separate from tracks(): selecting a normal album must never pay
     the cost of reading the whole library. */
  async function libraryTracks(playerId, start, count) {
    var r = await rpc(playerId, scoped(['titles', start | 0, count | 0,
                                 'sort:albumtrack', 'tags:eorTIux']));
    var source = loop(r, 'titles_loop');
    return pageMeta(source.map(function (t) {
      return {
        id: t.id,
        albumId: t.album_id != null ? t.album_id : t.albumid,
        format: txt(t.type).toLowerCase(), bitrate: kbps(t.bitrate),
        sampleRate: num(t.samplerate), sampleSize: num(t.samplesize),
        url: txt(t.url), remote: num(t.remote) === 1
      };
    }).filter(function (t) { return t.albumId != null; }), source.length);
  }

  /* A resposta de search usa nomes diferentes das listagens normais
     (contributor_id, album_id e track_id). Normalizar aqui impede que esse
     detalhe do fio escape para a interface. */
  async function search(playerId, term, count, rootValue) {
    var q = txt(term).trim();
    var root = rootFrom(rootValue || activeRoot);
    if (!q) return { artists: [], albums: [], works: [], tracks: [], playlists: [] };
    var plain = q.normalize
      ? q.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : q;
    var requests = [
      rpc(playerId, scoped(['search', 0, count | 0, 'term:' + q, 'extended:1'], root)),
      rpc('', ['playlists', 0, count | 0, 'search:' + q])
    ];
    if (plain !== q) requests.push(rpc(playerId, scoped(['search', 0, count | 0,
                                                   'term:' + plain, 'extended:1'], root)));
    var responses = await Promise.all(requests);
    var r = responses[0];
    if (responses[2]) {
      ['contributors_loop', 'albums_loop', 'works_loop', 'tracks_loop'].forEach(function (key) {
        r[key] = loop(r, key).concat(loop(responses[2], key));
      });
    }
    var playlistRows = loop(responses[1], 'playlists_loop');
	    var artistsFound = loop(r, 'contributors_loop')
	        .filter(function (a) { return txt(a.contributor).trim(); })
	        .map(function (a) {
	          return canonicalArtistRef(a.contributor_id, a.contributor);
	        })
	        .filter(Boolean)
	        .filter(function (a, i, all) {
	          return all.findIndex(function (x) { return x.id === a.id; }) === i;
	        })
	        .sort(function (a, b) {
	          return searchScore(q, a.name, '') - searchScore(q, b.name, '') ||
	            a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
	        }).map(function (a) { a.rootKey = root.key; a.rootName = root.name || ''; return a; });
	    var albumsFound = uniqueBy(loop(r, 'albums_loop').map(function (a) {
	        return {
	          id: a.album_id, title: txt(a.album), artist: canonicalArtist(a.artist),
	          year: LmsFmt.year(a.year), originalYear: LmsFmt.year(a.originalyear || a.original_year),
	          artworkTrackId: a.artwork_track_id || a.coverid || null,
          releaseType: txt(a.release_type)
	        };
	      }), function (a) { return String(a.id); }).sort(function (a, b) {
	        return searchScore(q, a.title, a.artist) - searchScore(q, b.title, b.artist) ||
	          a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
	      });
	    albumsFound = await Promise.all(albumsFound.map(function (album) {
	      album.rootKey = root.key; album.rootName = root.name || '';
	      return albumSearchInfo(playerId, album, root);
	    }));
	    var tracksFound = uniqueBy(loop(r, 'tracks_loop').map(function (t) {
	        return {
	          id: t.track_id, title: txt(t.track), artist: canonicalArtist(t.artist),
	          albumId: t.album_id != null ? t.album_id : null,
	          album: txt(t.album), coverId: t.coverid || t.artwork_track_id || null,
	          url: txt(t.url), duration: num(t.duration),
	          source: sourceFromUrl(t.url, num(t.remote) === 1),
          format: txt(t.type).toUpperCase(), releaseType: txt(t.release_type)
	        };
	      }), function (t) { return String(t.id); }).sort(function (a, b) {
	        return searchScore(q, a.title, [a.artist, a.album, a.source].join(' ')) -
	          searchScore(q, b.title, [b.artist, b.album, b.source].join(' ')) ||
	          a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
	      });
	    tracksFound = await Promise.all(tracksFound.map(function (track) {
	      track.rootKey = root.key; track.rootName = root.name || '';
	      return trackSearchInfo(playerId, track, root);
	    }));
	    var playlistsFound = uniqueBy(playlistRows.map(function (p) {
	        return { id: p.id, name: txt(p.playlist), kind: 'playlist', url: txt(p.url) };
	      }), function (p) { return String(p.id); }).sort(function (a, b) {
	        return searchScore(q, a.name, '') - searchScore(q, b.name, '') ||
	          a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
	      });
	    var worksFound = uniqueBy(loop(r, 'works_loop').map(function (w) {
	      return { id: w.work_id != null ? w.work_id : w.id, title: txt(w.work || w.title),
	               composer: txt(w.composer || w.artist), composerId: w.composer_id || w.artist_id,
	               rootKey: root.key, rootName: root.name || '' };
	    }).filter(function (w) { return w.title; }), function (w) { return String(w.id); })
	      .sort(function (a, b) {
	        return searchScore(q, a.title, a.composer) - searchScore(q, b.title, b.composer) ||
	          a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
	      });
	    return {
	      artists: artistsFound,
	      albums: albumsFound,
	      works: worksFound,
	      tracks: tracksFound,
	      playlists: playlistsFound
	    };
	  }

  function mergeSearchResults(results, query) {
    var keys = ['artists', 'albums', 'works', 'tracks', 'playlists'];
    var out = { artists: [], albums: [], works: [], tracks: [], playlists: [] };
    keys.forEach(function (key) {
      var seen = Object.create(null);
      results.forEach(function (result) {
        (result[key] || []).forEach(function (item) {
          var identity = key + ':' + String(item.id) + ':' + String(item.rootKey || 'all');
          if (seen[identity]) return;
          seen[identity] = true;
          out[key].push(item);
        });
      });
    });
    out.works.sort(function (a, b) {
      return searchScore(query, a.title, a.composer) - searchScore(query, b.title, b.composer) ||
        searchScore(query, a.composer, a.title) - searchScore(query, b.composer, b.title) ||
        a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
    });
    return out;
  }

  async function searchRoots(playerId, term, count, roots) {
    var selected = (roots || []).map(rootFrom);
    if (!selected.length) selected = [activeRoot];
    var failures = [];
    var results = await Promise.all(selected.map(function (root) {
      return search(playerId, term, count, root).catch(function (error) {
        failures.push(error);
        return { artists: [], albums: [], works: [], tracks: [], playlists: [] };
      });
    }));
    if (failures.length === selected.length) throw failures[0];
    return mergeSearchResults(results, term);
  }

  async function genres(playerId, start, count) {
    var r = await rpc(playerId, scoped(['genres', start | 0, count | 0]));
    return loop(r, 'genres_loop').map(function (g) {
      return { id: g.id, name: txt(g.genre) };
    });
  }

  async function years(playerId, start, count) {
    var r = await rpc(playerId, scoped(['years', start | 0, count | 0]));
    return loop(r, 'years_loop').map(function (y) { return LmsFmt.year(y.year); })
      .filter(Boolean).map(function (value) { return { year: value }; });
  }

  async function contributors(playerId, start, count, roleId) {
    var cmd = ['artists', start | 0, count | 0];
    if (roleId != null) cmd.push('role_id:' + roleId);
    var r = await rpc(playerId, scoped(cmd));
    return loop(r, 'artists_loop').filter(function (a) { return txt(a.artist).trim(); })
      .map(function (a) { return { id: a.id, ids: [a.id], name: txt(a.artist), roleId: roleId }; });
  }

  async function works(playerId, start, count, filter) {
    var cmd = ['works', start | 0, count | 0];
    if (filter && filter.composerId != null) cmd.push('artist_id:' + filter.composerId);
    if (filter && filter.roleId != null) cmd.push('role_id:' + filter.roleId);
    if (filter && filter.search) cmd.push('search:' + filter.search);
    var r = await rpc(playerId, scoped(cmd));
    return pageMeta(loop(r, 'works_loop').map(function (w) {
      return {
        id: w.id != null ? w.id : w.work_id,
        title: txt(w.work || w.title), composer: txt(w.composer || w.artist),
        composerId: w.composer_id != null ? w.composer_id : w.artist_id,
        artworkTrackId: w.artwork_track_id || w.coverid || null
      };
    }).filter(function (w) { return w.title; }), num(r.count));
  }

  async function libraries(playerId) {
    try {
      var r = await rpc(playerId, ['libraries', 0, 100]);
      var rows = loop(r, 'libraries_loop').concat(loop(r, 'library_loop'));
      return rows.map(function (item) {
        return { id: item.id != null ? item.id : item.library_id,
                 name: txt(item.name || item.library), enabled: item.enabled == null || num(item.enabled) === 1 };
      }).filter(function (item) { return item.id != null && item.name && item.enabled; });
    } catch (e) { return []; }
  }

  async function musicFolders(playerId, parentId) {
    try {
      var cmd = ['musicfolder', 0, 500, 'tags:u'];
      if (parentId != null && parentId !== '') cmd.push('folder_id:' + parentId);
      var r = await rpc(playerId, cmd);
      return loop(r, 'folder_loop').concat(loop(r, 'musicfolder_loop')).map(function (item) {
        var id = item.id != null ? item.id : item.folder_id;
        var isFolder = parentId == null || item.type === 'folder' || item.hasitems || item.has_items || item.isfolder;
        return { type: isFolder ? 'folder' : 'track', id: id,
          key: (isFolder ? 'folder:' : 'file:') + id,
          name: txt(item.filename || item.name || item.path), path: txt(item.path || item.url),
          url: txt(item.url), title: txt(item.title || item.filename || item.name) };
      }).filter(function (item) { return item.id != null && item.name; });
    } catch (e) { return []; }
  }

  function albumArtists(playerId, start, count) {
    return contributors(playerId, start, count, 5);
  }

  async function releaseTypes(playerId) {
    var start = 0, values = Object.create(null), keepGoing = true;
    while (keepGoing && start < 10000) {
      var page = await albums(playerId, start, 500, { sort: 'album' });
      page.forEach(function (album) {
        var value = txt(album.releaseType).trim();
        if (value) values[value.toLocaleLowerCase()] = value;
      });
      var sourceCount = page.sourceCount == null ? page.length : page.sourceCount;
      keepGoing = sourceCount === 500; start += sourceCount;
    }
    return Object.keys(values).map(function (key) { return { id: key, name: values[key] }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  async function libraryRoots(playerId) {
    var found = await Promise.all([libraries(playerId), musicFolders(playerId)]);
    return [{ type: 'all', id: '', key: 'all', name: 'All music' }]
      .concat(found[0].map(function (item) { return Object.assign({ type: 'library', key: 'library:' + item.id }, item); }))
      .concat(found[1]);
  }

  /* LRU: uma sessao longa de radio tocaria centenas de faixas e o cache antigo
     crescia sem limite, segurando playCount velho na memoria. */
  var SONG_CACHE_MAX = 200;
  var songCache = new Map();

  function songCacheGet(trackId) {
    if (!songCache.has(trackId)) return null;
    var info = songCache.get(trackId);
    songCache.delete(trackId);
    songCache.set(trackId, info);
    return info;
  }

  function songCacheSet(trackId, info) {
    if (songCache.has(trackId)) songCache.delete(trackId);
    songCache.set(trackId, info);
    while (songCache.size > SONG_CACHE_MAX) {
      songCache.delete(songCache.keys().next().value);
    }
  }

  async function players(playerId) {
    var r = await rpc(playerId, ['serverstatus', 0, 999]);
    return loop(r, 'players_loop').map(function (p) {
      return {
        id: txt(p.playerid), name: txt(p.name),
        connected: !!num(p.connected), power: !!num(p.power)
      };
    });
  }

  async function songInfo(playerId, trackId) {
    var cached = songCacheGet(trackId);
    if (cached) return cached;
    var r = await rpc(playerId, ['songinfo', 0, 200, 'track_id:' + trackId]);
    var flat = {};
    loop(r, 'songinfo_loop').forEach(function (o) { Object.assign(flat, o); });
    var info = {
      id: flat.id != null ? flat.id : trackId,
      title: txt(flat.title), artist: canonicalArtist(flat.artist),
      album: txt(flat.album), albumId: flat.album_id != null ? flat.album_id : null,
      albumArtist: txt(flat.albumartist), composer: txt(flat.composer),
      conductor: txt(flat.conductor), band: txt(flat.band),
      genre: txt(flat.genres || flat.genre), year: LmsFmt.year(flat.year),
      originalYear: LmsFmt.year(flat.originalyear || flat.original_year || flat.originaldate),
      disc: num(flat.disc), discCount: num(flat.disccount),
      trackNum: num(flat.tracknum), duration: num(flat.duration),
      rating: num(flat.rating), playCount: num(flat.playcount),
      addedTime: num(flat.addedTime), lastUpdated: num(flat.lastUpdated),
      modificationTime: num(flat.modificationTime),
      comment: txt(flat.comment), lyrics: txt(flat.lyrics), url: txt(flat.url),
      fileSize: num(flat.filesize), releaseType: txt(flat.release_type),
      sampleRate: num(flat.samplerate), sampleSize: num(flat.samplesize),
      format: txt(flat.type).toUpperCase(), bitrate: kbps(flat.bitrate)
    };
    songCacheSet(trackId, info);
    return info;
  }

  function forgetSongInfo() { songCache.clear(); }

  async function status(playerId) {
    /* b/o/T/I ask LMS 9.2 for the active stream's bitrate, format, sample
       rate and sample size.  These values live at the top level of `status`
       and describe the stream after transcoding; the similarly named fields
       in playlist_loop describe the source track. */
    var r = await rpc(playerId, ['status', '-', 1, 'tags:alueKNcdtboTI']);
    var cur = loop(r, 'playlist_loop')[0] || {};
    var duration = num(cur.duration) || num(r.duration);
    var st = {
      mode: txt(r.mode) || 'stop',
      time: num(r.time),
      duration: duration,
      volume: Math.abs(num(r['mixer volume'])),
      index: num(r.playlist_cur_index),
      track: {
        id: cur.id != null ? cur.id : null,
        title: txt(cur.title), artist: canonicalArtist(cur.artist),
        album: txt(cur.album), albumId: cur.album_id != null ? cur.album_id : cur.albumid,
        trackNum: num(cur.tracknum),
        coverId: cur.coverid || null,
        url: txt(cur.url)
      },
      sampleRate: num(r.samplerate) || num(cur.samplerate),
      sampleSize: num(r.samplesize) || num(cur.samplesize),
      format: txt(r.type || cur.type).toUpperCase(),
      bitrate: kbps(r.bitrate || cur.bitrate),
      live: duration === 0
    };
    // Older servers do not reliably carry these fields; fill only the gaps so
    // a partial active-stream response can never be overwritten by metadata.
    if (st.track.id != null && (!st.sampleRate || !st.sampleSize || !st.format)) {
      var info = await songInfo(playerId, st.track.id);
      if (!st.sampleRate) st.sampleRate = info.sampleRate;
      if (!st.sampleSize) st.sampleSize = info.sampleSize;
      if (!st.format) st.format = info.format;
    }
    return st;
  }

  /* A fila e a playlist do proprio servidor, nao uma copia no cliente. Ler dali
     e o que faz a skin concordar com o que o LMS realmente vai tocar. */
  async function queue(playerId, start, count) {
    // tag 'e' adiciona album_id: sem ele a fila nao tem como agrupar por album
    // sem depender do nome (que colide) ou do coverid (que e por faixa).
    var r = await rpc(playerId, ['status', start | 0, count | 0, 'tags:aldeKNcgltTIo']);
    return {
      total: num(r.playlist_tracks),
      index: num(r.playlist_cur_index),
      shuffle: num(r['playlist shuffle']),
      repeat: num(r['playlist repeat']),
      tracks: loop(r, 'playlist_loop').map(function (t) {
        return {
          index: num(t['playlist index']), id: t.id,
          title: txt(t.title), artist: canonicalArtist(t.artist), album: txt(t.album),
          albumId: t.album_id != null ? t.album_id : null,
          duration: num(t.duration), coverId: t.coverid || null,
          url: txt(t.url), rating: num(t.rating), playCount: num(t.playcount)
        };
      })
    };
  }

  function queueJump(playerId, index)   { return rpc(playerId, ['playlist', 'index', index]); }
  function queueRemove(playerId, index) { return rpc(playerId, ['playlist', 'delete', index]); }
  function queueClear(playerId)         { return rpc(playerId, ['playlist', 'clear']); }
  function queueMove(playerId, from, to) {
    return rpc(playerId, ['playlist', 'move', from | 0, to | 0]);
  }
  function queueControl(playerId, action, key, id) {
    return rpc(playerId, ['playlistcontrol', 'cmd:' + action, key + ':' + id]);
  }
  function setShuffle(playerId, mode)   { return rpc(playerId, ['playlist', 'shuffle', mode]); }
  function setRepeat(playerId, mode)    { return rpc(playerId, ['playlist', 'repeat', mode]); }

  /* Favoritos por url: `favorites exists <url>` devolve {exists, index}, e o
     index e o item_id que o delete pede. Verificado no servidor real. */
  async function favoriteExists(url) {
    if (!url) return { exists: false, index: null };
    var r = await rpc('', ['favorites', 'exists', url]);
    return {
      exists: num(r.exists) === 1,
      index: r.index !== undefined ? String(r.index) : null
    };
  }

  function favoriteAdd(url, title) {
    return rpc('', ['favorites', 'add', 'url:' + url, 'title:' + title]);
  }

  function favoriteRemove(index) {
    return rpc('', ['favorites', 'delete', 'item_id:' + index]);
  }

  function favoriteFolderAdd(title, parentId) {
    var cmd = ['favorites', 'add', 'title:' + txt(title), 'type:folder'];
    if (parentId != null) cmd.push('item_id:' + parentId);
    return rpc('', cmd);
  }

  function favoriteRename(index, title) {
    return rpc('', ['favorites', 'rename', 'item_id:' + index, 'title:' + txt(title)]);
  }

  function favoriteMove(index, toIndex, parentId) {
    var cmd = ['favorites', 'move', 'item_id:' + index, 'toindex:' + toIndex];
    if (parentId != null) cmd.push('parent_id:' + parentId);
    return rpc('', cmd);
  }

  async function playerPref(playerId, key) {
    var r = await rpc(playerId, ['playerpref', key, '?']);
    var v = r && (r['_' + key] !== undefined ? r['_' + key] : r._p2);
    return v === undefined ? null : String(v);
  }

  function setPlayerPref(playerId, key, value) {
    return rpc(playerId, ['playerpref', key, String(value)]);
  }

  function sleep(playerId, seconds) {
    return rpc(playerId, ['sleep', Math.max(0, Math.round(num(seconds)))]);
  }

  async function sleepRemaining(playerId) {
    var r = await rpc(playerId, ['sleep', '?']);
    return num(r._p2 !== undefined ? r._p2 : (r.sleep || r.will_sleep_in));
  }

  function syncPlayer(playerId, targetId) {
    return rpc(playerId, ['sync', targetId || '-']);
  }

  async function syncGroups() {
    var r = await rpc('', ['syncgroups', '?']);
    return loop(r, 'syncgroups_loop').map(function (group, index) {
      var ids = txt(group.sync_members).split(',').filter(Boolean);
      var names = txt(group.sync_member_names).split(',');
      return {
        id: 'sync-' + index + '-' + (ids[0] || ''), masterId: ids[0] || '',
        members: ids.map(function (id, i) { return { id: id, name: names[i] || id }; })
      };
    }).filter(function (group) { return group.members.length > 1; });
  }

  async function playerVolume(playerId) {
    var r = await rpc(playerId, ['mixer', 'volume', '?']);
    return Math.max(0, Math.min(100, Math.abs(num(r._volume))));
  }

  /* SqueezeDSP is optional and its settings belong to a player, not to the
     server. Keep the plugin's complete JSON document intact: saveall expects
     the whole document and newer revisions may add fields unknown to us. */
  async function squeezeDspRead(playerId) {
    var cmd = ['squeezedsp.readclientSettings'];
    var r = await rpc(playerId, cmd);
    if (typeof r.json !== 'string') {
      throw new LmsError(cmd, 'lms', 'SqueezeDSP is not available');
    }
    var settings;
    try { settings = JSON.parse(r.json || '{}'); }
    catch (e) { throw new LmsError(cmd, 'parse', 'Invalid SqueezeDSP settings JSON'); }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) ||
        !settings.Client || typeof settings.Client !== 'object') {
      throw new LmsError(cmd, 'parse', 'Invalid SqueezeDSP settings document');
    }
    /* A fresh player can legitimately persist only Client.Bypass. Native
       SqueezeDSP fills the rest in its page JavaScript; a range input without
       an explicit value instead chooses its midpoint, so normalize the two
       fields Echo Classic currently edits before they reach Vue. */
    if (settings.Client.Bypass == null) settings.Client.Bypass = 1;
    if (settings.Client.Preamp == null) settings.Client.Preamp = 0;
    if (!Array.isArray(settings.Client.Filters)) settings.Client.Filters = [];
    return {
      settings: settings,
      clientName: txt(r.clientName),
      revision: txt(r.revision),
      fresh: Number(r.fresh_player) === 1
    };
  }

  function squeezeDspLoop(r, key) {
    return loop(r, key).map(function (row) {
      if (row && row[0] != null) return txt(row[0]);
      if (row && row.value != null) return txt(row.value);
      return txt(row);
    }).filter(Boolean);
  }

  async function squeezeDspCatalog(playerId) {
    var r = await rpc(playerId, ['squeezedsp.filters']);
    return {
      presets: squeezeDspLoop(r, 'Preset_loop'),
      impulses: squeezeDspLoop(r, 'FIRWavFile_loop')
    };
  }

  function squeezeDspSave(playerId, settings) {
    return rpc(playerId, ['squeezedsp.saveall', 'val:' + JSON.stringify(settings)]);
  }

  async function squeezeDspLoadPreset(playerId, preset) {
    var cmd = ['squeezedsp.readpresetSettings', 'presetFileName:' + preset];
    var r = await rpc(playerId, cmd);
    if (typeof r.json !== 'string') throw new LmsError(cmd, 'parse', 'Invalid SqueezeDSP preset');
    var settings;
    try { settings = JSON.parse(r.json || '{}'); }
    catch (e) { throw new LmsError(cmd, 'parse', 'Invalid SqueezeDSP preset JSON'); }
    if (!settings || !settings.Client) throw new LmsError(cmd, 'parse', 'Invalid SqueezeDSP preset document');
    if (settings.Client.Bypass == null) settings.Client.Bypass = 0;
    if (settings.Client.Preamp == null) settings.Client.Preamp = 0;
    if (!Array.isArray(settings.Client.Filters)) settings.Client.Filters = [];
    return settings;
  }

  async function canCommand(parts) {
    var r = await rpc('', ['can'].concat(parts).concat(['?']));
    var values = Object.keys(r || {}).map(function (k) { return r[k]; });
    return values.some(function (v) { return String(v) === '1'; });
  }

  /* Same probe as canCommand, for several commands at once. Each `can` is its
     own request -- the wire format has no batch envelope for slim.request --
     so "batched" here means fired together with Promise.all instead of one
     await at a time, which is what makes resolving a whole capability map
     cost one round trip's worth of latency instead of N. `probes` maps a name
     the caller cares about ({rating: true}) to the command parts to ask LMS
     about (['rating']). */
  async function canCommands(probes) {
    var names = Object.keys(probes || {});
    var results = await Promise.all(names.map(function (name) {
      return canCommand(probes[name]).catch(function () { return false; });
    }));
    var out = {};
    names.forEach(function (name, i) { out[name] = results[i]; });
    return out;
  }

  /* MusicArtistInfo is optional and owns these read-only commands. Keep its
     wire contract here so the artist view never has to construct JSON-RPC or
     infer plugin presence from a list of installed packages. */
  async function musicArtistInfo(playerId, artistId, artistName) {
    var available = await canCommand(['musicartistinfo', 'biography']).catch(function () {
      return false;
    });
    if (!available) return { available: false };

    var identity = artistId != null && artistId !== ''
      ? 'artist_id:' + artistId
      : 'artist:' + encodeURIComponent(txt(artistName));
    var responses = await Promise.all([
      rpc(playerId, ['musicartistinfo', 'biography', identity]).catch(function (error) {
        return { error: error && error.detail ? error.detail : 'Biography unavailable' };
      }),
      rpc(playerId, ['musicartistinfo', 'artistphoto', identity]).catch(function (error) {
        return { error: error && error.detail ? error.detail : 'Artist photo unavailable' };
      })
    ]);
    var biography = responses[0] || {};
    var photo = responses[1] || {};
    return {
      available: true,
      biography: readableText(biography.biography),
      portraitId: biography.portraitid || null,
      biographyError: txt(biography.error),
      photoUrl: txt(photo.url),
      photoCredits: txt(photo.credits),
      photoError: txt(photo.error)
    };
  }

  async function musicAlbumInfo(playerId, albumId) {
    var caps = await canCommands({
      review: ['musicartistinfo', 'albumreview'],
      covers: ['musicartistinfo', 'albumcovers']
    });
    if (!caps.review && !caps.covers) return { available: false, review: '', covers: [] };
    var identity = 'album_id:' + albumId;
    var responses = await Promise.all([
      caps.review ? rpc(playerId, ['musicartistinfo', 'albumreview', identity]).catch(function (e) {
        return { error: e && e.detail ? e.detail : 'Album review unavailable' };
      }) : {},
      caps.covers ? rpc(playerId, ['musicartistinfo', 'albumcovers', identity]).catch(function (e) {
        return { error: e && e.detail ? e.detail : 'Album covers unavailable' };
      }) : {}
    ]);
    return {
      available: true,
      review: plainText(responses[0].albumreview), reviewError: txt(responses[0].error),
      covers: loop(responses[1], 'item_loop').map(function (item) {
        return { url: txt(item.url), credits: txt(item.credits), size: txt(item.size) };
      }).filter(function (item) { return item.url; }),
      coversError: txt(responses[1].error)
    };
  }

  /* Core LMS 'rating' (Slim/Control/Request.pm dispatches
     ['rating','_item','_rating'] to Commands.pm ratingCommand) uses a 0-100
     scale, 100 being 5 stars in units of 20 -- the same scale songinfo hands
     back in trackInfo.rating. The UI only ever deals in 0-5 stars, so the
     conversion belongs here, at the one module that knows the wire format. */
  function setRating(playerId, trackId, stars) {
    var value = Math.max(0, Math.min(5, stars | 0)) * 20;
    return rpc(playerId, ['rating', trackId, value]);
  }

  /* Radio, Favorites and Apps are the same thing in LMS: an OPML tree where
     each item carries actions.go with the command for its own children. One
     browser serves all three. */
  var OPML_ROOTS = {
    radio: { cmd: ['radios'], params: ['menu:radio'] },
    favorites: { cmd: ['favorites', 'items'], params: ['menu:favorites'] },
    apps: { cmd: ['apps'], params: ['menu:apps'] }
  };
  var TERM_PLACEHOLDER = '__TAGGEDINPUT__';

  function opmlRoot(kind) {
    var r = OPML_ROOTS[kind];
    if (!r) throw new LmsError(['opmlRoot', String(kind)], 'lms', 'raiz OPML desconhecida');
    return { cmd: r.cmd.slice(), params: r.params.slice(), title: kind };
  }

  function hasPlaceholder(item) {
    var p = item.actions && item.actions.go && item.actions.go.params;
    if (!p) return false;
    return Object.keys(p).some(function (k) { return p[k] === TERM_PLACEHOLDER; });
  }

  function opmlKind(item) {
    if (item.type === 'audio' || item.type === 'track') return 'audio';
    if (item.type === 'search' || hasPlaceholder(item)) return 'search';
    if (item.style === 'itemNoAction') return 'text';
    if (item.actions && (item.actions.do || item.actions.playall || item.actions.add || item.actions.insert)) return 'action';
    if (item.type === 'text') return 'text';
    return 'menu';
  }

  function opmlChildNode(item) {
    var go = item.actions && item.actions.go;
    if (!go || !go.cmd) return null;
    var params = [];
    var p = go.params || {};
    Object.keys(p).forEach(function (k) { params.push(k + ':' + p[k]); });
    return { cmd: go.cmd.slice(), params: params, title: txt(item.text || item.title) };
  }

  /* LMS offers a playable OPML item either an explicit `play` action or, more
     often, a `go` action that starts it. Either becomes a node we can fire. */
  function opmlPlayNode(item) {
    var acts = item.actions || {};
    var verb = ['play', 'do', 'playall', 'add', 'insert', 'go'].filter(function (name) {
      return acts[name] && acts[name].cmd;
    })[0];
    var a = verb ? acts[verb] : null;
    if (!a || !a.cmd) return null;
    var params = [];
    var p = a.params || {};
    Object.keys(p).forEach(function (k) { params.push(k + ':' + p[k]); });
    return { cmd: a.cmd.slice(), params: params, title: txt(item.text || item.title), verb: verb };
  }

  async function opmlPlay(playerId, playNode) {
    if (!playNode) return;
    var paging = playNode.verb === 'do' ? [] : [0, 1];
    await rpc(playerId, playNode.cmd.concat(paging, playNode.params));
  }

  function opmlImage(item) {
    return item.image || item.icon || (item['icon-id'] ? String(item['icon-id']) : null);
  }

  /* Page boundaries from service plugins can repeat an item. Title alone is
     not identity: two stations may legitimately share one title. Prefer the
     server id, then the complete action contract which is what distinguishes
     what the row actually does. Text-only rows fall back to their raw shape so
     a repeated boundary label can still be recognised. */
  function opmlIdentity(item, kind) {
    if (item.id != null) return kind + ':id:' + String(item.id);
    var actions = item.actions || null;
    if (actions) return kind + ':actions:' + JSON.stringify(actions);
    return kind + ':item:' + JSON.stringify({
      type: item.type || '', style: item.style || '',
      text: item.text || '', title: item.title || '', name: item.name || '',
      subtext: item.subtext || '', subtitle: item.subtitle || ''
    });
  }

  /* Many LMS service plugins keep identical action definitions in
     result.base.actions and put only the row-specific values in item.params.
     Treating only item.actions as authoritative leaves those rows visible but
     inert, and pagination then rejects every later row as unusable. Expand the
     shared contract at the API boundary while preserving any row override. */
  function opmlItemWithBase(result, item) {
    var baseActions = result && result.base && result.base.actions;
    if (!baseActions) return item;
    var out = Object.assign({}, item);
    var ownActions = item.actions || {};
    out.actions = {};
    Object.keys(baseActions).forEach(function (name) {
      var base = baseActions[name] || {};
      var own = ownActions[name] || {};
      var action = Object.assign({}, base, own);
      var itemParamsKey = action.itemsParams;
      var rowParams = itemParamsKey && item[itemParamsKey] ? item[itemParamsKey] : {};
      action.params = Object.assign({}, base.params || {}, rowParams, own.params || {});
      out.actions[name] = action;
    });
    Object.keys(ownActions).forEach(function (name) {
      if (!out.actions[name]) out.actions[name] = ownActions[name];
    });
    return out;
  }

  async function opmlRequest(playerId, node, start, count, extra) {
    var cmd = node.cmd.concat([start | 0, count | 0], node.params, extra || []);
    var r = await rpc(playerId, cmd);
    var seen = Object.create(null);
    return loop(r, 'item_loop').map(function (raw, rawIndex) {
      var i = opmlItemWithBase(r, raw);
      var kind = opmlKind(i);
      return {
        identity: opmlIdentity(i, kind),
        itemId: i.id != null ? i.id : (start | 0) + rawIndex,
        kind: kind,
        title: txt(i.text || i.title || i.name),
        subtitle: txt(i.subtext || i.subtitle),
        image: opmlImage(i),
        node: kind === 'menu' ? opmlChildNode(i) : null,
        // An audio item's own action is how it gets played; without carrying it
        // the station would render and do nothing when tapped.
        playNode: kind === 'audio' || kind === 'action' ? opmlPlayNode(i) : null
      };
    }).filter(function (item) {
      if (!item.identity || seen[item.identity]) return !item.identity;
      seen[item.identity] = true;
      return true;
    });
  }

  async function randomPlayActive(playerId) {
    var r = await rpc(playerId, ['randomplayisactive']);
    var mode = txt(r._randomplayisactive);
    return mode === '0' || mode === 'disable' ? '' : mode;
  }

  function randomPlay(playerId, mode) {
    return rpc(playerId, ['randomplay', mode]);
  }

  async function dontStopProviders(playerId) {
    var r = await rpc(playerId, ['dontstopthemusicsetting']);
    return loop(r, 'item_loop').map(function (item) {
      var action = item.actions && item.actions.do;
      var cmd = action && action.cmd;
      if (!Array.isArray(cmd) || cmd.length < 3) return null;
      return { id: String(cmd[cmd.length - 1]), name: txt(item.text), selected: Number(item.radio) === 1 };
    }).filter(Boolean);
  }

  function opmlBrowse(playerId, node, start, count) {
    return opmlRequest(playerId, node, start, count, null);
  }

  function opmlSearch(playerId, node, term, start, count) {
    return opmlRequest(playerId, node, start, count, ['search:' + term]);
  }

  async function loadTrack(playerId, trackId) {
    await rpc(playerId, ['playlistcontrol', 'cmd:load', 'track_id:' + trackId]);
  }

  /* play and pause are their own commands; skipping is `playlist index +1|-1`. */
  async function transport(playerId, action) {
    if (action === 'next') return rpc(playerId, ['playlist', 'index', '+1']);
    if (action === 'prev') return rpc(playerId, ['playlist', 'index', '-1']);
    return rpc(playerId, [action]);
  }

  function seek(playerId, seconds) {
    return rpc(playerId, ['time', Math.max(0, Math.round(num(seconds)))]);
  }

  function setVolume(playerId, volume) {
    var value = Math.max(0, Math.min(100, Math.round(num(volume))));
    return rpc(playerId, ['mixer', 'volume', value]);
  }

  /* serverstatus doubles as the library census: the real server answers with
     `info total artists|albums|songs|genres` alongside the player list. */
  async function serverInfo() {
    var r = await rpc('', ['serverstatus', 0, 0]);
    return {
      version: txt(r.version),
      /* Carimbo do ultimo scan da biblioteca. E a chave certa para invalidar
         cache derivado: muda exatamente quando o conteudo muda. */
      lastscan: txt(r.lastscan),
      artists: num(r['info total artists']),
      albums: num(r['info total albums']),
      songs: num(r['info total songs']),
      genres: num(r['info total genres']),
      playerCount: num(r['player count'])
    };
  }

  async function playlists(start, count) {
    var r = await rpc('', ['playlists', start | 0, count | 0]);
    var source = loop(r, 'playlists_loop');
    return pageMeta(source.map(function (p) {
	      return { id: p.id, name: txt(p.playlist), url: txt(p.url), source: sourceFromUrl(p.url, false) };
	    }), source.length);
	  }

  /* `playlists new name:X` devolve o id da nova, ou overwritten_playlist_id
     quando ja existia uma com o mesmo nome. */
  async function createPlaylist(name) {
    var r = await rpc('', ['playlists', 'new', 'name:' + name]);
    var id = r.playlist_id != null ? r.playlist_id : r.overwritten_playlist_id;
    return { id: id != null ? id : null, existed: r.overwritten_playlist_id != null };
  }

  async function deletePlaylist(playlistId) {
    await rpc('', ['playlists', 'delete', 'playlist_id:' + playlistId]);
  }

  function renamePlaylist(playlistId, name) {
    return rpc('', ['playlists', 'rename', 'playlist_id:' + playlistId,
                    'newname:' + txt(name)]);
  }

  function editPlaylist(playlistId, action, opts) {
    var cmd = ['playlists', 'edit', 'cmd:' + action, 'playlist_id:' + playlistId];
    opts = opts || {};
    if (opts.index != null) cmd.push('index:' + (opts.index | 0));
    if (opts.toIndex != null) cmd.push('toindex:' + (opts.toIndex | 0));
    if (opts.title) cmd.push('title:' + txt(opts.title));
    if (opts.url) cmd.push('url:' + txt(opts.url));
    return rpc('', cmd);
  }

  async function playlistTracks(playlistId, start, count) {
    var r = await rpc('', ['playlists', 'tracks', start | 0, count | 0,
                           'playlist_id:' + playlistId,
                           'tags:aAcCdefgiIjJkKlLmMnopPDUqrROSstTuvwxXyY']);
    var source = loop(r, 'playlisttracks_loop').concat(loop(r, 'titles_loop'));
    return pageMeta(source.map(function (t, index) {
      return {
        id: t.id, title: txt(t.title), artist: canonicalArtist(t.artist), album: txt(t.album),
        index: t['playlist index'] != null ? num(t['playlist index']) : (start | 0) + index,
        duration: num(t.duration), coverId: t.coverid || null,
        sampleRate: num(t.samplerate), sampleSize: num(t.samplesize),
        format: txt(t.type).toUpperCase(), url: txt(t.url),
        rating: num(t.rating), playCount: num(t.playcount),
        year: LmsFmt.year(t.year), originalYear: LmsFmt.year(t.originalyear || t.original_year)
      };
    }), source.length);
  }

  /* Loading a whole container in one call is what the transport buttons need:
     `playlistcontrol cmd:load` accepts album_id, artist_id or playlist_id. */
  async function loadContainer(playerId, key, id) {
    await rpc(playerId, ['playlistcontrol', 'cmd:load', key + ':' + id]);
  }

  global.LmsApi = {
    rpc: rpc, LmsError: LmsError,
    serverInfo: serverInfo, playlists: playlists,
    createPlaylist: createPlaylist, deletePlaylist: deletePlaylist,
    renamePlaylist: renamePlaylist, editPlaylist: editPlaylist,
    favoriteExists: favoriteExists, favoriteAdd: favoriteAdd,
    favoriteRemove: favoriteRemove, favoriteFolderAdd: favoriteFolderAdd,
    favoriteRename: favoriteRename, favoriteMove: favoriteMove,
    queue: queue, queueJump: queueJump, queueRemove: queueRemove,
    queueMove: queueMove, queueControl: queueControl,
    queueClear: queueClear, setShuffle: setShuffle, setRepeat: setRepeat,
    playlistTracks: playlistTracks, loadContainer: loadContainer,
    artists: artists, albums: albums, tracks: tracks,
    contributors: contributors, albumArtists: albumArtists, releaseTypes: releaseTypes,
    works: works, libraries: libraries, musicFolders: musicFolders,
    libraryRoots: libraryRoots, setRoot: setRoot, setLibrary: setLibrary,
    searchRoots: searchRoots,
    libraryTracks: libraryTracks, search: search,
    __kbps: kbps,
    artistOfAlbum: artistOfAlbum, artistsOfAlbum: artistsOfAlbum,
    genres: genres, years: years,
    players: players, status: status, songInfo: songInfo,
    forgetSongInfo: forgetSongInfo, playerPref: playerPref,
    setPlayerPref: setPlayerPref, sleep: sleep, sleepRemaining: sleepRemaining,
    syncPlayer: syncPlayer, syncGroups: syncGroups, playerVolume: playerVolume,
    canCommand: canCommand, canCommands: canCommands,
    squeezeDspRead: squeezeDspRead, squeezeDspCatalog: squeezeDspCatalog,
    squeezeDspSave: squeezeDspSave, squeezeDspLoadPreset: squeezeDspLoadPreset,
    musicArtistInfo: musicArtistInfo,
    musicAlbumInfo: musicAlbumInfo,
    randomPlayActive: randomPlayActive, randomPlay: randomPlay,
    dontStopProviders: dontStopProviders,
    setRating: setRating,
    OPML_ROOTS: OPML_ROOTS, opmlRoot: opmlRoot,
    opmlBrowse: opmlBrowse, opmlSearch: opmlSearch, opmlPlay: opmlPlay,
    loadTrack: loadTrack, transport: transport,
    seek: seek, setVolume: setVolume
  };
})(window);

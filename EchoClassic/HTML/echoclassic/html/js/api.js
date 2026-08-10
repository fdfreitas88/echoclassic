
/* The only module that knows the JSON-RPC wire format. Everything else calls
   named functions here. Same-origin by construction: ENDPOINT is relative, so
   no host or port is ever written into the skin. */
(function (global) {
  'use strict';

  var ENDPOINT = 'jsonrpc.js';
  var DEFAULT_TIMEOUT = 10000;

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

	  async function albumSearchInfo(playerId, album) {
	    if (!album || album.id == null ||
	        (album.artist && album.year && album.artworkTrackId)) return album;
	    try {
	      var r = await rpc(playerId, ['albums', 0, 1, 'album_id:' + album.id, 'tags:jlay']);
	      var row = loop(r, 'albums_loop')[0] || {};
	      album.artist = album.artist || canonicalArtist(row.artist);
	      album.year = album.year || LmsFmt.year(row.year);
	      album.originalYear = album.originalYear || LmsFmt.year(row.originalyear || row.original_year);
	      album.artworkTrackId = album.artworkTrackId || row.artwork_track_id || row.coverid || null;
	    } catch (e) {}
	    return album;
	  }

	  async function trackSearchInfo(playerId, track) {
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
	      track.source = sourceFromUrl(track.url, false);
	    } catch (e) {}
	    return track;
	  }

  async function artists(playerId, start, count) {
    var r = await rpc(playerId, ['artists', start | 0, count | 0]);
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
    var r = await rpc(playerId, cmd);
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
    var r = await rpc(playerId, ['artists', 0, 500, 'album_id:' + albumId]);
    var raw = loop(r, 'artists_loop')
      .filter(function (a) { return txt(a.artist).trim(); })
      .map(function (a) { return { id: a.id, name: txt(a.artist) }; });
    return canonicalizeArtistSubset(raw);
  }

	  async function tracks(playerId, albumId, start, count) {
	    var r = await rpc(playerId, ['titles', start | 0, count | 0,
	                                 'album_id:' + albumId, 'sort:tracknum',
	                                 'tags:aAcCdefgiIjJkKlLmMnopPDUqrROSstTuvwxXyY']);
	    var source = loop(r, 'titles_loop');
	    return pageMeta(source.map(function (t) {
	      return {
	        id: t.id, title: txt(t.title), trackNum: num(t.tracknum),
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
    var r = await rpc(playerId, ['titles', start | 0, count | 0,
                                 'sort:albumtrack', 'tags:eorTIux']);
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
  async function search(playerId, term, count) {
    var q = txt(term).trim();
    if (!q) return { artists: [], albums: [], tracks: [], playlists: [] };
    var plain = q.normalize
      ? q.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : q;
    var requests = [
      rpc(playerId, ['search', 0, count | 0, 'term:' + q, 'extended:1']),
      rpc('', ['playlists', 0, count | 0, 'search:' + q])
    ];
    if (plain !== q) requests.push(rpc(playerId, ['search', 0, count | 0,
                                                   'term:' + plain, 'extended:1']));
    var responses = await Promise.all(requests);
    var r = responses[0];
    if (responses[2]) {
      ['contributors_loop', 'albums_loop', 'tracks_loop'].forEach(function (key) {
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
	        });
	    var albumsFound = uniqueBy(loop(r, 'albums_loop').map(function (a) {
	        return {
	          id: a.album_id, title: txt(a.album), artist: canonicalArtist(a.artist),
	          year: LmsFmt.year(a.year), originalYear: LmsFmt.year(a.originalyear || a.original_year),
	          artworkTrackId: a.artwork_track_id || a.coverid || null
	        };
	      }), function (a) { return String(a.id); }).sort(function (a, b) {
	        return searchScore(q, a.title, a.artist) - searchScore(q, b.title, b.artist) ||
	          a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
	      });
	    albumsFound = await Promise.all(albumsFound.map(function (album) {
	      return albumSearchInfo(playerId, album);
	    }));
	    var tracksFound = uniqueBy(loop(r, 'tracks_loop').map(function (t) {
	        return {
	          id: t.track_id, title: txt(t.track), artist: canonicalArtist(t.artist),
	          albumId: t.album_id != null ? t.album_id : null,
	          album: txt(t.album), coverId: t.coverid || t.artwork_track_id || null,
	          url: txt(t.url), duration: num(t.duration),
	          source: sourceFromUrl(t.url, num(t.remote) === 1)
	        };
	      }), function (t) { return String(t.id); }).sort(function (a, b) {
	        return searchScore(q, a.title, [a.artist, a.album, a.source].join(' ')) -
	          searchScore(q, b.title, [b.artist, b.album, b.source].join(' ')) ||
	          a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });
	      });
	    tracksFound = await Promise.all(tracksFound.map(function (track) {
	      return trackSearchInfo(playerId, track);
	    }));
	    var playlistsFound = uniqueBy(playlistRows.map(function (p) {
	        return { id: p.id, name: txt(p.playlist), kind: 'playlist', url: txt(p.url) };
	      }), function (p) { return String(p.id); }).sort(function (a, b) {
	        return searchScore(q, a.name, '') - searchScore(q, b.name, '') ||
	          a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
	      });
	    return {
	      artists: artistsFound,
	      albums: albumsFound,
	      tracks: tracksFound,
	      playlists: playlistsFound
	    };
	  }

  async function genres(playerId, start, count) {
    var r = await rpc(playerId, ['genres', start | 0, count | 0]);
    return loop(r, 'genres_loop').map(function (g) {
      return { id: g.id, name: txt(g.genre) };
    });
  }

  async function years(playerId, start, count) {
    var r = await rpc(playerId, ['years', start | 0, count | 0]);
    return loop(r, 'years_loop').map(function (y) { return LmsFmt.year(y.year); })
      .filter(Boolean).map(function (value) { return { year: value }; });
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
      comment: txt(flat.comment), url: txt(flat.url),
      fileSize: num(flat.filesize), releaseType: txt(flat.release_type),
      sampleRate: num(flat.samplerate), sampleSize: num(flat.samplesize),
      format: txt(flat.type).toUpperCase(), bitrate: kbps(flat.bitrate)
    };
    songCacheSet(trackId, info);
    return info;
  }

  function forgetSongInfo() { songCache.clear(); }

  async function status(playerId) {
    var r = await rpc(playerId, ['status', '-', 1, 'tags:alueKNcdt']);
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
      sampleRate: num(cur.samplerate),
      sampleSize: num(cur.samplesize),
      format: txt(cur.type).toUpperCase(),
      live: duration === 0
    };
    // status does not reliably carry samplerate; songinfo is the documented fallback
    if (st.track.id != null && !st.sampleRate) {
      var info = await songInfo(playerId, st.track.id);
      st.sampleRate = info.sampleRate;
      st.sampleSize = info.sampleSize;
      st.format = info.format || st.format;
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
    if (item.type === 'text' || item.style === 'itemNoAction') return 'text';
    return 'menu';
  }

  function opmlChildNode(item) {
    var go = item.actions && item.actions.go;
    if (!go || !go.cmd) return null;
    var params = [];
    var p = go.params || {};
    Object.keys(p).forEach(function (k) { params.push(k + ':' + p[k]); });
    return { cmd: go.cmd.slice(), params: params, title: txt(item.title) };
  }

  /* LMS offers a playable OPML item either an explicit `play` action or, more
     often, a `go` action that starts it. Either becomes a node we can fire. */
  function opmlPlayNode(item) {
    var acts = item.actions || {};
    var a = acts.play || acts.go;
    if (!a || !a.cmd) return null;
    var params = [];
    var p = a.params || {};
    Object.keys(p).forEach(function (k) { params.push(k + ':' + p[k]); });
    return { cmd: a.cmd.slice(), params: params, title: txt(item.text || item.title) };
  }

  async function opmlPlay(playerId, playNode) {
    if (!playNode) return;
    await rpc(playerId, playNode.cmd.concat([0, 1], playNode.params));
  }

  function opmlImage(item) {
    return item.image || item.icon || (item['icon-id'] ? String(item['icon-id']) : null);
  }

  async function opmlRequest(playerId, node, start, count, extra) {
    var cmd = node.cmd.concat([start | 0, count | 0], node.params, extra || []);
    var r = await rpc(playerId, cmd);
    return loop(r, 'item_loop').map(function (i) {
      var kind = opmlKind(i);
      return {
        kind: kind,
        title: txt(i.text || i.title || i.name),
        subtitle: txt(i.subtext || i.subtitle),
        image: opmlImage(i),
        node: kind === 'menu' ? opmlChildNode(i) : null,
        // An audio item's own action is how it gets played; without carrying it
        // the station would render and do nothing when tapped.
        playNode: kind === 'audio' ? opmlPlayNode(i) : null
      };
    });
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
    favoriteRemove: favoriteRemove,
    queue: queue, queueJump: queueJump, queueRemove: queueRemove,
    queueMove: queueMove, queueControl: queueControl,
    queueClear: queueClear, setShuffle: setShuffle, setRepeat: setRepeat,
    playlistTracks: playlistTracks, loadContainer: loadContainer,
    artists: artists, albums: albums, tracks: tracks,
    libraryTracks: libraryTracks, search: search,
    __kbps: kbps,
    artistOfAlbum: artistOfAlbum, artistsOfAlbum: artistsOfAlbum,
    genres: genres, years: years,
    players: players, status: status, songInfo: songInfo,
    forgetSongInfo: forgetSongInfo, playerPref: playerPref,
    setPlayerPref: setPlayerPref, sleep: sleep, sleepRemaining: sleepRemaining,
    syncPlayer: syncPlayer, canCommand: canCommand, canCommands: canCommands,
    setRating: setRating,
    OPML_ROOTS: OPML_ROOTS, opmlRoot: opmlRoot,
    opmlBrowse: opmlBrowse, opmlSearch: opmlSearch, opmlPlay: opmlPlay,
    loadTrack: loadTrack, transport: transport,
    seek: seek, setVolume: setVolume
  };
})(window);

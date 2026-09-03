
/* v2 invalidates biographies cached before the API boundary converted the
   plugin's optional HTML payload to readable text. */
var ECHOCLASSIC_ARTIST_INFO_CACHE_KEY = 'echoclassic.artist-info.v2';
var ECHOCLASSIC_ARTIST_INFO_CACHE_LIMIT = 40;

/* The right-hand pane of Minha Musica. An artist, a genre or a year all resolve
   to a list of albums; an album resolves to its tracks. Selecting an album from
   inside an artist pushes a second frame, which is what gives the nav bar its
   back label. */
Vue.component('lms-detail', {
  props: { frame: { type: Object, required: true } },
  template: `
<div class="detail">
  <div v-if="loading" class="system-state system-loading" role="status" aria-live="polite">
    <div class="state-skeleton" aria-hidden="true"><span class="state-skeleton-art"></span><span><i></i><i class="short"></i></span><span class="state-skeleton-art"></span><span><i></i><i class="short"></i></span></div>
    <div class="state-progress-copy"><span>Loading details…</span></div><div class="state-progress indeterminate" role="progressbar" aria-label="Loading details"><i></i></div>
  </div>
  <div v-else-if="error" class="empty">
    <div class="state-error-mark" aria-hidden="true">!</div><div class="h">Could not open</div><div class="p">{{ error }} Your place in the library is unchanged.</div>
    <div class="state-actions"><button class="retry-command primary" @click="load">Try again</button></div>
  </div>

  <template v-else-if="frame.kind === 'album'">
    <div v-for="a in visibleBlocks" :key="'album-detail-' + a.id" class="artist-track-album album-detail-unified">
      <section class="artist-detail-compact artist-track-album-summary"
               :class="['artist-layout-'+ui.artistDetailLayout,'artist-controls-'+ui.artistDetailControls]">
        <div class="artist-primary-panel">
          <div class="artist-primary-album">
            <span class="artist-primary-art" :class="{placeholder:!hasArt(a)}"><img v-if="hasArt(a)" :src="largeArt(a.art)" alt="" @error="markArtFailed(a)"><span v-else aria-hidden="true">♫</span></span>
            <span class="artist-primary-copy">
              <strong>{{ a.title }}</strong><span>{{ albumArtistLabel(a) }}</span>
              <small v-if="albumSummary(a).songCount">{{ albumSummary(a).songCount }} {{ tr(albumSummary(a).songCount === 1 ? 'song' : 'songs') }}</small>
              <small>{{ tr('Year of this edition:') }} {{ a.year || tr('not available') }}</small>
              <small>{{ tr('Original year:') }} {{ a.originalYear || tr('not available') }}</small>
              <small v-if="albumSummary(a).formatLine || albumSummary(a).bitRateLine" class="artist-primary-technical">
                <span v-if="albumSummary(a).formatLine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4 4V21.5H6zM14 2.5v4h4"/></svg>{{ albumSummary(a).formatLine }}</span>
                <span v-if="albumSummary(a).bitRateLine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-6M8 18V6M12 14v-4M16 19V5M20 15V9"/></svg>{{ albumSummary(a).bitRateLine }}</span>
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v13H4zM7 15.5h.01M10 15.5h7"/></svg>{{ albumSummary(a).originLine || a.source || tr('Local library') }}</span>
              </small>
              <small v-else>{{ a.source || tr('Local library') }}</small>
            </span>
          </div>
          <div class="artist-compact-controls" aria-label="Album playback">
            <button type="button" class="primary" aria-label="Play" title="Play" @click="playPrimaryAlbum(a)"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="solid" d="M7 4.5 19 12 7 19.5z"/></svg><b>{{ tr('Play') }}</b></button>
            <button type="button" aria-label="Shuffle" title="Shuffle" @click="shufflePrimaryAlbum(a)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.2c4.5 0 5.1 10 9.6 10H20M17 14l3 3-3 3M4 17h3.2c1.8 0 3-1.6 4.1-3.5M15.5 7.8c.4-.5.8-.8 1.3-.8H20M17 4l3 3-3 3"/></svg><b>{{ tr('Shuffle') }}</b></button>
            <button v-if="store.equalizer.status==='ready'" type="button" aria-label="Equalizer" title="Equalizer" @click="openPrimaryEqualizer(a)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M12 4v16M19 4v16"/><circle cx="5" cy="9" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="19" cy="8" r="2"/></svg><b>{{ tr('Equalizer') }}</b></button>
          </div>
        </div>
        <div class="artist-compact-sidecar" :aria-labelledby="artistEnrichmentTitleId(a)">
          <div class="artist-compact-identity"><span class="artist-compact-photo" :class="{placeholder:!enrichment.photoUrl||photoFailed}"><img v-if="enrichment.photoUrl&&!photoFailed" :src="largeArt(enrichment.photoUrl)" alt="" @error="photoFailed=true"><span v-else aria-hidden="true">{{ albumArtistInitial(a) }}</span></span><span><strong>{{ albumArtistLabel(a) }}</strong><small :id="artistEnrichmentTitleId(a)">{{ tr('Artist information') }}</small></span></div>
          <div v-if="enrichmentLoading" class="artist-enrichment-status" role="status">{{ tr('Finding artist information…') }}</div>
          <div v-else-if="enrichmentStatus === 'ready'">
            <p v-if="enrichment.biography" class="artist-biography" :class="{expanded:enrichmentExpanded}">{{ enrichment.biography }}</p>
            <p v-else class="artist-enrichment-status">{{ tr('No artist biography was found.') }}</p>
            <div class="artist-enrichment-links"><button v-if="enrichment.biography" type="button" :aria-expanded="enrichmentExpanded?'true':'false'" @click="enrichmentExpanded=!enrichmentExpanded">{{ tr(enrichmentExpanded?'Show less':'Read biography') }}</button><button type="button" @click="retryEnrichment">{{ tr('Refresh') }}</button><button type="button" @click="removeEnrichment">{{ tr('Hide for now') }}</button></div>
          </div>
          <div v-else class="artist-enrichment-status"><p>{{ artistEnrichmentMessage }}</p><button v-if="enrichmentStatus==='unavailable'" type="button" class="retry-command" @click="openPluginManager">{{ tr('Install plugin') }}</button><button v-else type="button" class="retry-command" @click="retryEnrichment">{{ tr('Try again') }}</button></div>
          <div v-if="albumSummary(a).relatedArtists && albumSummary(a).relatedArtists.length" class="album-extra album-related artist-related">
            <svg class="related-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19.5v-1.3c0-2.1-1.8-3.7-4-3.7H7c-2.2 0-4 1.6-4 3.7v1.3M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 8h5M18.5 5.5v5"/></svg>
            <div class="related-links"><strong>{{ tr('Local library') }}</strong><template v-for="(related,index) in albumSummary(a).relatedArtists"><span v-if="index" :key="'album-related-separator-'+a.id+'-'+related.id" class="related-separator" aria-hidden="true">•</span><button :key="'album-related-'+a.id+'-'+related.id" type="button" @click="openRelatedArtist(related)">{{ related.name }}</button></template></div>
          </div>
        </div>
      </section>
      <lms-album-block :album="a" :artist="artist" :enrich="false" :show-related="false"
                       :continuation="true" @summary="captureAlbumSummary"></lms-album-block>
    </div>
    <div v-if="discographyTruncated" class="loading-more warning" role="status">
      This artist's discography has more than 200 albums and this screen shows the first 200.
    </div>
  </template>

  <template v-else-if="frame.kind === 'musicfolder'">
    <div class="music-folder-browser" :class="{'builder-open':playlistBuilderOpen,'builder-view':playlistBuilderMobileView==='builder'}">
      <aside class="music-folder-rail" :aria-label="tr('Music folders')">
        <div class="music-folder-rail-heading">{{ tr('Locations') }}</div>
        <button type="button" class="music-folder-source music-root-source" @click="backToMusic">
          <span class="music-folder-source-icon root" aria-hidden="true">♫</span><span>{{ tr('All Music') }}</span>
        </button>
        <div class="music-folder-rail-heading">{{ tr('Music folders') }}</div>
        <button v-for="root in folderRoots" :key="'folder-root-'+root.id" type="button"
                class="music-folder-source" :class="{on:String(root.id)===String(folderRootId)}"
                :aria-current="String(root.id)===String(folderRootId) ? 'page' : null" @click="openFolderRoot(root)">
          <span class="music-folder-source-icon" aria-hidden="true"></span><span>{{ root.name }}</span>
        </button>
      </aside>
      <section class="music-folder-browser-pane">
        <div class="music-folder-mobile-mode" role="tablist" :aria-label="tr('Music folder view')">
          <button type="button" role="tab" :aria-selected="playlistBuilderMobileView==='browse'" @click="playlistBuilderMobileView='browse'">{{ tr('Browse') }}</button>
          <button type="button" role="tab" :aria-selected="playlistBuilderMobileView==='builder'" @click="openPlaylistBuilder">{{ tr('Playlist Builder') }}<span v-if="playlistDraftTracks.length">{{ playlistDraftTracks.length }}</span></button>
        </div>
        <label class="music-folder-mobile-source">
          <span class="visually-hidden">{{ tr('Music folder source') }}</span>
          <select :value="String(folderRootId)" :aria-label="tr('Music folder source')" @change="chooseFolderSource($event.target.value)">
            <option value="">{{ tr('All Music') }}</option>
            <option v-for="root in folderRoots" :key="'folder-mobile-'+root.id" :value="String(root.id)">{{ root.name }}</option>
          </select>
        </label>
        <nav class="music-folder-context" :aria-label="tr('Current location')">
          <button type="button" @click="backToMusic">{{ tr('Music Folder') }}</button>
          <template v-for="(crumb,index) in folderBreadcrumbs">
            <span :key="'folder-separator-'+crumb.key" aria-hidden="true">›</span>
            <button v-if="index < folderBreadcrumbs.length-1" :key="'folder-crumb-'+crumb.key" type="button" @click="openFolderCrumb(index)">{{ crumb.label }}</button>
            <strong v-else :key="'folder-current-'+crumb.key">{{ crumb.label }}</strong>
          </template>
        </nav>
        <div class="music-folder-outline-toolbar">
          <span><strong>{{ frame.label }}</strong><small>{{ folderCountLabel }}</small></span>
          <label class="music-folder-filter"><span class="visually-hidden">{{ tr('Filter this folder') }}</span><input v-model="folderFilter" type="search" :placeholder="tr('Filter this folder')" :aria-label="tr('Filter this folder')"></label>
          <label class="music-folder-sort"><span class="visually-hidden">{{ tr('Sort folders') }}</span><select v-model="folderSort" :aria-label="tr('Sort folders')"><option value="name">{{ tr('Name A–Z') }}</option><option value="name-desc">{{ tr('Name Z–A') }}</option><option value="type">{{ tr('Type') }}</option><option value="count">{{ tr('Item count') }}</option></select></label>
          <button type="button" :title="tr('Collapse all')" :aria-label="tr('Collapse all')" @click="collapseFolders">−</button>
          <button type="button" class="music-folder-expand-command" :title="tr('Expand first level')" :aria-label="tr('Expand first level')" @click="expandFolders"><span aria-hidden="true">+</span><b>{{ tr('Expand first level') }}</b></button>
          <button type="button" class="music-folder-builder-command" :aria-expanded="playlistBuilderOpen?'true':'false'" @click="togglePlaylistBuilder"><span aria-hidden="true">☷</span><b>{{ tr('Playlist Builder') }}</b></button>
        </div>
        <div class="music-folder-columns" aria-hidden="true"><span>{{ tr('Name') }}</span><span>{{ tr('Type') }}</span><span>{{ tr('Contents') }}</span></div>
        <div v-if="folderTreeRows.length" class="music-folder-tree" role="tree" :aria-label="frame.label">
          <div v-for="row in folderTreeRows" :key="row.key" ref="folderRows" class="music-folder-tree-row"
               :class="[row.item.type,{expanded:row.expanded}]" role="treeitem"
               :tabindex="folderRowTabindex(row)" :aria-level="row.depth+1"
               :aria-expanded="row.item.type==='folder' ? String(row.expanded) : null"
               :aria-busy="row.loading ? 'true' : null" :style="{'--folder-depth':row.depth}"
               :draggable="row.item.type==='track'" @dragstart="folderTrackDragStart(row.item,$event)"
               @focus="folderFocusedKey=row.key" @keydown="folderTreeKeydown(row,$event)">
            <button v-if="row.item.type==='folder'" type="button" class="music-folder-twisty" :aria-label="folderDisclosureLabel(row)" @click.stop="toggleFolderTree(row)">{{ row.loading ? '…' : (row.expanded ? '▾' : '▸') }}</button><span v-else class="music-folder-twisty" aria-hidden="true"></span>
            <button type="button" class="music-folder-tree-name" @click="openFolderItem(row.item,$event)">
              <span v-if="row.item.type==='folder'" class="music-folder-item-icon" aria-hidden="true"></span><span v-else class="music-folder-track-icon" aria-hidden="true">♪</span>
              <span>{{ row.item.name }}</span>
            </button>
            <span class="music-folder-tree-meta">{{ tr(row.item.type === 'folder' ? 'Folder' : 'Track') }}</span>
            <span class="music-folder-tree-meta music-folder-tree-last"><span>{{ folderTreeCount(row) }}</span><button v-if="row.item.type==='track'" type="button" :aria-label="tr('Add track') + ': ' + row.item.name" @click.stop="appendTrackToDraft(row.item)">+</button></span>
          </div>
        </div>
        <div v-else-if="folderFilter" class="empty music-folder-empty"><div class="h">{{ tr('No matching items') }}</div><div class="p">{{ tr('Clear the folder filter to see every item here.') }}</div><button type="button" class="retry-command" @click="folderFilter=''">{{ tr('Clear filter') }}</button></div>
        <div v-else class="empty music-folder-empty">
          <div class="h">{{ tr('This folder is empty') }}</div><div class="p">{{ tr('Return to Music to choose another folder.') }}</div>
          <button type="button" class="retry-command" @click="backToMusic">‹ {{ tr('Back to Music') }}</button>
        </div>
      </section>
      <section v-if="playlistBuilderOpen" class="playlist-builder" :aria-label="tr('Playlist Builder')">
        <div class="music-folder-mobile-mode" role="tablist" :aria-label="tr('Music folder view')">
          <button type="button" role="tab" :aria-selected="playlistBuilderMobileView==='browse'" @click="playlistBuilderMobileView='browse'">{{ tr('Browse') }}</button>
          <button type="button" role="tab" :aria-selected="playlistBuilderMobileView==='builder'" @click="playlistBuilderMobileView='builder'">{{ tr('Playlist Builder') }}<span v-if="playlistDraftTracks.length">{{ playlistDraftTracks.length }}</span></button>
        </div>
        <header class="playlist-builder-header">
          <span><strong>{{ tr('Playlist Builder') }}</strong><small>{{ playlistBuilderCountLabel }}</small></span>
          <button type="button" class="playlist-builder-close" :aria-label="tr('Close Playlist Builder')" @click="closePlaylistBuilder">×</button>
        </header>
        <label class="playlist-builder-name"><span>{{ tr('Playlist name') }}</span><input v-model="playlistDraftName" type="text" :placeholder="tr('New playlist')"></label>
        <div class="playlist-builder-append" :class="{'drop-active':playlistDropIndex===playlistDraftTracks.length}" @dragover.prevent="setPlaylistDropIndex(playlistDraftTracks.length)" @dragleave="clearPlaylistDrop" @drop.prevent="dropTrackAt(playlistDraftTracks.length,$event)">
          <span aria-hidden="true">＋</span><strong>{{ tr('Drop tracks here') }}</strong><small>{{ tr('Drops here are added to the end.') }}</small>
        </div>
        <ol v-if="playlistDraftTracks.length" class="playlist-builder-list" :aria-label="tr('Playlist draft')">
          <li v-for="(track,index) in playlistDraftTracks" :key="track.draftKey" class="playlist-builder-row" :class="{'drop-before':playlistDropIndex===index,'dragging':playlistDragIndex===index}"
              draggable="true" @dragstart="playlistTrackDragStart(index,$event)" @dragover.prevent="playlistRowDragOver(index,$event)" @dragleave="playlistRowDragLeave(index,$event)" @drop.prevent="dropTrackAt(playlistDropIndex,$event)" @dragend="clearPlaylistDrag">
            <span class="playlist-builder-grip" aria-hidden="true">⠿</span><span class="playlist-builder-index">{{ index+1 }}</span>
            <span class="playlist-builder-copy"><strong>{{ track.title }}</strong><small>{{ track.artist || track.path || tr('Music Folder') }}</small></span>
            <span class="playlist-builder-moves">
              <button type="button" :disabled="index===0" :aria-label="tr('Move up') + ': ' + track.title" @click="moveDraftTrack(index,-1)">↑</button>
              <button type="button" :disabled="index===playlistDraftTracks.length-1" :aria-label="tr('Move down') + ': ' + track.title" @click="moveDraftTrack(index,1)">↓</button>
              <button type="button" :aria-label="tr('Remove track') + ': ' + track.title" @click="removeDraftTrack(index)">×</button>
            </span>
          </li>
          <li class="playlist-builder-end-target" :class="{'drop-before':playlistDropIndex===playlistDraftTracks.length}" @dragover.prevent="setPlaylistDropIndex(playlistDraftTracks.length)" @drop.prevent="dropTrackAt(playlistDraftTracks.length,$event)"></li>
        </ol>
        <div v-else class="playlist-builder-empty"><span aria-hidden="true">♫</span><strong>{{ tr('Your playlist is empty') }}</strong><small>{{ tr('Drag tracks from the folder or use Add.') }}</small></div>
        <div class="playlist-builder-status" role="status" aria-live="polite">{{ playlistBuilderNotice }}</div>
        <footer class="playlist-builder-footer">
          <button v-if="!playlistClearPending" type="button" :disabled="!playlistDraftTracks.length" @click="playlistClearPending=true">{{ tr('Clear') }}</button>
          <span v-else class="playlist-builder-clear-confirm"><span>{{ tr('Clear this draft?') }}</span><button type="button" @click="clearPlaylistDraft">{{ tr('Clear') }}</button><button type="button" @click="playlistClearPending=false">{{ tr('Cancel') }}</button></span>
          <button type="button" :disabled="!canSavePlaylistBuilder" @click="savePlaylistDraft(true)">{{ tr('Save as new') }}</button>
          <button type="button" class="primary" :disabled="!canSavePlaylistBuilder" @click="savePlaylistDraft(false)">{{ playlistBuilderSaving ? tr('Saving…') : tr('Save playlist') }}</button>
        </footer>
      </section>
    </div>
  </template>

  <template v-else>
    <div v-if="frame.kind !== 'artist'" class="hero">
      <div class="photo" :class="{placeholder: !frame.art || photoFailed}">
        <img v-if="frame.art && !photoFailed" :src="largeArt(frame.art)"
             alt="" @error="photoFailed = true">
        <span v-else aria-hidden="true">{{ initial }}</span>
      </div>
      <div class="name ell">{{ frame.label }}</div>
    </div>

    <section v-if="frame.kind === 'artist' && ui.albumMode !== 'tracks'" class="artist-detail-compact"
             :class="['artist-layout-'+ui.artistDetailLayout,'artist-controls-'+ui.artistDetailControls]">
      <div v-if="primaryAlbum" class="artist-primary-panel">
      <button type="button" class="artist-primary-album pointer" @click="openAlbum(primaryAlbum)">
        <span class="artist-primary-art" :class="{placeholder:!hasArt(primaryAlbum)}"><img v-if="hasArt(primaryAlbum)" :src="largeArt(primaryAlbum.art)" alt="" @error="markArtFailed(primaryAlbum)"><span v-else aria-hidden="true">♫</span></span>
        <span class="artist-primary-copy">
          <strong>{{ primaryAlbum.title }}</strong><span>{{ primaryAlbum.artist || frame.label }}</span>
          <small v-if="primaryAlbumDetails.songCount">{{ primaryAlbumDetails.songCount }} {{ tr(primaryAlbumDetails.songCount === 1 ? 'song' : 'songs') }}</small>
          <small>{{ tr('Year of this edition:') }} {{ primaryAlbum.year || tr('not available') }}</small>
          <small>{{ tr('Original year:') }} {{ primaryAlbum.originalYear || tr('not available') }}</small>
          <small v-if="primaryAlbumDetails.formatLine || primaryAlbumDetails.bitRateLine" class="artist-primary-technical">
            <span v-if="primaryAlbumDetails.formatLine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4 4V21.5H6zM14 2.5v4h4"/></svg>{{ primaryAlbumDetails.formatLine }}</span>
            <span v-if="primaryAlbumDetails.bitRateLine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-6M8 18V6M12 14v-4M16 19V5M20 15V9"/></svg>{{ primaryAlbumDetails.bitRateLine }}</span>
            <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v13H4zM7 15.5h.01M10 15.5h7"/></svg>{{ primaryAlbumDetails.originLine || primaryAlbum.source || tr('Local library') }}</span>
          </small>
          <small v-else>{{ primaryAlbum.source || tr('Local library') }}</small>
        </span>
      </button>
      <div class="artist-compact-controls" aria-label="Album playback">
        <button type="button" class="primary" aria-label="Play" title="Play" @click="playPrimaryAlbum"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="solid" d="M7 4.5 19 12 7 19.5z"/></svg><b>{{ tr('Play') }}</b></button>
        <button type="button" aria-label="Shuffle" title="Shuffle" @click="shufflePrimaryAlbum"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.2c4.5 0 5.1 10 9.6 10H20M17 14l3 3-3 3M4 17h3.2c1.8 0 3-1.6 4.1-3.5M15.5 7.8c.4-.5.8-.8 1.3-.8H20M17 4l3 3-3 3"/></svg><b>{{ tr('Shuffle') }}</b></button>
        <button v-if="store.equalizer.status==='ready'" type="button" aria-label="Equalizer" title="Equalizer" @click="openPrimaryEqualizer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M12 4v16M19 4v16"/><circle cx="5" cy="9" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="19" cy="8" r="2"/></svg><b>{{ tr('Equalizer') }}</b></button>
      </div>
      </div>
      <div class="artist-compact-sidecar" aria-labelledby="artist-enrichment-title">
        <div class="artist-compact-identity"><span class="artist-compact-photo" :class="{placeholder:!frame.art||photoFailed}"><img v-if="frame.art&&!photoFailed" :src="largeArt(frame.art)" alt="" @error="photoFailed=true"><span v-else aria-hidden="true">{{ initial }}</span></span><span><strong>{{ frame.label }}</strong><small id="artist-enrichment-title">{{ tr('Artist information') }}</small></span></div>
        <div v-if="enrichmentLoading" class="artist-enrichment-status" role="status">{{ tr('Finding artist information…') }}</div>
        <div v-else-if="enrichmentStatus === 'ready'">
          <p v-if="enrichment.biography" class="artist-biography" :class="{expanded:enrichmentExpanded}">{{ enrichment.biography }}</p>
          <p v-else class="artist-enrichment-status">{{ tr('No artist biography was found.') }}</p>
          <div class="artist-enrichment-links"><button v-if="enrichment.biography" type="button" :aria-expanded="enrichmentExpanded?'true':'false'" @click="enrichmentExpanded=!enrichmentExpanded">{{ tr(enrichmentExpanded?'Show less':'Read biography') }}</button><button type="button" @click="retryEnrichment">{{ tr('Refresh') }}</button><button type="button" @click="removeEnrichment">{{ tr('Hide for now') }}</button></div>
        </div>
        <div v-else class="artist-enrichment-status"><p>{{ artistEnrichmentMessage }}</p><button v-if="enrichmentStatus==='unavailable'" type="button" class="retry-command" @click="openPluginManager">{{ tr('Install plugin') }}</button><button v-else type="button" class="retry-command" @click="retryEnrichment">{{ tr('Try again') }}</button></div>
        <div v-if="primaryAlbumDetails.relatedArtists && primaryAlbumDetails.relatedArtists.length" class="album-extra album-related artist-related">
          <svg class="related-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19.5v-1.3c0-2.1-1.8-3.7-4-3.7H7c-2.2 0-4 1.6-4 3.7v1.3M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 8h5M18.5 5.5v5"/></svg>
          <div class="related-links"><strong>{{ tr('Local library') }}</strong><template v-for="(a,index) in primaryAlbumDetails.relatedArtists"><span v-if="index" :key="'artist-related-separator-'+a.id" class="related-separator" aria-hidden="true">•</span><button :key="'artist-related-'+a.id" type="button" @click="openRelatedArtist(a)">{{ a.name }}</button></template></div>
        </div>
      </div>
    </section>

    <section v-if="false" class="artist-enrichment" aria-labelledby="artist-enrichment-title">
      <h2 id="artist-enrichment-title">{{ tr('Artist information') }}</h2>
      <div v-if="enrichmentLoading" class="artist-enrichment-status" role="status">
        {{ tr('Finding artist information…') }}
      </div>
      <div v-else-if="enrichmentStatus === 'unavailable'" class="artist-enrichment-status">
        <p>{{ tr('Artist information requires MusicArtistInfo.') }}</p>
        <button type="button" class="retry-command" @click="openPluginManager">{{ tr('Install plugin') }}</button>
      </div>
      <div v-else-if="enrichmentStatus === 'error'" class="artist-enrichment-status" role="status">
        <p>{{ tr('MusicArtistInfo is temporarily unavailable. Your local library is unchanged.') }}</p>
        <button type="button" class="retry-command" @click="retryEnrichment">{{ tr('Try again') }}</button>
      </div>
      <div v-else-if="enrichmentStatus === 'review'" class="artist-enrichment-status">
        <p>{{ tr('Review match: only the artist name is available. Confirm before loading enrichment.') }}</p>
        <button type="button" class="retry-command" @click="acceptNameMatch">{{ tr('Use this match') }}</button>
      </div>
      <div v-else-if="enrichmentStatus === 'removed'" class="artist-enrichment-status">
        <p>{{ tr('Enrichment removed. Your local library is unchanged.') }}</p>
        <button type="button" class="retry-command" @click="retryEnrichment">{{ tr('Find metadata') }}</button>
      </div>
      <template v-else-if="enrichmentStatus === 'ready'">
        <p v-if="enrichment.biography" class="artist-biography" :class="{expanded: enrichmentExpanded}">{{ enrichment.biography }}</p>
        <p v-else class="artist-enrichment-status">{{ tr('No artist biography was found.') }}</p>
        <div class="artist-enrichment-links">
          <button v-if="enrichment.biography" type="button" class="retry-command artist-biography-toggle"
                  :aria-expanded="enrichmentExpanded ? 'true' : 'false'"
                  @click="enrichmentExpanded = !enrichmentExpanded">{{ tr(enrichmentExpanded ? 'Show less' : 'Read biography') }}</button>
          <button type="button" @click="retryEnrichment">{{ tr('Refresh') }}</button>
          <button type="button" @click="removeEnrichment">{{ tr('Hide for now') }}</button>
        </div>
      </template>
    </section>

    <section v-if="classicalWorks.length" class="classical-work-list" aria-labelledby="classical-works-title">
      <h2 id="classical-works-title" class="sectitle">{{ tr('Works') }} · {{ classicalWorks.length }}</h2>
      <button v-for="work in classicalWorks" :key="'work-' + work.id" type="button"
              class="row noart pointer" @click="openWork(work)">
        <span class="search-kind">W</span>
        <span class="ell"><span class="t ell">{{ work.title }}</span><span v-if="work.composer" class="s ell">{{ work.composer }}</span></span>
        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
      </button>
    </section>

    <template v-if="ui.albumMode === 'tracks'">
      <div v-for="a in albums" :key="'artist-track-album-' + a.id" class="artist-track-album">
        <section class="artist-detail-compact artist-track-album-summary"
                 :class="['artist-layout-'+ui.artistDetailLayout,'artist-controls-'+ui.artistDetailControls]">
          <div class="artist-primary-panel">
            <button type="button" class="artist-primary-album pointer" @click="openAlbum(a)">
              <span class="artist-primary-art" :class="{placeholder:!hasArt(a)}"><img v-if="hasArt(a)" :src="largeArt(a.art)" alt="" @error="markArtFailed(a)"><span v-else aria-hidden="true">♫</span></span>
              <span class="artist-primary-copy">
                <strong>{{ a.title }}</strong><span>{{ a.artist || frame.label }}</span>
                <small v-if="albumSummary(a).songCount">{{ albumSummary(a).songCount }} {{ tr(albumSummary(a).songCount === 1 ? 'song' : 'songs') }}</small>
                <small>{{ tr('Year of this edition:') }} {{ a.year || tr('not available') }}</small>
                <small>{{ tr('Original year:') }} {{ a.originalYear || tr('not available') }}</small>
                <small v-if="albumSummary(a).formatLine || albumSummary(a).bitRateLine" class="artist-primary-technical">
                  <span v-if="albumSummary(a).formatLine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4 4V21.5H6zM14 2.5v4h4"/></svg>{{ albumSummary(a).formatLine }}</span>
                  <span v-if="albumSummary(a).bitRateLine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-6M8 18V6M12 14v-4M16 19V5M20 15V9"/></svg>{{ albumSummary(a).bitRateLine }}</span>
                  <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v13H4zM7 15.5h.01M10 15.5h7"/></svg>{{ albumSummary(a).originLine || a.source || tr('Local library') }}</span>
                </small>
                <small v-else>{{ a.source || tr('Local library') }}</small>
              </span>
            </button>
            <div class="artist-compact-controls" aria-label="Album playback">
              <button type="button" class="primary" aria-label="Play" title="Play" @click="playPrimaryAlbum(a)"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="solid" d="M7 4.5 19 12 7 19.5z"/></svg><b>{{ tr('Play') }}</b></button>
              <button type="button" aria-label="Shuffle" title="Shuffle" @click="shufflePrimaryAlbum(a)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.2c4.5 0 5.1 10 9.6 10H20M17 14l3 3-3 3M4 17h3.2c1.8 0 3-1.6 4.1-3.5M15.5 7.8c.4-.5.8-.8 1.3-.8H20M17 4l3 3-3 3"/></svg><b>{{ tr('Shuffle') }}</b></button>
              <button v-if="store.equalizer.status==='ready'" type="button" aria-label="Equalizer" title="Equalizer" @click="openPrimaryEqualizer(a)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M12 4v16M19 4v16"/><circle cx="5" cy="9" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="19" cy="8" r="2"/></svg><b>{{ tr('Equalizer') }}</b></button>
            </div>
          </div>
          <div class="artist-compact-sidecar" :aria-labelledby="artistEnrichmentTitleId(a)">
            <div class="artist-compact-identity"><span class="artist-compact-photo" :class="{placeholder:!detailArtistPhoto||photoFailed}"><img v-if="detailArtistPhoto&&!photoFailed" :src="largeArt(detailArtistPhoto)" alt="" @error="photoFailed=true"><span v-else aria-hidden="true">{{ detailArtistInitial(a) }}</span></span><span><strong>{{ detailArtistLabel(a) }}</strong><small :id="artistEnrichmentTitleId(a)">{{ tr('Artist information') }}</small></span></div>
            <div v-if="enrichmentLoading" class="artist-enrichment-status" role="status">{{ tr('Finding artist information…') }}</div>
            <div v-else-if="enrichmentStatus === 'ready'">
              <p v-if="enrichment.biography" class="artist-biography" :class="{expanded:enrichmentExpanded}">{{ enrichment.biography }}</p>
              <p v-else class="artist-enrichment-status">{{ tr('No artist biography was found.') }}</p>
              <div class="artist-enrichment-links"><button v-if="enrichment.biography" type="button" :aria-expanded="enrichmentExpanded?'true':'false'" @click="enrichmentExpanded=!enrichmentExpanded">{{ tr(enrichmentExpanded?'Show less':'Read biography') }}</button><button type="button" @click="retryEnrichment">{{ tr('Refresh') }}</button><button type="button" @click="removeEnrichment">{{ tr('Hide for now') }}</button></div>
            </div>
            <div v-else class="artist-enrichment-status"><p>{{ artistEnrichmentMessage }}</p><button v-if="enrichmentStatus==='unavailable'" type="button" class="retry-command" @click="openPluginManager">{{ tr('Install plugin') }}</button><button v-else type="button" class="retry-command" @click="retryEnrichment">{{ tr('Try again') }}</button></div>
            <div v-if="albumSummary(a).relatedArtists && albumSummary(a).relatedArtists.length" class="album-extra album-related artist-related">
              <svg class="related-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19.5v-1.3c0-2.1-1.8-3.7-4-3.7H7c-2.2 0-4 1.6-4 3.7v1.3M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 8h5M18.5 5.5v5"/></svg>
              <div class="related-links"><strong>{{ tr('Local library') }}</strong><template v-for="(related,index) in albumSummary(a).relatedArtists"><span v-if="index" :key="'track-artist-related-separator-'+a.id+'-'+related.id" class="related-separator" aria-hidden="true">•</span><button :key="'track-artist-related-'+a.id+'-'+related.id" type="button" @click="openRelatedArtist(related)">{{ related.name }}</button></template></div>
            </div>
          </div>
        </section>
        <lms-album-block :album="a" :enrich="false" :show-related="false"
                         :continuation="true"
                         @summary="captureAlbumSummary"></lms-album-block>
      </div>
      <div v-if="!albums.length" class="empty"><div class="p">No albums for this item.</div></div>
    </template>

    <template v-else>
      <div class="sectitle">{{ tr('Local library') }} · {{ localAlbums.length }}</div>
      <div class="albumgrid">
	        <button v-for="a in remainingLocalAlbums" :key="'g' + a.id" type="button"
	                class="gcell pointer" @click="openAlbum(a)">
	          <span class="gart" :class="{placeholder: !hasArt(a)}">
	            <img v-if="hasArt(a)" :src="largeArt(a.art)" alt="" @error="markArtFailed(a)">
	            <span v-else class="art-placeholder" aria-hidden="true">♫</span>
	          </span>
	          <span class="gtitle ell">{{ a.title }}</span>
	          <span class="gsub ell">{{ editionLine(a) }}</span>
	        </button>
      </div>
      <template v-if="connectedAlbums.length">
        <div class="sectitle">{{ tr('Also on connected services') }}</div>
        <div class="albumgrid">
          <button v-for="a in connectedAlbums" :key="'remote' + a.id" type="button" class="gcell pointer" @click="openAlbum(a)">
            <span class="gart" :class="{placeholder: !hasArt(a)}"><img v-if="hasArt(a)" :src="largeArt(a.art)" alt="" @error="markArtFailed(a)"><span v-else class="art-placeholder" aria-hidden="true">♫</span></span>
            <span class="gtitle ell">{{ a.title }}</span><span class="gsub ell">{{ a.source }}</span>
          </button>
        </div>
      </template>
      <div v-if="!albums.length" class="empty"><div class="p">No albums for this item.</div></div>
    </template>
    <div v-if="listTruncated" class="loading-more warning" role="status">
      This list has more than 1,000 albums and this screen shows the first 1,000.
    </div>
  </template>
</div>`,
  data: function () {
    return { store: LmsStore.state, ui: LmsUi.state, albums: [], blocks: [], classicalWorks: [], folderItems: [], folderRoots: [],
             folderChildren: {}, folderExpanded: {}, folderLoading: {},
             folderFilter: '', folderSort: 'name', folderFocusedKey: '',
             playlistBuilderOpen: false, playlistBuilderMobileView: 'browse', playlistDraftName: '', playlistDraftTracks: [],
             playlistDraftSequence: 0, playlistDragIndex: null, playlistDraggedTrack: null, playlistDropIndex: null,
             playlistBuilderSaving: false, playlistBuilderNotice: '', playlistClearPending: false,
             artist: null, failedArt: {}, photoFailed: false, primaryAlbumDetails: {}, albumSummaries: {},
             loading: true, error: '', requestToken: 0,
             enrichmentLoading: false, enrichmentStatus: '', enrichment: {}, enrichmentExpanded: false,
             nameMatchAccepted: false,
             discographyTruncated: false, listTruncated: false };
  },
  computed: {
    initial: function () {
      return ((this.frame.label || '?').trim().charAt(0) || '?').toUpperCase();
    },
    bigArt: function () { return this.frame.art ? this.frame.art.replace('_50x50', '') : ''; },
    artistName: function () {
      return this.artist ? this.artist.name : ((this.frame.sub || '').split(' • ')[0] || '—');
    },
    enrichmentRetrieved: function () {
      if (!this.enrichment.retrievedAt) return '';
      try { return new Date(this.enrichment.retrievedAt).toLocaleString(); }
      catch (e) { return String(this.enrichment.retrievedAt); }
    },
    localAlbums: function () { return this.albums.filter(function (a) { return !a.source || a.source === 'Local library'; }); },
    primaryAlbum: function () { return this.localAlbums.length ? this.localAlbums[0] : null; },
    remainingLocalAlbums: function () { return this.frame.kind === 'artist' ? this.localAlbums.slice(1) : this.localAlbums; },
    artistEnrichmentMessage: function () {
      if (this.enrichmentStatus === 'unavailable') return this.tr('Artist information requires MusicArtistInfo.');
      if (this.enrichmentStatus === 'removed') return this.tr('Enrichment removed. Your local library is unchanged.');
      if (this.enrichmentStatus === 'review') return this.tr('Review match: only the artist name is available. Confirm before loading enrichment.');
      return this.tr('MusicArtistInfo is temporarily unavailable. Your local library is unchanged.');
    },
    connectedAlbums: function () { return this.albums.filter(function (a) { return a.source && a.source !== 'Local library'; }); },
    detailArtistPhoto: function () {
      return /^(artist|composer|conductor|ensemble)$/.test(this.frame.kind)
        ? (this.enrichment.photoUrl || this.frame.art || '') : '';
    },
    folderCountLabel: function () {
      var folders = this.folderItems.filter(function (item) { return item.type === 'folder'; }).length;
      var tracks = this.folderItems.length - folders;
      if (folders && tracks) return folders + ' ' + this.tr(folders === 1 ? 'folder' : 'folders') + ' · ' + tracks + ' ' + this.tr(tracks === 1 ? 'track' : 'tracks');
      if (folders) return folders + ' ' + this.tr(folders === 1 ? 'folder' : 'folders');
      return tracks + ' ' + this.tr(tracks === 1 ? 'track' : 'tracks');
    },
    folderBreadcrumbs: function () {
      return (LmsNav.stacks.music || []).filter(function (item) { return item && item.kind === 'musicfolder'; }).map(function (item) {
        return { key:String(item.id), id:item.id, label:item.label, path:item.path };
      });
    },
    folderRootId: function () {
      return this.folderBreadcrumbs.length ? this.folderBreadcrumbs[0].id : this.frame.id;
    },
    playlistBuilderCountLabel: function () {
      var count = this.playlistDraftTracks.length;
      var duration = this.playlistDraftTracks.reduce(function (total, track) { return total + Number(track.duration || 0); }, 0);
      return count + ' ' + this.tr(count === 1 ? 'track' : 'tracks') + (duration ? ' · ' + LmsFmt.duration(duration) : '');
    },
    canSavePlaylistBuilder: function () {
      return !!this.playlistDraftName.trim() && !!this.playlistDraftTracks.length && !this.playlistBuilderSaving;
    },
    folderTreeRows: function () {
      var self = this, rows = [], query = this.normalizeFolderText(this.folderFilter);
      function childrenFor(item) { return self.folderChildren[String(item.key || item.id)] || []; }
      function matches(item) {
        if (!query) return true;
        if (self.normalizeFolderText(item.name).indexOf(query) >= 0) return true;
        return childrenFor(item).some(matches);
      }
      function append(items, depth) {
        self.sortFolderItems(items || []).forEach(function (item) {
          if (!matches(item)) return;
          var key = String(item.key || item.id), expanded = !!self.folderExpanded[key];
          rows.push({ key:key, item:item, depth:depth, expanded:expanded, loading:!!self.folderLoading[key] });
          if (expanded || query) append(self.folderChildren[key] || [], depth + 1);
        });
      }
      append(this.folderItems, 0);
      return rows;
    },
    /* No modo Albuns a pagina mostra so o album escolhido; no modo Faixas ela
       empilha a discografia inteira. */
    visibleBlocks: function () {
      return this.ui.albumMode === 'tracks' ? this.blocks : this.blocks.slice(0, 1);
    }
  },
  watch: {
    frame: function () { this.load(); }
  },
  methods: {
    captureAlbumSummary: function (summary) {
      if (!summary || summary.id == null) return;
      this.$set(this.albumSummaries, String(summary.id), summary);
      if (this.primaryAlbum && String(summary.id) === String(this.primaryAlbum.id)) this.primaryAlbumDetails = summary;
    },
    albumSummary: function (album) { return this.albumSummaries[String(album && album.id)] || {}; },
    artistEnrichmentTitleId: function (album) { return 'artist-enrichment-title-' + String(album && album.id); },
    albumArtistLabel: function (album) {
      return (this.artist && this.artist.name) || (album && album.artist) ||
        (this.frame.kind === 'artist' ? this.frame.label : this.tr('Unknown Artist'));
    },
    albumArtistInitial: function (album) {
      return (this.albumArtistLabel(album).trim().charAt(0) || '?').toUpperCase();
    },
    detailUsesFrameArtist: function () {
      return /^(artist|composer|conductor|ensemble)$/.test(this.frame.kind);
    },
    detailArtistLabel: function (album) {
      return this.detailUsesFrameArtist() ? this.frame.label : this.albumArtistLabel(album);
    },
    detailArtistInitial: function (album) {
      return (this.detailArtistLabel(album).trim().charAt(0) || '?').toUpperCase();
    },
    openRelatedArtist: function (artist) {
      if (!artist) return;
      LmsUi.setMusicView('albums');
      LmsUi.setGroup(['relatedArtist']);
      Vue.nextTick(function () {
        LmsNav.push('music', { kind:'artist', id:artist.id, ids:artist.ids, label:artist.name, art:null });
      });
    },
    playPrimaryAlbum: function (selectedAlbum) {
      var album = selectedAlbum || this.primaryAlbum;
      if (album && album.id != null) return LmsStore.playContainer('album_id', album.id, 0);
    },
    shufflePrimaryAlbum: function (selectedAlbum) {
      var album = selectedAlbum || this.primaryAlbum;
      if (!album || album.id == null) return;
      return LmsStore.playContainer('album_id', album.id, 0).then(function () { return LmsStore.cycleShuffle(); });
    },
    openPrimaryEqualizer: function (selectedAlbum) {
      var album = selectedAlbum || this.primaryAlbum;
      if (!album || album.id == null) return;
      LmsStore.setEqualizerContext({
        type: 'album', albumKey: String(album.id), albumTitle: album.title || '',
        artist: album.artist || '', artistLabel: album.artist || '',
        year: album.originalYear || album.year || ''
      });
      LmsUi.setTab('settings');
      LmsNav.push('settings', { label:'Equalizer', screen:'equalizer' });
      this.ui.appearanceScreen = 'equalizer';
    },
    folderTrackActionAnchor: function (event) {
      if (!event || window.innerWidth <= 520) return null;
      if (event.clientX || event.clientY) return {
        left:event.clientX, right:event.clientX, top:event.clientY, bottom:event.clientY, width:0, height:0
      };
      var target = event.currentTarget;
      if (!target || !target.getBoundingClientRect) return null;
      var rect = target.getBoundingClientRect(), x = rect.left + Math.min(rect.width * .72, rect.width - 24), y = rect.top + rect.height / 2;
      return { left:x, right:x, top:y, bottom:y, width:0, height:0 };
    },
    openFolderItem: function (item, event) {
      if (item.type === 'folder') {
        LmsNav.push('music', { kind: 'musicfolder', id: item.id, label: item.name, path: item.path });
      } else {
        LmsUi.openActions({ kind: 'track', id: item.id, title: item.title || item.name, url: item.url }, this.folderTrackActionAnchor(event));
      }
    },
    openPlaylistBuilder: function () {
      this.playlistBuilderOpen = true;
      this.playlistBuilderMobileView = 'builder';
    },
    closePlaylistBuilder: function () {
      this.playlistBuilderOpen = false;
      this.playlistBuilderMobileView = 'browse';
      this.clearPlaylistDrag();
    },
    togglePlaylistBuilder: function () {
      if (this.playlistBuilderOpen) return this.closePlaylistBuilder();
      this.openPlaylistBuilder();
    },
    playlistTrackFromFolder: function (item) {
      return {
        draftKey: 'folder-track-' + (++this.playlistDraftSequence),
        id: item.id, title: item.title || item.name || this.tr('Unknown track'),
        artist: item.artist || '', path: item.path || '', url: item.url || '', duration: Number(item.duration || 0)
      };
    },
    appendTrackToDraft: function (item) {
      this.playlistDraftTracks.push(this.playlistTrackFromFolder(item));
      this.playlistBuilderOpen = true;
      this.playlistBuilderNotice = this.tr('Track added to playlist draft.');
    },
    folderTrackDragStart: function (item, event) {
      this.playlistDraggedTrack = this.playlistTrackFromFolder(item);
      this.playlistDragIndex = null;
      this.playlistBuilderOpen = true;
      if (event && event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', item.title || item.name || 'track');
      }
    },
    playlistTrackDragStart: function (index, event) {
      this.playlistDragIndex = index;
      this.playlistDraggedTrack = this.playlistDraftTracks[index];
      if (event && event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      }
    },
    setPlaylistDropIndex: function (index) { this.playlistDropIndex = index; },
    playlistRowDragOver: function (index, event) {
      var rect = event.currentTarget.getBoundingClientRect();
      this.playlistDropIndex = event.clientY < rect.top + rect.height / 2 ? index : index + 1;
    },
    playlistRowDragLeave: function (index, event) {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      if (this.playlistDropIndex === index || this.playlistDropIndex === index + 1) this.playlistDropIndex = null;
    },
    clearPlaylistDrop: function () { this.playlistDropIndex = null; },
    clearPlaylistDrag: function () {
      this.playlistDragIndex = null;
      this.playlistDraggedTrack = null;
      this.playlistDropIndex = null;
    },
    dropTrackAt: function (targetIndex) {
      if (!this.playlistDraggedTrack) return this.clearPlaylistDrag();
      var track = this.playlistDraggedTrack;
      var from = this.playlistDragIndex;
      var insertAt = Math.max(0, Math.min(this.playlistDraftTracks.length, Number(targetIndex)));
      if (from != null) {
        this.playlistDraftTracks.splice(from, 1);
        if (from < insertAt) insertAt--;
      }
      this.playlistDraftTracks.splice(insertAt, 0, track);
      this.playlistBuilderNotice = this.tr(from == null ? 'Track added to playlist draft.' : 'Playlist order updated.');
      this.clearPlaylistDrag();
    },
    moveDraftTrack: function (index, delta) {
      var target = index + delta;
      if (target < 0 || target >= this.playlistDraftTracks.length) return;
      var track = this.playlistDraftTracks.splice(index, 1)[0];
      this.playlistDraftTracks.splice(target, 0, track);
      this.playlistBuilderNotice = this.tr('Playlist order updated.');
    },
    removeDraftTrack: function (index) {
      this.playlistDraftTracks.splice(index, 1);
      this.playlistBuilderNotice = this.tr('Track removed from playlist draft.');
    },
    clearPlaylistDraft: function () {
      this.playlistDraftTracks = [];
      this.playlistClearPending = false;
      this.playlistBuilderNotice = this.tr('Playlist draft cleared.');
    },
    uniquePlaylistName: async function (name) {
      var lists = await LmsApi.playlists(0, 500), normalized = name.toLowerCase(), suffix = 2;
      var used = lists.some(function (list) { return String(list.name || '').toLowerCase() === normalized; });
      if (!used) return name;
      while (lists.some(function (list) { return String(list.name || '').toLowerCase() === (name + ' ' + suffix).toLowerCase(); })) suffix++;
      return name + ' ' + suffix;
    },
    replacePlaylistContents: async function (playlistId, tracks) {
      var existing = await LmsApi.playlistTracks(playlistId, 0, 10000);
      for (var index = existing.length - 1; index >= 0; index--) await LmsApi.editPlaylist(playlistId, 'delete', { index:index });
      for (var i = 0; i < tracks.length; i++) await LmsApi.editPlaylist(playlistId, 'add', { title:tracks[i].title, url:tracks[i].url });
    },
    savePlaylistDraft: async function (saveAsNew) {
      if (!this.canSavePlaylistBuilder) return;
      this.playlistBuilderSaving = true;
      this.playlistBuilderNotice = this.tr('Saving playlist…');
      try {
        var name = this.playlistDraftName.trim();
        if (saveAsNew) name = await this.uniquePlaylistName(name);
        var result = await LmsApi.createPlaylist(name);
        if (result.id == null) throw new Error(this.tr('The playlist could not be created.'));
        await this.replacePlaylistContents(result.id, this.playlistDraftTracks.slice());
        this.playlistDraftName = name;
        this.playlistBuilderNotice = this.tr('Playlist saved.') + ' ' + name;
      } catch (e) {
        console.warn('[Echo Classic] playlist builder save:', e);
        this.playlistBuilderNotice = this.tr('Could not save playlist.') + ' ' +
          this.tr(LmsStore.friendlyError(e, 'Check the connection and try again.'));
      }
      this.playlistBuilderSaving = false;
    },
    openFolderRoot: function (root) {
      LmsNav.reset('music');
      LmsNav.push('music', { kind:'musicfolder', id:root.id, label:root.name, path:root.path });
    },
    chooseFolderSource: function (id) {
      if (id === '') return this.backToMusic();
      var root = this.folderRoots.filter(function (item) { return String(item.id) === String(id); })[0];
      if (root) this.openFolderRoot(root);
    },
    openFolderCrumb: function (index) {
      var keep = index + 1;
      while (LmsNav.depth('music') > keep) LmsNav.pop('music');
    },
    folderTreeAction: function (row) {
      if (row.item.type !== 'folder') return this.openFolderItem(row.item);
      return this.toggleFolderTree(row);
    },
    toggleFolderTree: async function (row) {
      var key = row.key;
      if (this.folderExpanded[key]) { this.$set(this.folderExpanded, key, false); return; }
      this.$set(this.folderExpanded, key, true);
      if (this.folderChildren[key]) return;
      this.$set(this.folderLoading, key, true);
      try {
        var children = await LmsApi.musicFolders(this.store.playerId || '', row.item.id);
        this.$set(this.folderChildren, key, children);
      } catch (e) {
        this.$set(this.folderExpanded, key, false);
        LmsUi.notify(this.serviceError(e), 'error', 5000);
      }
      this.$set(this.folderLoading, key, false);
    },
    collapseFolders: function () { this.folderExpanded = {}; },
    expandFolders: async function () {
      var self = this;
      await Promise.all(this.folderItems.filter(function (item) { return item.type === 'folder'; }).map(function (item) {
        var key = String(item.key || item.id);
        if (self.folderExpanded[key]) return Promise.resolve();
        return self.toggleFolderTree({ key:key, item:item });
      }));
    },
    folderTreeCount: function (row) {
      if (row.item.type !== 'folder') return '—';
      if (row.loading) return this.tr('Loading…');
      var children = this.folderChildren[row.key];
      if (!children) return this.tr('Not loaded');
      var folders = children.filter(function (item) { return item.type === 'folder'; }).length;
      var tracks = children.length - folders;
      if (folders && tracks) return folders + ' ' + this.tr(folders === 1 ? 'folder' : 'folders') + ' · ' + tracks + ' ' + this.tr(tracks === 1 ? 'track' : 'tracks');
      if (folders) return folders + ' ' + this.tr(folders === 1 ? 'folder' : 'folders');
      return tracks + ' ' + this.tr(tracks === 1 ? 'track' : 'tracks');
    },
    normalizeFolderText: function (value) {
      return String(value || '').normalize ? String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : String(value || '').toLowerCase();
    },
    sortFolderItems: function (items) {
      var self = this, direction = this.folderSort === 'name-desc' ? -1 : 1;
      return items.slice().sort(function (a, b) {
        if (self.folderSort === 'type' && a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        if (self.folderSort === 'count') {
          var aChildren = self.folderChildren[String(a.key || a.id)];
          var bChildren = self.folderChildren[String(b.key || b.id)];
          var delta = (bChildren ? bChildren.length : -1) - (aChildren ? aChildren.length : -1);
          if (delta) return delta;
        }
        return direction * String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity:'base', numeric:true });
      });
    },
    folderRowTabindex: function (row) {
      var first = this.folderTreeRows.length ? this.folderTreeRows[0].key : '';
      var keys = this.folderTreeRows.map(function (item) { return item.key; });
      var active = keys.indexOf(this.folderFocusedKey) >= 0 ? this.folderFocusedKey : first;
      return active === row.key ? 0 : -1;
    },
    folderDisclosureLabel: function (row) {
      return this.tr(row.expanded ? 'Collapse folder' : 'Expand folder') + ': ' + row.item.name;
    },
    focusFolderRow: function (index) {
      var rows = this.$refs.folderRows || [];
      if (!Array.isArray(rows)) rows = [rows];
      index = Math.max(0, Math.min(rows.length - 1, index));
      var target = rows[index];
      if (!target) return;
      this.folderFocusedKey = this.folderTreeRows[index].key;
      this.$nextTick(function () { target.focus(); });
    },
    folderTreeKeydown: function (row, event) {
      var rows = this.folderTreeRows;
      var index = rows.map(function (item) { return item.key; }).indexOf(row.key);
      if (index < 0) return;
      if (event.key === 'ArrowDown') { event.preventDefault(); return this.focusFolderRow(index + 1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); return this.focusFolderRow(index - 1); }
      if (event.key === 'Home') { event.preventDefault(); return this.focusFolderRow(0); }
      if (event.key === 'End') { event.preventDefault(); return this.focusFolderRow(rows.length - 1); }
      if (event.key === 'ArrowRight' && row.item.type === 'folder') {
        event.preventDefault();
        if (!row.expanded) return this.toggleFolderTree(row);
        if (rows[index + 1] && rows[index + 1].depth > row.depth) return this.focusFolderRow(index + 1);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (row.item.type === 'folder' && row.expanded) return this.toggleFolderTree(row);
        for (var i = index - 1; i >= 0; i--) if (rows[i].depth < row.depth) return this.focusFolderRow(i);
      }
      if (event.key === 'Enter') { event.preventDefault(); return this.openFolderItem(row.item, event); }
      if ((event.key === ' ' || event.key === 'Spacebar') && row.item.type === 'folder') { event.preventDefault(); return this.toggleFolderTree(row); }
    },
    folderItemContext: function (item) {
      var type = this.tr(item.type === 'folder' ? 'Folder' : 'Track');
      return item.path ? type + ' · ' + item.path : type;
    },
    backToMusic: function () { this.$emit('exit'); },
    tr: function (text) {
      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
    },
    /* Mesma familia do ERR-01 que a tela de Apps mostrava: aqui o catch
       tambem entregava e.message inteiro, com o marcador do tipo de falha e o
       comando RPC. friendlyError deixa a string do protocolo no console; a
       tela recebe a familia da falha e a acao humana. */
    serviceError: function (e) {
      return this.tr(LmsStore.friendlyError(e, 'This screen did not load.')) + ' ' +
        this.tr('Check the connection or the service status and try again.');
    },
    largeArt: function (url) { return (url || '').replace('_50x50', ''); },
    hasArt: function (album) { return !!album.art && !this.failedArt[album.id]; },
    markArtFailed: function (album) { this.$set(this.failedArt, album.id, true); },
    artistInfoCacheRead: function () {
      try {
        var parsed = JSON.parse(localStorage.getItem(ECHOCLASSIC_ARTIST_INFO_CACHE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    },
    artistInfoCacheGet: function (id) {
      var key = String(id == null ? '' : id);
      var entry = this.artistInfoCacheRead().filter(function (item) {
        return item && item.key === key && item.value;
      })[0];
      return entry ? entry.value : null;
    },
    artistInfoCachePut: function (id, value) {
      var key = String(id == null ? '' : id);
      var safe = {
        biography: value.biography || '', photoCredits: value.photoCredits || '',
        /* Never persist provider query strings or remote URLs. Relative LMS
           image-proxy paths without a query are safe to retain. */
        photoUrl: /^\/?(?:imageproxy\/|music\/)/.test(value.photoUrl || '') &&
          String(value.photoUrl).indexOf('?') < 0 ? value.photoUrl : '',
        retrievedAt: value.retrievedAt
      };
      var rows = this.artistInfoCacheRead().filter(function (item) { return item && item.key !== key; });
      rows.unshift({ key: key, retrievedAt: value.retrievedAt, value: safe });
      try { localStorage.setItem(ECHOCLASSIC_ARTIST_INFO_CACHE_KEY,
        JSON.stringify(rows.slice(0, ECHOCLASSIC_ARTIST_INFO_CACHE_LIMIT))); } catch (e) {}
    },
    loadEnrichment: async function (token, force) {
      var subject = this.frame.kind === 'album' ? this.artist : this.frame;
      if (!subject || (this.frame.kind !== 'artist' && this.frame.kind !== 'album')) return;
      if (subject.id == null && !this.nameMatchAccepted) {
        this.enrichmentStatus = 'review';
        this.enrichmentLoading = false;
        return;
      }
      var cacheKey = subject.id != null ? subject.id : subject.name || subject.label;
      var cached = !force && this.artistInfoCacheGet(cacheKey);
      if (cached) {
        this.enrichment = cached;
        this.enrichmentStatus = 'ready';
        this.enrichmentLoading = false;
        return;
      }
      this.enrichmentLoading = true;
      this.enrichmentStatus = '';
      try {
        var result = await LmsApi.musicArtistInfo(this.store.playerId || '', subject.id,
          subject.name || subject.label);
        if (token !== this.requestToken) return;
        if (!result.available) {
          this.enrichmentStatus = 'unavailable';
        } else if (!result.biography && !result.photoUrl &&
                   (result.biographyError || result.photoError)) {
          this.enrichmentStatus = 'error';
        } else {
          this.enrichment = {
            biography: result.biography || '', photoUrl: result.photoUrl || '',
            photoCredits: result.photoCredits || '', retrievedAt: Date.now()
          };
          this.enrichmentStatus = 'ready';
          this.artistInfoCachePut(cacheKey, this.enrichment);
        }
      } catch (e) {
        if (token !== this.requestToken) return;
        this.enrichmentStatus = 'error';
      }
      if (token === this.requestToken) this.enrichmentLoading = false;
    },
    retryEnrichment: function () { this.requestToken++; this.loadEnrichment(this.requestToken, true); },
    acceptNameMatch: function () { this.nameMatchAccepted = true; this.requestToken++; this.loadEnrichment(this.requestToken, true); },
    removeEnrichment: function () {
      this.requestToken++;
      this.enrichment = {};
      this.enrichmentStatus = 'removed';
    },
    openPluginManager: function () {
      try { sessionStorage.setItem('echoclassic.plugin-search.v1', 'MusicArtistInfo'); } catch (e) {}
      this.ui.advancedSettingsPage = '/echoclassic/settings/server/plugins.html';
      LmsUi.setTab('settings');
      LmsNav.push('settings', { label: 'Advanced LMS settings', advanced: true });
      this.ui.advancedSettings = true;
      this.ui.advancedSettingsDirty = false;
    },
    editionLine: function (album) {
      var parts = [];
      if (album.editionCount > 1) parts.push('Edition ' + (album.year || 'Not specified'));
      else if (album.year) parts.push(String(album.year));
      if (album.originalYear) parts.push('original ' + album.originalYear);
      if (!parts.length && album.artist) parts.push(album.artist);
      return parts.join(' • ');
    },
    editionBase: function (title) {
      return String(title || '').toLowerCase()
        .replace(/\s*[\[(](deluxe|expanded|remaster(?:ed)?|anniversary|edition|edição|reissue|mono|stereo).*?[\])]\s*/gi, '')
        .replace(/\s*[-–—]\s*(deluxe|expanded|remaster(?:ed)?|anniversary|edition|edição|reissue).*$/gi, '')
        .trim();
    },
    markEditions: function (albums) {
      var self = this;
      var counts = {};
      albums.forEach(function (a) {
        var key = self.editionBase(a.title);
        counts[key] = (counts[key] || 0) + 1;
      });
      albums.forEach(function (a) { a.editionCount = counts[self.editionBase(a.title)] || 1; });
      return albums.sort(function (a, b) {
        var base = self.editionBase(a.title).localeCompare(self.editionBase(b.title), 'pt-BR');
        return base || Number(a.year || 0) - Number(b.year || 0);
      });
    },
    fmtDur: function (s) { return LmsFmt.duration(s); },
    hires: function (t) { return LmsFmt.isHiRes(t.sampleRate, t.sampleSize); },
    shortRate: function (t) {
      if (!t.sampleRate) return '';
      return t.sampleRate >= 2822400 ? 'DSD' : Math.round(t.sampleRate / 1000) + 'k';
    },
    openArtist: function () {
      if (!this.artist) return;
      LmsNav.push('music', {
        kind: 'artist', id: this.artist.id, ids: this.artist.ids,
        label: this.artist.name, art: null
      });
    },
    openAlbum: function (a) {
      LmsNav.push('music', {
        kind: 'album', id: a.id, label: a.title,
        sub: [a.artist, a.year || null].filter(Boolean).join(' • '),
        art: a.art, year: a.year, originalYear: a.originalYear
      });
    },
    openWork: function (work) {
      LmsNav.push('music', { kind: 'work', id: work.id, label: work.title,
        sub: work.composer || this.frame.label, composerId: work.composerId });
    },
    /* Carregar o album inteiro e saltar para a faixa e o que o LMS faz. Mandar
       so a faixa deixava a fila do servidor com um item e sem "proxima". */
    playTrack: function (t) {
      var i = this.tracks.findIndex(function (x) { return x.id === t.id; });
      LmsStore.playContainer('album_id', this.frame.id, i > 0 ? i : 0);
    },
    playAll: function () {
      if (this.tracks.length) LmsStore.playContainer('album_id', this.frame.id, 0);
    },
    shuffle: function () {
      if (!this.tracks.length) return;
      LmsStore.playContainer('album_id', this.frame.id, 0).then(function () {
        return LmsStore.cycleShuffle();
      });
    },
    load: async function () {
      /* O componente e reaproveitado entre quadros (browse.js o renderiza sem
         :key) e o watch de frame dispara um load novo por cima do anterior. Sem
         token, a resposta lenta do artista A sobrescrevia a tela do artista B
         ja renderizada. Mesmo padrao de browse.js. */
      var token = ++this.requestToken;
      this.loading = true;
      this.error = '';
      this.albums = [];
      this.blocks = [];
      this.classicalWorks = [];
      this.folderItems = [];
      this.folderRoots = [];
      this.folderChildren = {};
      this.folderExpanded = {};
      this.folderLoading = {};
      this.folderFilter = '';
      this.folderFocusedKey = '';
      this.artist = null;
      this.failedArt = {};
      this.photoFailed = false;
      this.primaryAlbumDetails = {};
      this.albumSummaries = {};
      this.enrichmentLoading = false;
      this.enrichmentStatus = '';
      this.enrichment = {};
      this.enrichmentExpanded = false;
      this.nameMatchAccepted = false;
      this.discographyTruncated = false;
      this.listTruncated = false;
      var pid = this.store.playerId || '';
      var f = this.frame;
      try {
        if (f.kind === 'musicfolder') {
          var folderResult = await Promise.all([LmsApi.musicFolders(pid, f.id), LmsApi.musicFolders(pid, null)]);
          if (token !== this.requestToken) return;
          this.folderItems = folderResult[0];
          this.folderRoots = folderResult[1].filter(function (item) { return item.type === 'folder'; });
          this.loading = false;
          return;
        } else if (f.kind === 'album') {
          /* O album escolhido vem primeiro e o resto da discografia abaixo, cada
             um como um bloco completo. Cada bloco busca as proprias faixas, entao
             a tela aparece em partes em vez de esperar all os albuns. */
          var current = {
            id: f.id, title: f.label, art: f.art,
            year: f.year || ((f.sub || '').split(' • ')[1] || ''),
            originalYear: f.originalYear || 0,
            artist: (f.sub || '').split(' • ')[0] || ''
          };
          this.blocks = [current];
          this.loading = false;
          var quem = await LmsApi.artistOfAlbum(pid, f.id);
          if (token !== this.requestToken) return;
          this.artist = quem;
          if (this.artist) {
            this.loadEnrichment(token, false);
            var artistFilter = this.artist.ids && this.artist.ids.length > 1
              ? { artistIds: this.artist.ids }
              : { artistId: this.artist.id };
            var all = await LmsApi.albums(pid, 0, 200, artistFilter);
            if (token !== this.requestToken) return;
            this.discographyTruncated = all.length >= 200;
            this.blocks = [current].concat(all
              .filter(function (x) { return x.id !== f.id; })
              .map(function (x) {
                return { id: x.id, title: x.title, year: x.year,
                         originalYear: x.originalYear, releaseType: x.releaseType,
                         artist: x.artist,
                         art: LmsFmt.coverUrl(x.artworkTrackId, 50) || null };
              }));
            var marked = this.markEditions(this.blocks);
            var selected = marked.filter(function (album) { return album.id === f.id; })[0] || current;
            this.blocks = [selected].concat(marked.filter(function (album) { return album.id !== f.id; }));
          }
          return;
        } else {
          var filter = {};
          if (/^(artist|composer|conductor|ensemble)$/.test(f.kind)) {
            this.loadEnrichment(token, false);
            if (f.ids && f.ids.length > 1) filter.artistIds = f.ids;
            else filter.artistId = f.id;
            if (f.kind !== 'artist') {
              var roleId = f.kind === 'composer' ? 2 : f.kind === 'conductor' ? 3 : 4;
              this.classicalWorks = await LmsApi.works(pid, 0, 1000, { composerId: f.id, roleId: roleId });
              if (token !== this.requestToken) return;
            }
          }
          else if (f.kind === 'genre') filter.genreId = f.id;
          else if (f.kind === 'year') filter.year = f.id;
          else if (f.kind === 'work') filter.workId = f.id;
          else if (f.kind === 'releasetype') filter.releaseType = f.label;
          var al = await LmsApi.albums(pid, 0, 1000, filter);
          if (token !== this.requestToken) return;
          this.listTruncated = al.length >= 1000;
          this.albums = this.markEditions(al.map(function (x) {
            return {
              id: x.id, title: x.title, year: x.year,
              originalYear: x.originalYear, releaseType: x.releaseType,
              artist: x.artist,
              source: x.source || 'Local library',
              art: LmsFmt.coverUrl(x.artworkTrackId, 50) || null
            };
          }));
        }
      } catch (e) {
        if (token !== this.requestToken) return;
        /* Um erro depois de o bloco do album ja estar na tela nao pode apagar o
           que carregou certo: o pedido secundario falhou, o album nao. */
        if (this.blocks.length || this.albums.length) {
          LmsUi.notify(this.tr('Part of this screen could not be loaded. ') +
            this.serviceError(e), 'error', 6500);
        } else {
          this.error = this.serviceError(e);
        }
      }
      if (token !== this.requestToken) return;
      this.loading = false;
    }
  },
  created: function () { this.load(); }
});

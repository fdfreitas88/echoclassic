/* One playlist workspace is shared by the Collection dashboard and the
   physical Music Folders tree. The draft is intentionally browser-side until
   Save or Play in background is chosen; switching views never recreates it. */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'echoclassic.playlist-builder.v2';
  var TEMP_RE = /^temp-playlist-(\d+)$/i;
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (ignored) {}

  function cleanTrack(track, index) {
    if (!track || (!track.url && track.id == null)) return null;
    return {
      draftKey: String(track.draftKey || ('restored-' + index + '-' + Date.now())),
      id: track.id == null ? null : track.id,
      title: String(track.title || track.name || 'Unknown track'),
      artist: String(track.artist || ''), album: String(track.album || ''),
      path: String(track.path || track.url || ''), url: String(track.url || ''),
      duration: Number(track.duration || 0), source: String(track.source || '')
    };
  }

  var restoredTracks = (Array.isArray(saved.tracks) ? saved.tracks : []).slice(0, 10000).map(cleanTrack).filter(Boolean);
  var state = Vue.observable({
    open: saved.open === true, mobileView: 'browse', name: String(saved.name || ''),
    tracks: restoredTracks, selected: saved.selected && typeof saved.selected === 'object' ? saved.selected : {},
    sequence: Number(saved.sequence || restoredTracks.length), saving: false, notice: '', clearPending: false,
    dragIndex: null, draggedTrack: null, dropIndex: null, addingFolder: false,
    scroll: saved.scroll && typeof saved.scroll === 'object' ? saved.scroll : { collection:0, folders:0 },
    tempPlaying: saved.tempPlaying || null, prompt: null, pendingSet: null, pendingNew: null
  });

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        open:state.open, name:state.name, tracks:state.tracks, selected:state.selected,
        sequence:state.sequence, scroll:state.scroll, tempPlaying:state.tempPlaying
      }));
    } catch (ignored) {}
  }
  function tr(text) { return global.LmsStr && LmsStr.t ? LmsStr.t(text) : text; }
  function pid() { return global.LmsStore && LmsStore.state ? (LmsStore.state.playerId || '') : ''; }
  function keyFor(track) { return String(track && (track.url || track.path || track.id || track.draftKey) || ''); }
  function normalized(track, source) {
    var value = cleanTrack(track, ++state.sequence);
    if (!value) return null;
    value.draftKey = (source || 'track') + '-' + state.sequence;
    value.source = source || value.source;
    return value;
  }
  function notify(message) { state.notice = tr(message); persist(); }
  function open(context) { state.open = true; if (global.innerWidth <= 820) state.mobileView = 'builder'; persist(); }
  function close() { state.open = false; state.mobileView = 'browse'; clearDrag(); persist(); }
  function setMobileView(value) { state.mobileView = value === 'builder' ? 'builder' : 'browse'; if (value === 'builder') state.open = true; persist(); }

  function appendTracks(tracks, source) {
    var existing = Object.create(null), added = 0;
    state.tracks.forEach(function (track) { var key=keyFor(track); if(key) existing[key]=true; });
    (tracks || []).forEach(function (track) {
      var value = normalized(track, source), key = keyFor(value);
      if (!value || (key && existing[key])) return;
      state.tracks.push(value); if (key) existing[key] = true;
      Vue.set(state.selected, value.draftKey, true); added++;
    });
    if (added) notify(added === 1 ? 'Track added to playlist draft.' : 'Tracks added to playlist draft.');
    open(); return added;
  }

  async function folderTracks(item) {
    var out = [], seen = Object.create(null), limit = 10000;
    async function visit(folderId) {
      var key = String(folderId); if (seen[key] || out.length >= limit) return;
      seen[key] = true;
      var children = await LmsApi.musicFolders(pid(), folderId);
      for (var i = 0; i < children.length && out.length < limit; i++) {
        if (children[i].type === 'folder') await visit(children[i].id);
        else out.push(children[i]);
      }
    }
    await visit(item.id); return out;
  }
  async function addFolderItem(item) {
    if (!item) return;
    if (item.type !== 'folder') return appendTracks([item], 'folder-track');
    state.addingFolder = true; state.notice = tr('Adding folder…'); open();
    try {
      var tracks = await folderTracks(item), added = appendTracks(tracks, 'folder');
      state.notice = added + ' ' + tr(added === 1 ? 'track added from folder.' : 'tracks added from folder.');
    } catch (error) {
      state.notice = tr('Could not add this folder.');
    } finally { state.addingFolder = false; persist(); }
  }

  function remove(index) {
    var track = state.tracks[index]; if (!track) return;
    Vue.delete(state.selected, track.draftKey); state.tracks.splice(index, 1);
    notify('Track removed from playlist draft.');
  }
  function move(index, delta) {
    var target = index + delta; if (target < 0 || target >= state.tracks.length) return;
    var track = state.tracks.splice(index, 1)[0]; state.tracks.splice(target, 0, track);
    notify('Playlist order updated.');
  }
  function clearDraft() {
    state.tracks = []; state.selected = {}; state.name = ''; state.clearPending = false;
    notify('Playlist draft cleared.');
  }
  function toggleSelected(track) {
    if (!track) return;
    if (state.selected[track.draftKey]) Vue.delete(state.selected, track.draftKey);
    else Vue.set(state.selected, track.draftKey, true);
    persist();
  }
  function selectAll(value) {
    state.tracks.forEach(function (track) { if (value) Vue.set(state.selected, track.draftKey, true); else Vue.delete(state.selected, track.draftKey); });
    persist();
  }
  function selectedTracks() { return state.tracks.filter(function (track) { return !!state.selected[track.draftKey]; }); }
  async function showSelectedInFolders() {
    var tracks = selectedTracks(); if (!tracks.length) return;
    var result = await LmsUi.showInMusicFoldersMany(tracks.map(function (track) { return {url:track.url||track.path,label:track.title,trackId:track.id}; }));
    if (!result || !result.opened) notify('Selected files were not found in Music folders.');
    else { state.mobileView = 'browse'; notify('Selected tracks are shown in Folders.'); }
  }

  async function uniquePlaylistName(requested) {
    var lists = await LmsApi.playlists(0, 1000), base = String(requested || tr('New playlist')).trim() || tr('New playlist'), name = base, n = 2;
    var used = Object.create(null); lists.forEach(function (list) { used[String(list.name || '').toLowerCase()] = true; });
    while (used[name.toLowerCase()]) name = base + ' ' + n++;
    return name;
  }
  async function replacePlaylistContents(playlistId, tracks) {
    var existing = await LmsApi.playlistTracks(playlistId, 0, 10000);
    for (var index = existing.length - 1; index >= 0; index--) await LmsApi.editPlaylist(playlistId, 'delete', {index:index});
    for (var i = 0; i < tracks.length; i++) await LmsApi.editPlaylist(playlistId, 'add', {title:tracks[i].title,url:tracks[i].url});
  }
  async function savePersistent(forceUnique) {
    if (!state.tracks.length || state.saving) return false;
    state.saving = true; state.notice = tr('Saving playlist…');
    try {
      var name = String(state.name || '').trim() || tr('New playlist');
      if (forceUnique) name = await uniquePlaylistName(name);
      var created = await LmsApi.createPlaylist(name);
      if (created.id == null) throw new Error('playlist');
      await replacePlaylistContents(created.id, state.tracks.slice());
      state.name = name; state.notice = tr('Playlist saved.') + ' ' + name; persist(); return true;
    } catch (error) {
      state.notice = tr('Could not save playlist.') + ' ' + tr('Check the connection and try again.'); return false;
    } finally { state.saving = false; }
  }

  function tempLists() {
    return LmsApi.playlists(0, 1000).then(function (lists) {
      return lists.map(function (list) { var match=TEMP_RE.exec(String(list.name||'')); return match ? Object.assign({},list,{number:Number(match[1])}) : null; }).filter(Boolean).sort(function(a,b){return a.number-b.number;});
    });
  }
  function requestCapacity(oldest) {
    return new Promise(function (resolve) { state.prompt={kind:'capacity',oldest:oldest};state.promptResolve=resolve;open(); });
  }
  async function ensureTempCapacity(lists) {
    if (lists.length < 100) return true;
    return requestCapacity(lists[0]);
  }
  async function playTracksAsTemporary(tracks, label) {
    tracks = (tracks || []).filter(function (track) { return !!track.url; });
    if (!tracks.length) return false;
    state.saving = true; state.notice = tr('Preparing temporary playlist…');
    try {
      var lists = await tempLists();
      if (!(await ensureTempCapacity(lists))) return false;
      lists = await tempLists();
      var next = lists.reduce(function (max,list) { return Math.max(max,list.number); },0) + 1;
      var name = 'temp-playlist-' + next, created = await LmsApi.createPlaylist(name);
      if (created.id == null) throw new Error('playlist');
      await replacePlaylistContents(created.id, tracks);
      await LmsApi.loadContainer(pid(), 'playlist_id', created.id);
      state.tempPlaying={id:created.id,name:name,label:label||name,count:tracks.length};
      state.notice=tr('Playing in background.')+' '+name;persist();return true;
    } catch (error) { state.notice=tr('Could not start temporary playback.');return false; }
    finally { state.saving=false; }
  }
  function playDraftAsTemporary() { return playTracksAsTemporary(state.tracks.slice(), state.name); }
  async function saveTemporary() {
    if (!state.tempPlaying) return;
    var name = await uniquePlaylistName((state.name || state.tempPlaying.label || tr('Saved playlist')).replace(TEMP_RE, tr('Saved playlist')));
    try { await LmsApi.renamePlaylist(state.tempPlaying.id,name);state.tempPlaying=null;state.notice=tr('Temporary playlist saved.')+' '+name;persist(); }
    catch (error) { state.notice=tr('Could not save playlist.'); }
  }
  async function eraseTemporary() {
    if (!state.tempPlaying) return;
    try { await LmsApi.deletePlaylist(state.tempPlaying.id);state.tempPlaying=null;state.notice=tr('Temporary playlist erased.');persist(); }
    catch (error) { state.notice=tr('Could not erase temporary playlist.'); }
  }

  function replaceDraft(tracks, label) {
    state.tracks=[];state.selected={};state.name=label||'';appendTracks(tracks,'collection');state.prompt=null;state.pendingNew=null;persist();
  }
  function requestStartNew(tracks, label) {
    state.pendingNew={tracks:(tracks||[]).slice(),label:label||''};open();
    if (!state.tracks.length) return replaceDraft(state.pendingNew.tracks,state.pendingNew.label);
    state.prompt={kind:'protect',label:label||'',count:(tracks||[]).length};
  }
  function offerCollectionSet(tracks, label) {
    tracks=(tracks||[]).filter(function(track){return !!track.url;});if(!tracks.length)return;
    open('collection');
    if (!state.tracks.length) { state.name=label||'';appendTracks(tracks,'collection');return; }
    state.pendingSet={tracks:tracks.slice(),label:label||''};state.prompt={kind:'collection',label:label||'',count:tracks.length};
  }
  async function choosePrompt(choice) {
    var prompt=state.prompt;
    if (!prompt) return;
    if (prompt.kind==='capacity') {
      var resolver=state.promptResolve,oldest=prompt.oldest,ok=false;
      try {
        if(choice==='save'){var savedName=await uniquePlaylistName(tr('Saved playlist')+' '+oldest.number);await LmsApi.renamePlaylist(oldest.id,savedName);ok=true;}
        else if(choice==='erase'){await LmsApi.deletePlaylist(oldest.id);ok=true;}
      } catch(error){state.notice=tr('Could not update temporary playlists.');}
      state.prompt=null;state.promptResolve=null;if(resolver)resolver(ok);return;
    }
    if (prompt.kind==='collection') {
      var set=state.pendingSet;state.prompt=null;state.pendingSet=null;
      if(!set)return;
      if(choice==='play')await playTracksAsTemporary(set.tracks,set.label);
      else if(choice==='append')appendTracks(set.tracks,'collection');
      else if(choice==='new')requestStartNew(set.tracks,set.label);
      return;
    }
    if (prompt.kind==='protect') {
      var next=state.pendingNew;
      if(choice==='save' && !(await savePersistent(true)))return;
      if(choice==='play' && !(await playDraftAsTemporary()))return;
      if(choice==='cancel'){state.prompt=null;state.pendingNew=null;return;}
      if(next)replaceDraft(next.tracks,next.label);
    }
  }

  function startExternalDrag(item) { state.draggedTrack=item;state.dragIndex=null;open(); }
  function startDraftDrag(index) { state.dragIndex=index;state.draggedTrack=state.tracks[index]; }
  function dropAt(targetIndex) {
    if (!state.draggedTrack) return clearDrag();
    if (state.draggedTrack.type==='folder') { var folder=state.draggedTrack;clearDrag();return addFolderItem(folder); }
    var track=state.dragIndex==null?normalized(state.draggedTrack,'folder-track'):state.draggedTrack;
    var insertAt=Math.max(0,Math.min(state.tracks.length,Number(targetIndex)));
    if(state.dragIndex!=null){state.tracks.splice(state.dragIndex,1);if(state.dragIndex<insertAt)insertAt--;}
    if(track){state.tracks.splice(insertAt,0,track);Vue.set(state.selected,track.draftKey,true);}
    notify(state.dragIndex==null?'Track added to playlist draft.':'Playlist order updated.');clearDrag();
  }
  function clearDrag(){state.dragIndex=null;state.draggedTrack=null;state.dropIndex=null;}

  global.LmsPlaylistBuilder={state:state,open:open,close:close,setMobileView:setMobileView,persist:persist,
    appendTracks:appendTracks,addFolderItem:addFolderItem,remove:remove,move:move,clearDraft:clearDraft,
    toggleSelected:toggleSelected,selectAll:selectAll,selectedTracks:selectedTracks,showSelectedInFolders:showSelectedInFolders,
    savePersistent:savePersistent,playDraftAsTemporary:playDraftAsTemporary,saveTemporary:saveTemporary,eraseTemporary:eraseTemporary,
    offerCollectionSet:offerCollectionSet,choosePrompt:choosePrompt,startExternalDrag:startExternalDrag,startDraftDrag:startDraftDrag,
    dropAt:dropAt,clearDrag:clearDrag};

  Vue.component('lms-playlist-builder',{
    props:{context:{type:String,default:'folders'}},
    template:`<aside class="playlist-builder shared-playlist-builder" :aria-label="tr('Playlist Builder')">
      <div class="music-folder-mobile-mode" role="tablist" :aria-label="tr('Playlist workspace view')"><button type="button" role="tab" :aria-selected="builder.mobileView==='browse'" @click="browse">{{ tr(context==='collection'?'Collection':'Folders') }}</button><button type="button" role="tab" :aria-selected="builder.mobileView==='builder'" @click="builder.mobileView='builder'">{{ tr('Playlist Builder') }}<span v-if="builder.tracks.length">{{ builder.tracks.length }}</span></button></div>
      <header class="playlist-builder-header"><span><strong>{{ tr('Playlist Builder') }}</strong><small>{{ countLabel }}</small></span><button type="button" class="playlist-builder-close" :aria-label="tr('Close Playlist Builder')" @click="api.close">×</button></header>
      <div v-if="builder.tempPlaying" class="playlist-builder-temp"><span><strong>▶ {{ builder.tempPlaying.name }}</strong><small>{{ builder.tempPlaying.count }} {{ tr(builder.tempPlaying.count===1?'track':'tracks') }} · {{ tr('temporary') }}</small></span><button type="button" @click="api.saveTemporary">{{ tr('Save') }}</button><button type="button" @click="api.eraseTemporary">{{ tr('Erase') }}</button></div>
      <label class="playlist-builder-name"><span>{{ tr('Draft name') }}</span><input v-model="builder.name" type="text" :placeholder="tr('New playlist')" @change="api.persist"></label>
      <div class="playlist-builder-append" :class="{'drop-active':builder.dropIndex===builder.tracks.length}" @dragover.prevent="builder.dropIndex=builder.tracks.length" @dragleave="builder.dropIndex=null" @drop.prevent="api.dropAt(builder.tracks.length)"><span aria-hidden="true">＋</span><strong>{{ tr('Drop tracks or folders here') }}</strong><small>{{ tr('Folders add every playable file they contain.') }}</small></div>
      <div v-if="builder.tracks.length" class="playlist-builder-selection"><strong>{{ selectedCount }} {{ tr('selected') }}</strong><button type="button" @click="api.selectAll(true)">{{ tr('Select all') }}</button><button type="button" :disabled="!selectedCount" @click="api.selectAll(false)">{{ tr('Clear selection') }}</button></div>
      <ol v-if="builder.tracks.length" ref="list" class="playlist-builder-list" :aria-label="tr('Playlist draft')" @scroll="rememberScroll">
        <li v-for="(track,index) in builder.tracks" :key="track.draftKey" class="playlist-builder-row" :class="{'drop-before':builder.dropIndex===index,'dragging':builder.dragIndex===index}
            " draggable="true" @dragstart="dragStart(index,$event)" @dragover.prevent="dragOver(index,$event)" @dragleave="dragLeave(index,$event)" @drop.prevent="api.dropAt(builder.dropIndex)" @dragend="api.clearDrag">
          <button type="button" class="playlist-builder-check" :class="{on:builder.selected[track.draftKey]}" :aria-pressed="builder.selected[track.draftKey]?'true':'false'" :aria-label="tr('Select')+' '+track.title" @click="api.toggleSelected(track)">{{ builder.selected[track.draftKey]?'✓':'' }}</button><span class="playlist-builder-grip" aria-hidden="true">⠿</span><span class="playlist-builder-index">{{ index+1 }}</span>
          <span class="playlist-builder-copy"><strong>{{ track.title }}</strong><small>{{ track.artist||track.album||track.path||tr('Music Folder') }}</small></span><span class="playlist-builder-moves"><button type="button" :disabled="index===0" :aria-label="tr('Move up')+': '+track.title" @click="api.move(index,-1)">↑</button><button type="button" :disabled="index===builder.tracks.length-1" :aria-label="tr('Move down')+': '+track.title" @click="api.move(index,1)">↓</button><button type="button" :aria-label="tr('Remove track')+': '+track.title" @click="api.remove(index)">×</button></span>
        </li><li class="playlist-builder-end-target" :class="{'drop-before':builder.dropIndex===builder.tracks.length}" @dragover.prevent="builder.dropIndex=builder.tracks.length" @drop.prevent="api.dropAt(builder.tracks.length)"></li>
      </ol>
      <div v-else class="playlist-builder-empty"><span aria-hidden="true">♫</span><strong>{{ tr('Your playlist is empty') }}</strong><small>{{ tr('Build it from Collection or drag tracks and folders here.') }}</small></div>
      <div class="playlist-builder-status" role="status" aria-live="polite">{{ builder.notice }}</div>
      <footer class="playlist-builder-footer shared-builder-footer"><div class="playlist-builder-footer-selection"><button type="button" :disabled="!selectedCount" @click="api.showSelectedInFolders">▤ {{ tr('Show selected in Folders') }}</button></div><div class="playlist-builder-footer-actions"><button v-if="!builder.clearPending" type="button" :disabled="!builder.tracks.length" @click="builder.clearPending=true">{{ tr('Clear') }}</button><span v-else class="playlist-builder-clear-confirm"><span>{{ tr('Clear this draft?') }}</span><button type="button" @click="api.clearDraft">{{ tr('Clear') }}</button><button type="button" @click="builder.clearPending=false">{{ tr('Cancel') }}</button></span><button type="button" :disabled="!builder.tracks.length||builder.saving" @click="api.playDraftAsTemporary">{{ tr('Play in background') }}</button><button type="button" class="primary" :disabled="!builder.tracks.length||builder.saving" @click="api.savePersistent(false)">{{ builder.saving?tr('Saving…'):tr('Save playlist') }}</button></div></footer>
      <div v-if="builder.prompt" class="playlist-builder-dialog-backdrop" @click.self="choose('cancel')"><section ref="dialog" class="playlist-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="playlist-builder-dialog-title" tabindex="-1" @keydown.esc.stop.prevent="choose('cancel')"><template v-if="builder.prompt.kind==='collection'"><h3 id="playlist-builder-dialog-title">{{ tr('Add') }} {{ builder.prompt.label }}</h3><p>{{ tr('A playlist is already being built. What should happen to this selection?') }}</p><button type="button" @click="choose('play')">{{ tr('Play in background') }}</button><button type="button" @click="choose('append')">{{ tr('Add to this playlist') }}</button><button type="button" @click="choose('new')">{{ tr('Start a new playlist') }}</button></template><template v-else-if="builder.prompt.kind==='protect'"><h3 id="playlist-builder-dialog-title">{{ tr('Keep this draft before starting a new one') }}</h3><p>{{ tr('Save it permanently or keep it playing as a numbered temporary playlist.') }}</p><button type="button" @click="choose('save')">{{ tr('Save playlist') }}</button><button type="button" @click="choose('play')">{{ tr('Play in background') }}</button></template><template v-else><h3 id="playlist-builder-dialog-title">{{ tr('100 temporary playlists reached') }}</h3><p>{{ tr('The oldest temporary playlist must be saved or erased before another can be created.') }}</p><button type="button" @click="choose('save')">{{ tr('Save oldest playlist') }}</button><button type="button" class="destructive" @click="choose('erase')">{{ tr('Erase oldest playlist') }}</button></template><button type="button" class="playlist-builder-dialog-cancel" @click="choose('cancel')">{{ tr('Cancel') }}</button></section></div>
    </aside>`,
    data:function(){return{builder:state,api:global.LmsPlaylistBuilder};},
    computed:{countLabel:function(){var count=state.tracks.length,duration=state.tracks.reduce(function(total,track){return total+Number(track.duration||0);},0);return count+' '+this.tr(count===1?'track':'tracks')+(duration?' · '+LmsFmt.duration(duration):'');},selectedCount:function(){return selectedTracks().length;}},
    methods:{tr:tr,browse:function(){setMobileView('browse');},choose:function(choice){choosePrompt(choice);},dragStart:function(index,event){startDraftDrag(index);if(event&&event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(index));}},dragOver:function(index,event){var rect=event.currentTarget.getBoundingClientRect();state.dropIndex=event.clientY<rect.top+rect.height/2?index:index+1;},dragLeave:function(index,event){if(event.currentTarget.contains(event.relatedTarget))return;if(state.dropIndex===index||state.dropIndex===index+1)state.dropIndex=null;},rememberScroll:function(event){Vue.set(state.scroll,this.context,event.target.scrollTop);persist();}},
    watch:{'builder.prompt':function(value){if(!value)return;var self=this;this.$nextTick(function(){if(self.$refs.dialog)self.$refs.dialog.focus();});}},
    mounted:function(){var self=this;this.$nextTick(function(){if(self.$refs.list)self.$refs.list.scrollTop=Number(state.scroll[self.context]||0);});}
  });
})(window);

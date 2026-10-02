const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
function boot(saved, collectionSaved) {
  const definitions = {}; let stored; const cacheKey='echoclassic.collection-cache.v1'; let collectionStored=collectionSaved;
  const ctx = h.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/library-review.js', {
    Vue: { observable: x => x, set: (o,k,v) => o[k]=v, delete: (o,k) => delete o[k], component: (n,d) => definitions[n]=d },
    localStorage: {getItem: key => key===cacheKey ? collectionStored || null : saved || null,setItem: (key,value) => { if(key===cacheKey) collectionStored=value; else stored=value; }},
    requestAnimationFrame: fn => fn(), LmsStore: { state: { playerId:'p1',np:{},equalizer:{settings:null,status:'idle'} } }, LmsApi: {}, LmsUi: {state:{}}
  });
  function instance(name) { const d=definitions[name];const self=Object.assign(d.data(),{$nextTick:async()=>{}});Object.entries(d.methods||{}).forEach(([k,v])=>self[k]=v.bind(self));Object.entries(d.computed||{}).forEach(([k,v])=>Object.defineProperty(self,k,{get:v.bind(self)}));return self; }
  return { ctx, definitions, instance, stored:()=>stored, collectionStored:()=>collectionStored, prefs:ctx.LmsLibraryDisplay };
}
test('album display inheritance and reset survive reload without changing other scopes',()=>{
 const b=boot(),c={id:7,artist:'Artist',genre:'Jazz'};b.prefs.set('global','year',false);b.prefs.set('genre:Jazz','year',true);b.prefs.set('artist:Artist','year',false);b.prefs.set('album:7','year',true);
 assert.equal(b.prefs.resolve(c).year,true);assert.equal(b.prefs.resolve({...c,id:8}).year,false);b.prefs.reset('album:7');assert.equal(b.prefs.resolve(c).year,false);
 const restored=boot(b.stored());assert.equal(restored.prefs.resolve({genre:'Jazz'}).year,true);assert.equal(restored.prefs.resolve({}).year,false);
});
test('album display editor returns to the originating album without leaving a settings route',()=>{
 let replaced=null,defs={},stacks={music:[{label:'For Your Pleasure (2ch)'}],settings:[{label:'Settings',screen:'settings'}]};
 const ui={state:{tab:'music',appearanceScreen:null},setTab(tab){this.state.tab=tab;},restoreTab(tab){this.state.tab=tab;}};
 const nav={stacks,depth(tab){return stacks[tab].length;},push(tab,frame){stacks[tab].push(frame);},pop(tab){return stacks[tab].pop();}};
 const ctx=h.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/library-review.js',{Vue:{observable:x=>x,set:(o,k,v)=>o[k]=v,delete:(o,k)=>delete o[k],component:(name,def)=>defs[name]=def},localStorage:{getItem:()=>null,setItem:()=>{}},LmsUi:ui,LmsNav:nav,history:{replaceState:state=>{replaced=state;}}});
 ctx.LmsLibraryDisplay.open({id:7,title:'For Your Pleasure (2ch)'},{tab:'music',settingsDepth:1});
 assert.equal(ui.state.tab,'settings');assert.equal(nav.depth('settings'),2);assert.equal(ctx.LmsLibraryDisplay.state.returnTo.tab,'music');
 assert.equal(ctx.LmsLibraryDisplay.closeToOrigin(),true);assert.equal(ui.state.tab,'music');assert.equal(nav.depth('settings'),1);assert.equal(ctx.LmsLibraryDisplay.state.returnTo,null);assert.equal(ctx.LmsLibraryDisplay.state.context,null);assert.equal(replaced.tab,'music');
 assert.match(defs['lms-album-display-settings'].template,/prefs\.returnTo/);assert.match(defs['lms-album-display-settings'].template,/returnToOrigin/);
});
test('album and artist information sides persist and reject invalid values',()=>{
 const b=boot();assert.equal(b.prefs.state.albumSide,'left');b.prefs.setAlbumSide('right');assert.equal(b.prefs.state.albumSide,'right');b.prefs.setAlbumSide('middle');assert.equal(b.prefs.state.albumSide,'right');const restored=boot(b.stored());assert.equal(restored.prefs.state.albumSide,'right');
});
test('album field order inherits by scope, persists, and sanitizes unknown or duplicate fields',()=>{
 const b=boot(),c={id:7,artist:'Artist',genre:'Jazz'};b.prefs.setOrder('global',['year','artist','year','invalid']);b.prefs.setOrder('artist:Artist',['format','counts']);
 assert.deepEqual(Array.from(b.prefs.resolveOrder({genre:'Jazz'})).slice(0,2),['year','artist']);assert.deepEqual(Array.from(b.prefs.resolveOrder(c)).slice(0,2),['format','counts']);
 const restored=boot(b.stored());assert.deepEqual(Array.from(restored.prefs.resolveOrder(c)).slice(0,2),['format','counts']);assert.equal(new Set(restored.prefs.resolveOrder(c)).size,10);
 restored.prefs.reset('artist:Artist');assert.deepEqual(Array.from(restored.prefs.resolveOrder(c)).slice(0,2),['year','artist']);
});
test('album fields can independently move left, right, or hidden and inherit by scope',()=>{
 const b=boot(),c={id:7,artist:'Artist',genre:'Jazz'};b.prefs.setPosition('global','albumInformation','right');b.prefs.setPosition('artist:Artist','artistInformation','left');b.prefs.setPosition('album:7','albumCover','hidden');
 assert.equal(b.prefs.resolvePositions(c).albumInformation,'right');assert.equal(b.prefs.resolvePositions(c).artistInformation,'left');assert.equal(b.prefs.resolvePositions(c).albumCover,'hidden');assert.equal(b.prefs.resolve(c).albumCover,false);
 const restored=boot(b.stored());assert.equal(restored.prefs.resolvePositions(c).artistInformation,'left');restored.prefs.reset('album:7');assert.equal(restored.prefs.resolvePositions(c).albumCover,'left');
});
test('panel ordering and visibility sanitize persisted input and remain independent',()=>{
 const b=boot(JSON.stringify({panel:['eq','eq','invalid'],hidden:['signal','invalid']}));assert.deepEqual(Array.from(b.prefs.state.panel),['eq','album','signal']);b.prefs.move(1,-1);b.prefs.show('eq',false);const restored=boot(b.stored());assert.deepEqual(Array.from(restored.prefs.state.panel),['album','eq','signal']);assert.ok(restored.prefs.state.hidden.includes('eq'));
});
test('collection retries a transient page failure without committing partial data',async()=>{
 const b=boot(),s=b.instance('lms-collection');let failures=0;const calls=[];b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});b.ctx.LmsApi.collectionTracks=async(start)=>{calls.push(start);if(start===500&&failures++===0)throw Error('offline');return {total:501,rows:Array.from({length:start?1:500},(_,i)=>({id:start+i,albumId:3,album:'Album',format:'FLAC',genre:'Jazz',remote:false,fileSize:100}))};};
 const snapshot=await b.ctx.LmsCollectionCache.rebuild();s.applySnapshot(snapshot);assert.equal(s.rows.length,501);assert.equal(new Set(s.rows.map(r=>r.id)).size,501);assert.equal(s.albumCount,1);assert.equal(s.complete,true);assert.deepEqual(calls,[0,500,500]);
});
test('collection reuses the session snapshot when the tab is mounted again and only rescans on request',async()=>{
 const b=boot(),first=b.instance('lms-collection'),second=b.instance('lms-collection');let calls=0;b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});b.ctx.LmsApi.collectionTracks=async()=>{calls++;return {total:1,rows:[{id:1,albumId:1,album:'Album'}]};};first.lastscan='scan-1';
 await first.scan();assert.equal(calls,1);await second.activate();assert.equal(second.rows.length,1);assert.equal(calls,1);
 await second.refresh();assert.equal(calls,2);
});
test('Collection displays the saved scan before a slow server answers, including after reopening', async () => {
 const saved = JSON.stringify({lastscan:'scan-1',rows:[{id:1,albumId:1,album:'Cached'}],offset:1,total:1,complete:true});
 const b=boot(null,saved); let answer;
 b.ctx.LmsApi.serverInfo=()=>new Promise(resolve=>{answer=resolve;});
 b.ctx.LmsApi.collectionTracks=()=>assert.fail('Opening Collection must not scan tracks');
 const first=b.instance('lms-collection'), pending=first.activate();
 while(!answer) await Promise.resolve();
 assert.equal(first.hasSnapshot,true,'Persisted results must render while the server request is pending');
 answer({lastscan:'scan-1'}); await pending;
 const second=b.instance('lms-collection'), reopened=second.activate();
 assert.equal(second.hasSnapshot,true,'Session results must be restored synchronously');
 while(!answer) await Promise.resolve();
 answer({lastscan:'scan-1'}); await reopened;
});
test('leaving Collection keeps the original snapshot without rewriting the full cache', async () => {
 const b=boot(),s=b.instance('lms-collection');
 b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});
 b.ctx.LmsApi.collectionTracks=async()=>({total:1,rows:[{id:1,albumId:1}]});
 await s.scan(); const snapshot=b.prefs.state.collection;
 b.prefs.cacheCollection=()=>assert.fail('Navigation must not write the library again');
 s.stop(); assert.equal(b.prefs.state.collection,snapshot);
});
test('Collection detects newly indexed folders even when the scan timestamp is unchanged', async () => {
 const b=boot(); let songs=1,albums=1;
 b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1',songs,albums});
 b.ctx.LmsApi.collectionTracks=async()=>({total:1,rows:[{id:1,albumId:1}]});
 const snapshot=await b.ctx.LmsCollectionCache.rebuild();
 songs=2; albums=2; await b.ctx.LmsCollectionCache.inspect();
 assert.equal(b.ctx.LmsCollectionCache.state.freshness,'stale');
 assert.equal(b.prefs.state.collection,snapshot,'Keep the saved scan available until its replacement completes');
});
test('completed scans persist summary and album metadata and restore them without observing every track', async () => {
 const b=boot(),s=b.instance('lms-collection');
 const rows=[{id:1,albumId:1,album:'One',genre:'Jazz',format:'FLAC',year:1972,fileSize:0,duration:10},
   {id:2,albumId:2,album:'Two',genre:'Rock',format:'MP3',remote:true,duration:20},
   {id:3,genre:'No album',format:'FLAC',fileSize:100,duration:30}];
 s.rows=rows;
 const expected={groups:s.groups,genreAlbums:s.genreGroups,duration:s.totalDuration,storage:s.storageLabel,albums:s.albumMap};
 b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1',albums:2,songs:3});
 b.ctx.LmsApi.collectionTracks=async()=>({total:3,rows});
 await s.scan();
 const persisted=JSON.parse(b.collectionStored());
 assert.deepEqual(persisted.summary.groups,JSON.parse(JSON.stringify(expected.groups)));
 assert.deepEqual(persisted.summary.genreAlbums,JSON.parse(JSON.stringify(expected.genreAlbums)));
 assert.deepEqual(persisted.albumMap,JSON.parse(JSON.stringify(expected.albums)));
 const restored=boot(null,b.collectionStored()),vm=restored.instance('lms-collection');
 restored.ctx.LmsApi.serverInfo=async()=>{throw Error('offline');};
 await vm.activate();
 assert.equal(vm.totalDuration,expected.duration); assert.equal(vm.storageLabel,expected.storage);
 assert.equal(vm.groups,restored.prefs.state.collection.summary.groups);
 assert.equal(vm.albumMap,restored.prefs.state.collection.albumMap);
 assert.equal(Object.isFrozen(vm.rows),true); assert.equal(Object.isFrozen(vm.summary),true);
});
test('Collection stays cached indefinitely and can finish a scan after leaving the tab', async () => {
 const b=boot(),s=b.instance('lms-collection'); let finish;
 b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});
 b.ctx.LmsApi.collectionTracks=()=>new Promise(resolve=>{finish=resolve;});
 const pending=s.scan(); while(!finish) await Promise.resolve();
 b.definitions['lms-collection'].beforeDestroy.call(s);
 assert.equal(b.ctx.LmsCollectionCache.state.busy,true);
 finish({total:1,rows:[{id:1,albumId:1}]}); await pending;
 const saved=JSON.parse(b.collectionStored()); saved.cachedAt=1;
 const restored=boot(null,JSON.stringify(saved)),vm=restored.instance('lms-collection');
 restored.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});
 restored.ctx.LmsApi.collectionTracks=()=>assert.fail('An old snapshot must not expire on a timer');
 await vm.activate(); assert.equal(vm.hasSnapshot,true); assert.equal(vm.cacheFreshness,'current');
});
test('manual rescan with the same LMS revision replaces cached genre preparation', async () => {
 const b=boot(); b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});
 b.ctx.LmsApi.collectionTracks=async()=>({total:1,rows:[{id:1,albumId:1,genre:'Jazz'}]});
 await b.ctx.LmsCollectionCache.rebuild();
 b.ctx.LmsCollectionCache.cachePrepared('scan-1','genre','Jazz',{albums:[{id:999}]});
 await b.ctx.LmsCollectionCache.rebuild();
 assert.equal(b.ctx.LmsCollectionCache.prepared('scan-1','genre','Jazz'),null);
});
test('a scan refuses a changing library and preserves the prior completed snapshot', async () => {
 const b=boot(); b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1',songs:1,albums:1});
 b.ctx.LmsApi.collectionTracks=async()=>({total:1,rows:[{id:1,albumId:1}]});
 const previous=await b.ctx.LmsCollectionCache.rebuild(); let calls=0;
 b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1',songs:++calls,albums:1});
 await assert.rejects(b.ctx.LmsCollectionCache.rebuild(),/Library changed/);
 assert.equal(b.prefs.state.collection,previous);
 b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1',scanning:true});
 await assert.rejects(b.ctx.LmsCollectionCache.rebuild(),/Library changed/);
 assert.equal(b.prefs.state.collection,previous);
});
test('collection reuses a persisted snapshot and marks it stale without rebuilding after lastscan changes',async()=>{
 const snapshot=JSON.stringify({lastscan:'scan-1',rows:[{id:1,albumId:1,album:'Cached'}],offset:1,total:1,complete:true,error:'',firstMs:2,completeMs:3});
 const b=boot(null,snapshot),s=b.instance('lms-collection');let reads=0;b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});b.ctx.LmsApi.collectionTracks=async()=>{reads++;return {total:1,rows:[{id:2,albumId:2,album:'New'}]};};
 await s.activate();assert.equal(reads,0);assert.equal(s.rows[0].album,'Cached');
 b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-2'});await s.activate();assert.equal(reads,0);assert.equal(s.rows[0].album,'Cached');assert.equal(s.cacheFreshness,'stale');assert.equal(s.displayedFreshness,'stale');
 await s.refresh();assert.equal(reads,1);assert.equal(s.rows[0].album,'New');assert.equal(JSON.parse(b.collectionStored()).lastscan,'scan-2');
});
test('stale Collection keeps the saved dashboard and exposes the update immediately',async()=>{
 const snapshot=JSON.stringify({lastscan:'scan-1',rows:[{id:1,albumId:1,album:'Cached'}],offset:1,total:1,complete:true,error:''});
 const b=boot(null,snapshot),s=b.instance('lms-collection');b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-2',albums:2});
 await s.activate();assert.equal(s.cacheFreshness,'stale');assert.equal(s.displayedFreshness,'stale');assert.equal(s.unindexedAlbumCount,1);
 await s.activate();assert.equal(s.displayedFreshness,'stale');
});
test('first Collection visit checks the revision but never pages tracks until Scan folders is explicit',async()=>{
 const b=boot(),s=b.instance('lms-collection');let reads=0;b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});b.ctx.LmsApi.collectionTracks=async()=>{reads++;return {total:0,rows:[]};};
 await s.activate();assert.equal(reads,0);assert.equal(s.hasSnapshot,false);assert.equal(s.cacheFreshness,'empty');
 await s.refresh();assert.equal(reads,1);assert.equal(s.hasSnapshot,true);
});
test('collection always exposes an explicit manual cache scan button',()=>{
 const b=boot(),template=b.definitions['lms-collection'].template;
 assert.match(template, /Scan folders/);
 assert.match(template, /Update collection/);
 assert.match(template, /collection-dot/);
 assert.match(template, /Scan collection now/);
});
test('collection status keeps the active gauge on its own quiet second line',()=>{
 const b=boot(),template=b.definitions['lms-collection'].template,css=h.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
 assert.match(template,/class="collection-status-main"[\s\S]*class="collection-scan-progress"/);
 assert.match(css,/\.collection-status-main\{display:flex/);
 assert.match(css,/\.collection-scan-progress\{display:flex[\s\S]*margin:8px 0 0 20px/);
 assert.doesNotMatch(css,/\.collection-status\.is-stale\{[^}]*border:/);
});
test('collection scan gauge reports real indexed rows and LMS total',()=>{
 const b=boot(),s=b.instance('lms-collection'),template=b.definitions['lms-collection'].template;
 s.collectionCache.busy=true;s.collectionCache.processed=500;s.collectionCache.total=2000;
 assert.equal(s.scanning,true);assert.equal(s.progressProcessed,500);assert.equal(s.progressTotal,2000);assert.equal(s.progressPercent,25);
 assert.match(template,/role="progressbar"/);assert.match(template,/:aria-valuenow="progressTotal === null \? undefined : progressProcessed"/);
});
test('collection uses large sequential pages after the fast first page',async()=>{
 const b=boot(),calls=[];let active=0,maxActive=0;b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});b.ctx.LmsApi.collectionTracks=async(start,count)=>{calls.push([start,count]);active++;maxActive=Math.max(maxActive,active);await Promise.resolve();active--;return {total:10500,rows:Array.from({length:Math.min(count,10500-start)},(_,i)=>({id:start+i}))};};
 const snapshot=await b.ctx.LmsCollectionCache.rebuild();assert.equal(maxActive,1);assert.deepEqual(calls,[[0,500],[500,5000],[5500,5000]]);assert.equal(snapshot.rows.length,10500);assert.deepEqual(Array.from(snapshot.rows,r=>r.id),Array.from({length:10500},(_,i)=>i));
});
test('first page exposes partial analytics but cannot open collection actions',async()=>{
 const b=boot(),s=b.instance('lms-collection');let finish;b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});b.ctx.LmsApi.collectionTracks=async start=>start===0?{total:1000,rows:Array.from({length:500},(_,i)=>({id:i,albumId:i,genre:'Jazz',format:'FLAC',duration:1,fileSize:2,remote:false}))}:new Promise(resolve=>finish=()=>resolve({total:1000,rows:Array.from({length:500},(_,i)=>({id:500+i,albumId:500+i,genre:'Rock',format:'MP3',duration:1,fileSize:2,remote:false}))}));
 const scan=b.ctx.LmsCollectionCache.rebuild();while(!finish)await Promise.resolve();assert.equal(s.hasDisplay,true);assert.equal(s.hasSnapshot,false);assert.equal(s.displayTrackCount,500);assert.equal(s.albumCount,500);assert.equal(s.groups.genre[0].key,'Jazz');s.openDrill('all','','Albums');assert.equal(s.selected,null);finish();await scan;
});
test('incremental analytics match the complete dashboard definitions',async()=>{
 const b=boot(),s=b.instance('lms-collection'),rows=[{id:1,albumId:10,genre:'Rock',format:'FLAC',year:1972,duration:3,fileSize:100,remote:false},{id:2,albumId:10,genre:'Rock',format:'FLAC',year:1972,duration:2,fileSize:null,remote:false},{id:3,albumId:11,genre:'No Genre',format:'MP3',duration:1,fileSize:10,remote:false},{id:4,albumId:12,genre:'Jazz',format:'DSD',year:1985,duration:4,fileSize:500,remote:false}];let infoCalls=0,finishRevision;b.ctx.LmsApi.serverInfo=async()=>++infoCalls===1?{lastscan:'scan-1'}:new Promise(resolve=>finishRevision=()=>resolve({lastscan:'scan-1'}));b.ctx.LmsApi.collectionTracks=async()=>({total:rows.length,rows});
 const scan=b.ctx.LmsCollectionCache.rebuild();while(!finishRevision)await Promise.resolve();assert.equal(s.displayTrackCount,4);assert.equal(s.albumCount,3);assert.equal(s.unknownSizes,1);assert.equal(s.albumsToTag,1);assert.equal(s.losslessPercent,75);assert.equal(s.totalDuration,10);assert.deepEqual(Array.from(s.groups.decade,g=>g.key).sort(),['1970s','1980s','?'].sort());finishRevision();await scan;
});
test('collection excludes streams from storage and never converts missing file sizes to zero',()=>{
 const s=boot().instance('lms-collection');s.rows=[{id:1,albumId:1,format:'FLAC',fileSize:100,remote:false},{id:2,albumId:1,format:'FLAC',fileSize:null,remote:false},{id:3,albumId:2,format:'MP3',fileSize:900,remote:true}];assert.equal(s.unknownSizes,1);assert.equal(s.groups.storage[0].value,100);assert.equal(s.groups.size[0].key,'?');assert.equal(s.groups.size[0].value,1);
});
test('collection measure selector counts albums, tracks, and known local storage separately',()=>{
 const s=boot().instance('lms-collection');s.rows=[{id:1,albumId:1,genre:'Jazz',format:'FLAC',fileSize:100,remote:false},{id:2,albumId:1,genre:'Jazz',format:'FLAC',fileSize:200,remote:false},{id:3,albumId:2,genre:'Jazz',format:'MP3',fileSize:500,remote:true}];
 assert.equal(s.genreGroups[0].value,2);s.measure='tracks';assert.equal(s.genreGroups[0].value,3);s.measure='storage';assert.equal(s.genreGroups[0].value,300);assert.equal(s.percent(2,[{value:2},{value:2}]),50);
});
test('collection music folders segment is a shortcut to the existing browser',()=>{
 const b=boot(),s=b.instance('lms-collection'),calls=[];b.ctx.LmsNav={reset:key=>calls.push(['reset',key])};b.ctx.LmsUi.setTab=key=>calls.push(['tab',key]);b.ctx.LmsUi.setMusicView=key=>calls.push(['view',key]);s.openMusicFolders();
 assert.deepEqual(calls,[['tab','music'],['view','musicfolders'],['reset','music']]);
});
test('collection drilldown targets the selected album for playback and assigns stable chart colours',async()=>{
 const b=boot(),s=b.instance('lms-collection');const calls=[];b.ctx.LmsApi.loadContainer=async(...a)=>{calls.push(['loadContainer',...a]);return {};};b.ctx.LmsApi.queueControl=async(...a)=>{calls.push(['queueControl',...a]);return {};};
 s.rows=[{id:1,albumId:7,album:'One',artist:'Artist',genre:'Rock'},{id:2,albumId:7,album:'One',artist:'Artist',genre:'Rock'},{id:3,albumId:8,album:'Two',artist:'Artist',genre:'Rock'}];s.drill('genre','Rock');s.selectAlbum(7,true);await s.playTargets();
 assert.deepEqual(calls,[['loadContainer','p1','album_id',7]]);assert.equal(s.selectedAlbumCount,1);assert.equal(s.chartColor(0),'#c83d31');assert.notEqual(s.chartColor(0),s.chartColor(1));
});
test('stopped collection discards all in-flight results',async()=>{
 const b=boot();let resolve;b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});b.ctx.LmsApi.collectionTracks=()=>new Promise(r=>resolve=r);const pending=b.ctx.LmsCollectionCache.rebuild();while(!resolve)await Promise.resolve();b.ctx.LmsCollectionCache.cancel();resolve({rows:[{id:1}],total:1});await assert.rejects(pending,/cancelled/i);assert.equal(b.prefs.state.collection,null);assert.equal(b.ctx.LmsCollectionCache.state.busy,false);assert.equal(b.ctx.LmsCollectionCache.state.partialStats,null);
});
test('collection refuses to combine pages after census changes',async()=>{
 const b=boot();b.ctx.LmsApi.serverInfo=async()=>({lastscan:'scan-1'});b.ctx.LmsApi.collectionTracks=async(start)=>start?{rows:[{id:500}],total:502}:{rows:Array.from({length:500},(_,id)=>({id})),total:501};await assert.rejects(b.ctx.LmsCollectionCache.rebuild(),/changed/);assert.equal(b.prefs.state.collection,null);
});
test('late player metadata does not overwrite new track',async()=>{
 const b=boot(),s=b.instance('lms-player-library-panel');let resolve;b.ctx.LmsApi.songInfo=()=>new Promise(r=>resolve=r);s.store.np.id=1;const pending=s.load();s.store.np.id=null;await s.load();resolve({title:'Old track'});await pending;assert.equal(s.song,null);
});
test('small EQ saves only the mocked edited filter and never sends playback commands',async()=>{
 const b=boot(),s=b.instance('lms-player-library-panel');const original={Client:{Filters:[{FilterType:'Peak',Frequency:1000,Gain:0}]}};let saved;
 s.store.playerId='fixture';s.store.equalizer={status:'ready',settings:original};b.ctx.LmsStore.saveEqualizer=async value=>{saved=value;};await s.gain(0,{target:{value:'4.5'}});
 assert.equal(saved.Client.Filters[0].Gain,4.5);assert.equal(original.Client.Filters[0].Gain,0);assert.equal(s.saving,false);
});
test('incomplete disc cannot issue playback commands',()=>{
 let def,calls=0;h.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/albumblock.js',{Vue:{component:(n,d)=>def=d},LmsStore:{playTrackList:()=>calls++,playContainer:()=>calls++},LmsUi:{state:{}}});const s={incompleteDisc:true,disc:1};def.methods.play.call(s,{});def.methods.playAlbum.call(s);def.methods.shuffle.call(s);assert.equal(calls,0);
});
test('dashboard layout has defaults, persists and survives reload', () => {
  const b = boot();
  assert.deepEqual(Array.from(b.prefs.state.dashboard.order), ['graphics', 'genre', 'albums', 'decade', 'size', 'tracks', 'format']);
  assert.deepEqual(Array.from(b.prefs.state.dashboard.size.genre), [6, 4]);
  b.prefs.setDashboard({ order: ['graphics', 'decade', 'albums', 'genre', 'size', 'tracks', 'format'], hidden: ['size'], size: { genre: [12, 8] } });
  const r = boot(b.stored());
  assert.deepEqual(Array.from(r.prefs.state.dashboard.order), ['graphics', 'decade', 'albums', 'genre', 'size', 'tracks', 'format']);
  assert.deepEqual(Array.from(r.prefs.state.dashboard.hidden), ['size']);
  assert.deepEqual(Array.from(r.prefs.state.dashboard.size.genre), [12, 8]);
  assert.deepEqual(Array.from(r.prefs.state.dashboard.size.format), [6, 4]);
});

test('dashboard layout sanitises unknown ids, duplicates and out-of-range spans', () => {
  const b = boot(JSON.stringify({ dashboardVersion: 4, dashboard: { order: ['size', 'bogus', 'size'], hidden: ['bogus', 'decade'], size: { genre: [99, 1], format: 'x', tracks: [3.6, 5.4] } } }));
  assert.deepEqual(Array.from(b.prefs.state.dashboard.order), ['size', 'graphics', 'genre', 'albums', 'decade', 'tracks', 'format']);
  assert.deepEqual(Array.from(b.prefs.state.dashboard.hidden), ['decade']);
  assert.deepEqual(Array.from(b.prefs.state.dashboard.size.genre), [12, 3]);
  assert.deepEqual(Array.from(b.prefs.state.dashboard.size.format), [6, 4]);
  assert.deepEqual(Array.from(b.prefs.state.dashboard.size.tracks), [4, 5]);
  b.prefs.resetDashboard();
  assert.deepEqual(Array.from(b.prefs.state.dashboard.hidden), []);
  assert.deepEqual(Array.from(b.prefs.state.dashboard.size.genre), [6, 4]);
});

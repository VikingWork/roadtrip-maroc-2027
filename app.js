/* Road trip Maroc mai 2027 — appli carte (Leaflet) */
const PLAN = [
  {id:'j1', num:1, date:'mer 5', titre:'Tanger Med → Chefchaouen'},
  {id:'j2', num:2, date:'jeu 6', titre:'Chefchaouen → Fès'},
  {id:'j3', num:3, date:'ven 7', titre:'Fès à pied + Volubilis'},
  {id:'j4', num:4, date:'sam 8', titre:'Fès → Midelt'},
  {id:'j5', num:5, date:'dim 9', titre:'Midelt → Merzouga'},
  {id:'j6', num:6, date:'lun 10', titre:'Merzouga → Todra'},
  {id:'j7', num:7, date:'mar 11', titre:'Todra → Dadès'},
  {id:'j8', num:8, date:'mer 12', titre:'Dadès → Aït Ben Haddou'},
  {id:'j9', num:9, date:'jeu 13', titre:'Aït Ben Haddou → Marrakech'},
  {id:'j10', num:10, date:'ven 14', titre:'Marrakech'},
  {id:'j11', num:11, date:'sam 15', titre:'Marrakech → Asilah → Tanger Med'},
];
const PRETS = ['j1','j2','j3','j4','j5','j6','j7','j8'];  // jours construits et publiés
const AUTONOMIE = 370, TROU_ALERTE = 80; // km
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- Carte ---------- */
const map = L.map('map', {zoomControl:true, attributionControl:true});
const fonds = {
  'Plan': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap'}),
  'Relief': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {maxZoom:17, attribution:'© OpenTopoMap, © OpenStreetMap'}),
  'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, attribution:'© Esri, Maxar'}),
};
fonds['Relief'].addTo(map);
const calques = {trace:L.layerGroup().addTo(map), st:L.layerGroup().addTo(map), ph:L.layerGroup().addTo(map),
                 vis:L.layerGroup().addTo(map), resto:L.layerGroup().addTo(map), nuit:L.layerGroup().addTo(map)};
L.control.layers(fonds, {'Stations':calques.st, 'Photos de la route':calques.ph, 'Visites':calques.vis,
  'Restos':calques.resto, 'Nuit':calques.nuit}, {collapsed:true}).addTo(map);
map.setView([31.8, -6.5], 6);

const ico = (html, cls='pin', taille=[24,24]) => L.divIcon({html, className:cls, iconSize:taille, iconAnchor:[taille[0]/2, taille[1]/2]});
const badge = (sym, coul, t=34) => L.divIcon({className:'poi', iconSize:[t, t+8], iconAnchor:[t/2, t+8], popupAnchor:[0, -t],
  html:`<div class="poi-b" style="background:${coul};width:${t}px;height:${t}px;font-size:${Math.round(t*.5)}px">${sym}</div><div class="poi-q" style="border-top-color:${coul}"></div>`});
const ICO = {
  st: ico('⛽', 'pin-st', [22,22]),
  ph: ico('', 'pin-ph', [14,14]),
  vis: badge('📷', '#2f6fd0'), resto: badge('🍴', '#e07b00'), nuit: badge('🛏', '#7b2fa8', 38), dep: badge('🏁', '#1d1a17', 30),
};
// Légende toujours visible en bas à gauche
const legende = L.control({position:'bottomleft'});
legende.onAdd = () => { const d = L.DomUtil.create('div', 'legende-carte');
  d.innerHTML = '<span><i style="background:#c4572e"></i>Tracé</span><span><i class="r" style="background:#2f6fd0"></i>Visite</span><span><i class="r" style="background:#e07b00"></i>Resto</span><span><i class="r" style="background:#7b2fa8"></i>Nuit</span><span><i class="r" style="background:#fff;border:2px solid #4f7d4a"></i>Essence</span><span><i class="r p"></i>Photo route</span>';
  return d; };
legende.addTo(map);

/* ---------- État ---------- */
let J = null, ongletActif = 'programme', galerieCourante = [], idxPhoto = 0;
const cache = {};

function barreJours(){
  $('#jours').innerHTML = PLAN.map(p => {
    const pret = PRETS.includes(p.id);
    return `<button data-id="${p.id}" class="${pret?'':'vide'}" title="${esc(p.titre)}">J${p.num} · ${esc(p.date)}</button>`;
  }).join('');
  $('#jours').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (!PRETS.includes(b.dataset.id)) { infoBientot(b.dataset.id); return; }
    location.hash = b.dataset.id;
  };
}
function infoBientot(id){
  const p = PLAN.find(x => x.id === id);
  $('#entete-jour').innerHTML = `<div class="date">Jour ${p.num} · ${esc(p.date)} mai</div><h1>${esc(p.titre)}</h1>`;
  $('#onglets').innerHTML = '';
  $('#contenu').innerHTML = `<div class="vide-jour">Cette journée est en cours de construction, elle arrive très bientôt.</div>`;
}

async function chargerJour(id){
  if (!cache[id]) cache[id] = await (await fetch(`data/${id}.json`)).json();
  J = cache[id];
  document.querySelectorAll('#jours button').forEach(b => b.classList.toggle('actif', b.dataset.id === id));
  document.querySelector(`#jours button[data-id="${id}"]`)?.scrollIntoView({inline:'center', block:'nearest'});
  dessinerCarte(); entete(); onglets(); afficher(ongletActif);
}

function lienGPS(pts, depuisIci=false){
  const f = p => `${p[1]},${p[2]}`;
  const dest = f(pts[pts.length-1]);
  const wps = pts.slice(1, -1).map(f).join('|');
  let u = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${dest}`;
  if (!depuisIci) u += `&origin=${f(pts[0])}`;
  if (wps) u += `&waypoints=${encodeURIComponent(wps)}`;
  return u;
}
/* GPS fidèle au tracé : on découpe la journée en tronçons de ~45 km, chacun avec 3 points de passage
   pris SUR le tracé (Google Maps sur téléphone n'accepte que 3 étapes par lien). */
function hav(a, b){ const r = Math.PI/180, x = Math.sin((b[0]-a[0])*r/2)**2 + Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin((b[1]-a[1])*r/2)**2; return 12742*Math.asin(Math.sqrt(x)); }
function troncons(){
  const t = J.trace, cum = [0];
  for (let i = 1; i < t.length; i++) cum.push(cum[i-1] + hav(t[i-1], t[i]));
  const tot = cum[cum.length-1], n = Math.max(1, Math.round(tot / 45)), L_ = tot / n;
  const pt = km => t[cum.findIndex(c => c >= km)] || t[t.length-1];
  const f = p => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  return Array.from({length:n}, (_, k) => {
    const a = k*L_, b = (k+1)*L_;
    const wps = [1,2,3].map(q => f(pt(a + q*(b-a)/4))).join('|');
    const base = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${f(pt(b))}&waypoints=${encodeURIComponent(wps)}`;
    return {a:Math.round(a), b:Math.round(b), lien: base + `&origin=${f(pt(a))}`, ici: base};
  });
}
const lienPoint = (la, lo) => `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${la},${lo}`;

/* ---------- Dessin de la carte ---------- */
function dessinerCarte(){
  Object.values(calques).forEach(c => c.clearLayers()); calqueActivite.clearLayers();
  const t = J.trace;
  L.polyline(t, {color:'#fff', weight:9, opacity:.9}).addTo(calques.trace);
  const ligne = L.polyline(t, {color:'#c4572e', weight:5, opacity:.95}).addTo(calques.trace);
  ligne.on('click', e => { ouvrirOnglet('route'); photoProche(e.latlng); });
  const p = J.points_route;
  L.marker([p[0][1], p[0][2]], {icon:ICO.dep}).bindPopup(`<b>Départ</b><br>${esc(p[0][0])} · ${J.depart}`).addTo(calques.trace);
  J.stations.forEach(s => L.marker([s.lat, s.lon], {icon:ICO.st}).bindPopup(
    `<b>${esc(s.nom)}</b><br>km ${s.km}${s.h24?' · 24h/24':''}<br><a href="${lienPoint(s.lat,s.lon)}" target="_blank">Y aller</a>`).addTo(calques.st));
  J.photos_route.forEach((ph, i) => L.marker([ph.lat, ph.lon], {icon:ICO.ph}).on('click', () => ouvrirGalerie(J.photos_route, i)).addTo(calques.ph));
  J.visites.forEach((v, i) => L.marker([v.lat, v.lon], {icon:ICO.vis}).on('click', () => { ouvrirOnglet('visiter'); cibler('vis'+i); }).bindTooltip(v.nom).addTo(calques.vis));
  tousRestos().forEach((r, i) => L.marker([r.lat, r.lon], {icon:ICO.resto}).on('click', () => { ouvrirOnglet('manger'); cibler('resto'+i); }).bindTooltip(r.nom).addTo(calques.resto));
  const n = J.nuit;
  L.marker([n.lat, n.lon], {icon:ICO.nuit}).on('click', () => ouvrirOnglet('dormir')).bindTooltip(n.nom).addTo(calques.nuit);
  map.fitBounds(ligne.getBounds(), {padding:[24,24]});
}
function photoProche(ll){
  if (!J.photos_route.length) return;
  let best = 0, d = 1e9;
  J.photos_route.forEach((p, i) => { const x = (p.lat-ll.lat)**2 + (p.lon-ll.lng)**2; if (x < d) { d = x; best = i; } });
  setTimeout(() => cibler('ph'+best), 50);
}
function cibler(id){
  const el = document.getElementById(id); if (!el) return;
  el.scrollIntoView({behavior:'smooth', block:'center'});
  el.animate([{outline:'3px solid #c4572e'}, {outline:'3px solid transparent'}], {duration:1600});
}

/* ---------- En-tête du jour ---------- */
function entete(){
  const alt = J.altitude.map(a => a[1]);
  const amax = alt.length ? Math.max(...alt) : null, amin = alt.length ? Math.min(...alt) : null;
  $('#entete-jour').innerHTML = `
    <div class="date">Jour ${J.num} · ${esc(J.date)}</div>
    <h1>${esc(J.titre)}</h1>
    <div class="chiffres">
      <div class="chiffre"><b>${J.km_osrm} km</b><small>distance</small></div>
      <div class="chiffre"><b>${String(J.h_osrm).replace('.',',')} h</b><small>${J.a_pied ? 'de marche' : 'conduite pure'}</small></div>
      <div class="chiffre"><b>${J.depart} → ${J.arrivee}</b><small>départ / arrivée</small></div>
      ${amax!==null?`<div class="chiffre"><b>${amin}–${amax} m</b><small>altitude</small></div>`:''}
    </div>
    ${J.a_pied ? `<div class="alerte">🚶 Journée à pied, motos au parking. Le tracé rouge relie les visites dans l'ordre du programme.</div>` : ''}
    <div class="segments" ${J.a_pied ? 'style="display:none"' : ''}>${troncons().map((s, i) => `
      <div class="actions" style="margin:0">
        <a class="btn" href="${s.lien}" target="_blank" rel="noopener">🧭 Tronçon ${i+1} · km ${s.a} → ${s.b}</a>
        <a class="btn sec" href="${s.ici}" target="_blank" rel="noopener">📍 Depuis ma position</a></div>`).join('')}
      <div class="actions" style="margin:0"><button class="btn clair" id="btn-gpx">⬇ GPX (tracé exact, pour Calimoto / OsmAnd / GPS moto)</button></div>
      <div class="credit">Chaque tronçon force Google Maps à passer par 3 points pris sur notre tracé (un tous les ~11 km), ce qui l'empêche de partir sur une autre route. Pour suivre le tracé au mètre près : le GPX. Lancer le tronçon suivant à la fin du précédent.</div>
    </div>`;
  $('#btn-gpx').onclick = gpx;
}
function gpx(){
  const pts = J.trace.map(p => `<trkpt lat="${p[0]}" lon="${p[1]}"></trkpt>`).join('');
  const wpts = J.stations.map(s => `<wpt lat="${s.lat}" lon="${s.lon}"><name>${esc(s.nom)} km${s.km}</name><sym>Gas Station</sym></wpt>`).join('')
    + `<wpt lat="${J.nuit.lat}" lon="${J.nuit.lon}"><name>${esc(J.nuit.nom)}</name><sym>Lodging</sym></wpt>`;
  const x = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="roadtrip-maroc" xmlns="http://www.topografix.com/GPX/1/1">${wpts}<trk><name>J${J.num} ${esc(J.titre)}</name><trkseg>${pts}</trkseg></trk></gpx>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([x], {type:'application/gpx+xml'}));
  a.download = `Maroc-J${J.num}.gpx`; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- Onglets ---------- */
const ONGLETS = [['programme','Programme'],['route','Route'],['essence','Essence'],['manger','Manger'],['visiter','Visiter'],['dormir','Dormir'],['pieges','Pièges'],['savoir','Bon à savoir']];
/* Bon à savoir : infos générales (douane, argent, téléphone, code de la route…), communes à tous les jours */
let SAVOIR = null;
fetch('data/bon_a_savoir.json').then(r => r.json()).then(d => { SAVOIR = d; if (ongletActif === 'savoir') afficher('savoir'); }).catch(() => {});
function vSavoir(){
  if (!SAVOIR) return '<div class="carte">Chargement…</div>';
  return (SAVOIR.alertes||[]).map(a => `<div class="alerte ko">${a}</div>`).join('') +
    SAVOIR.sections.map(s => `<div class="carte"><h3>${esc(s.titre)}</h3><ul>${s.points.map(p => `<li style="margin:6px 0">${esc(p)}</li>`).join('')}</ul>
      ${s.tableau ? `<table style="width:100%;font-size:14px;border-collapse:collapse">${s.tableau.map(l => `<tr>${l.map(c => `<td style="padding:4px 6px;border-bottom:1px solid #eee">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : ''}
      ${s.sources ? `<div class="credit">Sources : ${s.sources.map(u => `<a href="${u}" target="_blank" rel="noopener">${esc(new URL(u).hostname.replace('www.',''))}</a>`).join(' · ')}</div>` : ''}</div>`).join('') +
    `<div class="carte"><h3>🆘 Numéros d'urgence</h3><p>Voir le bouton SOS en haut de l'écran.</p></div>`;
}
function onglets(){
  $('#onglets').innerHTML = ONGLETS.map(([k,l]) => `<button data-k="${k}" class="${k===ongletActif?'actif':''}">${l}</button>`).join('');
  $('#onglets').onclick = e => { const b = e.target.closest('button'); if (b) ouvrirOnglet(b.dataset.k); };
}
function ouvrirOnglet(k){
  ongletActif = k;
  document.querySelectorAll('#onglets button').forEach(b => b.classList.toggle('actif', b.dataset.k === k));
  afficher(k);
}
function vProgramme(){
  const ico = {pied:'🚶', moto:'🏍️', info:'•'}, lib = {pied:'À pied', moto:'À moto', info:''};
  return `<div class="carte"><h3>Programme de la journée</h3><div class="meta">Heures marocaines (1 h de moins qu'en France). Départ et arrivée des hébergements en bas de page.</div>
    <div class="prog">${(J.programme||[]).map((p, i) => `<div class="etape ${p.m}">
      <div class="h">${esc(p.h)}</div>
      <div class="c"><b>${ico[p.m]||''} ${esc(p.t)}</b>${p.d ? `<div class="meta">${lib[p.m] ? lib[p.m]+' · ' : ''}${esc(p.d)}</div>` : ''}
        <div>${esc(p.x)}</div>
        <div class="mini-actions">
          ${p.chemin ? `<button class="btn" data-voir="${i}">🗺 Voir sur la carte</button>` : ''}
          ${p.vue ? `<a class="btn sec" href="${p.vue}" target="_blank" rel="noopener">👁 Vue immersive (Mapillary)</a>` : ''}
          ${p.sv ? `<a class="btn clair" href="${p.sv}" target="_blank" rel="noopener">Street View Google</a>` : ''}
          ${p.l ? `<a class="btn clair" href="${p.l}" target="_blank" rel="noopener">${p.m==='pied'?'🚶':'🧭'} ${esc(p.lt||'Y aller')}</a>` : ''}
        </div></div></div>`).join('')}</div>
    <div class="credit">« Vue immersive » : photos au ras du sol prises par des voyageurs, on avance dedans comme dans Street View. « Street View Google » : s'ouvre seulement si Google est passé par là (rare hors des grands axes au Maroc).</div>
    ${J.nuit.arrivee_h ? `<div class="alerte" style="margin-top:10px">🛏 <b>${esc(J.nuit.nom)}</b> : arrivée de ${esc(J.nuit.arrivee_h)}, départ le lendemain de ${esc(J.nuit.depart_h)}.</div>` : ''}</div>`;
}
function afficher(k){ $('#contenu').innerHTML = ({programme:vProgramme, route:vRoute, essence:vEssence, manger:vManger, visiter:vVisiter, dormir:vDormir, pieges:vPieges, savoir:vSavoir})[k](); brancher(); }

function vRoute(){
  const ph = J.photos_route.map((p, i) => `<figure id="ph${i}" data-g="route" data-i="${i}"><img loading="lazy" src="${p.src}" alt="Route km ${p.km}"><figcaption>km ${p.km} · ${p.annee}</figcaption></figure>`).join('');
  const yt = (J.videos_route || []).map(carteYT).join('');
  return `<div class="carte"><p>${esc(J.resume)}</p></div>
    ${blocMeteo()}
    <div class="carte profil"><h3>Profil de la route</h3>${profil()}<div class="credit">Altitude SRTM · km depuis le départ · ⛽ = stations</div></div>
    ${yt ? `<div class="carte"><h3>La route en vidéo</h3>${yt}</div>` : ''}
    <div class="carte"><h3>À quoi ressemble la route</h3>
      <div class="meta">Vraies photos prises sur ce tracé (Mapillary), à peu près tous les 4 km. Touchez la ligne sur la carte pour sauter à la photo la plus proche.</div>
      <div class="photos-route" style="margin-top:10px">${ph || '<i>Aucune photo trouvée sur ce tronçon.</i>'}</div>
      <div class="credit" style="margin-top:6px">Photos © contributeurs Mapillary, licence CC BY-SA 4.0 (auteur dans la visionneuse).</div></div>`;
}
/* Météo : normale de saison (10 ans d'archives) + vraie prévision quand le jour est à moins de 15 jours */
const DATE_ISO = {j1:'2027-05-05', j2:'2027-05-06', j3:'2027-05-07', j4:'2027-05-08', j5:'2027-05-09', j6:'2027-05-10',
  j7:'2027-05-11', j8:'2027-05-12', j9:'2027-05-13', j10:'2027-05-14', j11:'2027-05-15'};
function blocMeteo(){
  const m = J.meteo; if (!m) return '';
  const case_ = x => !x || x.tmax === undefined ? '' : `<div><small class="credit">${esc(x.nom)}</small><br>
    <b>${x.tmin}° / ${x.tmax}°</b><br><span class="credit">extrêmes ${x.tmin_record}° / ${x.tmax_record}° · pluie ${x.risque_pluie} % des jours · vent max moyen ${x.vent} km/h</span></div>`;
  setTimeout(prevision, 0);
  return `<div class="carte"><h3>🌤 Météo</h3><div class="meta">Normale de saison : ${esc(m.periode)}.</div>
    <div class="meteo">${case_(m.arrivee)}${case_(m.sommet)}</div><div id="prevision" class="credit" style="margin-top:6px"></div></div>`;
}
async function prevision(){
  const el = document.getElementById('prevision'); if (!el) return;
  const jour = DATE_ISO[J.id], ecart = (new Date(jour) - new Date()) / 864e5;
  if (ecart > 15) { el.textContent = `Vraie prévision affichée ici automatiquement à partir du ${new Date(new Date(jour) - 15*864e5).toLocaleDateString('fr-FR')}.`; return; }
  if (ecart < -1) return;
  try {
    const a = J.meteo.arrivee;
    const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Africa%2FCasablanca&start_date=${jour}&end_date=${jour}`)).json();
    const d = r.daily;
    el.innerHTML = `<b style="font-size:15px">Prévision pour ce jour-là : ${Math.round(d.temperature_2m_min[0])}° / ${Math.round(d.temperature_2m_max[0])}°, risque de pluie ${d.precipitation_probability_max[0]} %, vent jusqu'à ${Math.round(d.wind_speed_10m_max[0])} km/h</b>`;
  } catch (e) { el.textContent = 'Prévision indisponible (pas de réseau).'; }
}
function profil(){
  const a = J.altitude; if (a.length < 2) return '<i>Profil indisponible</i>';
  const W = 600, H = 140, P = 22, kmax = a[a.length-1][0];
  const zs = a.map(x => x[1]), zmin = Math.min(...zs) - 50, zmax = Math.max(...zs) + 50;
  const X = k => P + (k / kmax) * (W - P - 6), Y = z => H - 18 - (z - zmin) / (zmax - zmin) * (H - 30);
  const d = a.map((x, i) => `${i ? 'L' : 'M'}${X(x[0]).toFixed(1)},${Y(x[1]).toFixed(1)}`).join('');
  const st = J.stations.map(s => `<text x="${X(s.km)}" y="${H-4}" font-size="10" text-anchor="middle">⛽</text>`).join('');
  const graduations = [0, .25, .5, .75, 1].map(f => `<text x="${X(kmax*f)}" y="10" font-size="9" fill="#7a6e62" text-anchor="${f===1?'end':f===0?'start':'middle'}">${Math.round(kmax*f)} km</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Profil altimétrique">
    <path d="${d}L${X(kmax)},${H-18}L${X(0)},${H-18}Z" fill="#e6d6b8"/><path d="${d}" fill="none" stroke="#c4572e" stroke-width="2"/>
    <text x="2" y="${Y(Math.max(...zs))+4}" font-size="10" fill="#2b241e">${Math.max(...zs)} m</text>
    <text x="2" y="${Y(Math.min(...zs))}" font-size="10" fill="#7a6e62">${Math.min(...zs)} m</text>${st}${graduations}</svg>`;
}

function vEssence(){
  if (J.a_pied) return `<div class="carte"><h3>⛽ Journée sans moto</h3><p>Rien à prévoir aujourd'hui. Pour demain, le plein se fait à la sortie de la ville ou sur la première aire d'autoroute.</p></div>`;
  const s = J.stations, total = J.km_osrm;
  let html = '', prec = 0, maxTrou = 0;
  s.forEach(x => {
    const trou = x.km - prec; maxTrou = Math.max(maxTrou, trou);
    if (trou >= 15) html += `<li class="trou ${trou >= TROU_ALERTE ? 'gros' : ''}">↕ ${Math.round(trou)} km sans station</li>`;
    html += `<li><span class="km">km ${x.km}</span><span style="flex:1">${esc(x.nom)} ${x.h24 ? '<span class="badge ok">24h/24</span>' : ''}</span><a class="btn clair" style="padding:6px 10px" href="${lienPoint(x.lat,x.lon)}" target="_blank">Y aller</a></li>`;
    prec = x.km;
  });
  const fin = total - prec; maxTrou = Math.max(maxTrou, fin);
  if (fin >= 15) html += `<li class="trou ${fin >= TROU_ALERTE ? 'gros' : ''}">↕ ${Math.round(fin)} km jusqu'à l'arrivée</li>`;
  const verdict = maxTrou < AUTONOMIE * 0.5
    ? `<div class="alerte" style="border-color:var(--vert);background:#eef6ec">✅ Aucun souci : le plus long trou fait ${Math.round(maxTrou)} km pour ${AUTONOMIE} km d'autonomie. Un plein le matin suffit.</div>`
    : `<div class="alerte ko">⚠ Trou de ${Math.round(maxTrou)} km : partir avec le plein complet.</div>`;
  return `${verdict}<div class="carte"><h3>${s.length} stations sur le tracé</h3>
    <div class="meta">Repérées dans OpenStreetMap à moins de 600 m de la route. Au Maroc la base est incomplète : il y en a souvent plus, rarement moins. Beaucoup refusent la carte bancaire : avoir du liquide.</div>
    <ul class="liste-st" style="margin-top:8px">${html || '<li>Aucune station repérée</li>'}</ul></div>`;
}
/* Restos : photos chargées en direct depuis Google (clé limitée à ce site), note et « ouvert maintenant » rafraîchis à l'affichage */
const moments = () => Array.isArray(J.repas) ? J.repas : [J.repas];
const tousRestos = () => moments().flatMap(m => m.restos);
const photoG = (name, w=800) => `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&key=${window.GKEY||''}`;
function vManger(){
  let n = 0;
  const html = moments().map(m => `<div class="carte"><h3>${esc(m.titre)}</h3><div class="meta">${esc(m.heure||'')}</div><p>${esc(m.commentaire)}</p></div>` +
    m.restos.map(x => { const i = n++; return `
    <div class="carte" id="resto${i}"><h3>🍽️ ${esc(x.nom)}</h3>
      <div class="meta"><span id="live${i}">${x.note_g ? `⭐ ${String(x.note_g).replace('.',',')} · ${x.avis_g} avis Google` : esc(x.note||'')}</span></div>
      <p>${esc(x.pourquoi)}</p>
      ${(x.photos||[]).length && window.GKEY ? `<div class="galerie">${x.photos.map((p, k) => `<img loading="lazy" src="${photoG(p.name, 600)}" data-g="resto${i}" data-i="${k}" alt="" onerror="this.remove()">`).join('')}</div>
        <div class="credit">Photos : ${esc([...new Set(x.photos.flatMap(p => p.auteurs||[]))].slice(0,3).join(', '))} · Google Maps</div>` : ''}
      ${(x.specialites||[]).length ? `<p><b>À commander :</b></p><ul style="margin:0 0 6px 18px;padding:0">${x.specialites.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${x.prix ? `<p>💰 ${esc(x.prix)}</p>` : ''}
      ${(x.menu||[]).length ? `<details><summary>Voir la carte relevée sur photo (prix en dirhams)</summary><ul style="columns:2;font-size:13px;margin:6px 0 0 18px;padding:0">${x.menu.map(s => `<li>${esc(s)}</li>`).join('')}</ul><div class="credit">10 DH ≈ 0,92 €. Prix relevés sur une photo récente du menu, susceptibles d'avoir un peu bougé.</div></details>` : ''}
      ${x.conseil ? `<p class="meta">ℹ️ ${esc(x.conseil)}</p>` : ''}
      <div class="mini-actions"><a class="btn clair" href="${lienPoint(x.lat,x.lon)}" target="_blank">🧭 Y aller</a>
      <a class="btn clair" href="${x.maps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.nom)}`}" target="_blank">Avis et photos Google</a></div></div>`; }).join('')).join('');
  setTimeout(rafraichirRestos, 0);
  return html;
}
async function rafraichirRestos(){
  if (!window.GKEY) return;
  const L_ = tousRestos();
  for (let i = 0; i < L_.length; i++) {
    const x = L_[i], el = document.getElementById('live' + i); if (!x.id || !el) continue;
    try {
      const r = await fetch(`https://places.googleapis.com/v1/places/${x.id}?languageCode=fr`, {headers:{'X-Goog-Api-Key':window.GKEY, 'X-Goog-FieldMask':'rating,userRatingCount,currentOpeningHours.openNow'}});
      if (!r.ok) continue;
      const d = await r.json(), o = d.currentOpeningHours ? d.currentOpeningHours.openNow : null;
      el.innerHTML = `⭐ ${String(d.rating).replace('.',',')} · ${d.userRatingCount} avis Google (en direct)` + (o === null ? '' : o ? ' · <span class="badge ok">ouvert maintenant</span>' : ' · <span class="badge warn">fermé maintenant</span>');
    } catch (e) {}
  }
}
function vVisiter(){
  return J.visites.map((v, i) => `
    <div class="carte" id="vis${i}"><h3>📸 ${esc(v.nom)}</h3>
      ${v.prix ? `<div class="meta"><span class="badge ${/^gratuit/i.test(v.prix) ? 'ok' : 'warn'}">${esc(/^gratuit/i.test(v.prix) ? 'Gratuit' : 'Payant')}</span> ${esc(v.prix)}</div>` : ''}
      ${v.horaires || v.duree ? `<div class="meta">${v.horaires ? '🕑 ' + esc(v.horaires) : ''}${v.horaires && v.duree ? ' · ' : ''}${v.duree ? '⏱ ' + esc(v.duree) : ''}</div>` : ''}
      ${v.verif === 'approx' ? `<div class="meta">📍 position approximative (à quelques centaines de mètres près)</div>` : ''}
      <p>${esc(v.texte)}</p>
      ${v.voyageurs ? `<p class="meta">💬 <b>Ce que disent les voyageurs :</b> ${esc(v.voyageurs)}</p>` : ''}
      <div class="galerie">${(v.photos||[]).map((p, k) => `<img loading="lazy" src="${p.src}" data-g="vis${i}" data-i="${k}" alt="">`).join('')}</div>
      ${(v.videos||[]).map(carteYT).join('')}
      <div class="actions"><a class="btn clair" href="${lienPoint(v.lat,v.lon)}" target="_blank">🧭 Y aller</a></div></div>`).join('');
}
function vDormir(){
  const n = J.nuit;
  return `<div class="carte"><h3>🛏️ ${esc(n.nom)}</h3><div class="meta">${esc(n.lieu)} · note Booking ${esc(n.note)}</div>
    <p><b>${esc(n.prix)}</b><br>Annulation : ${esc(n.annulation)}<br>Statut : <span class="badge warn">${esc(n.statut)}</span></p>
    ${n.arrivee_h ? `<p>🕑 Arrivée : <b>${esc(n.arrivee_h)}</b><br>🕚 Départ : <b>${esc(n.depart_h)}</b></p>` : ''}
    <p>${esc(n.astuce)}</p>
    <div class="actions"><a class="btn" href="${n.booking}" target="_blank">📷 Photos et avis sur Booking</a></div>
    ${(n.photos||[]).length ? `<h3 style="margin-top:10px">Les abords</h3><div class="meta">Photos prises dans la rue autour de l'hébergement (Mapillary) pour repérer l'accès et le stationnement.</div>
      <div class="galerie">${n.photos.map((p, k) => `<img loading="lazy" src="${p.src}" data-g="nuit" data-i="${k}" alt="">`).join('')}</div>` : ''}
    <div class="actions">
    <a class="btn clair" href="${lienPoint(n.lat,n.lon)}" target="_blank">🧭 Y aller</a></div></div>`;
}
function vPieges(){
  return `<div class="carte"><h3>⚠ À savoir pour cette journée</h3><ul>${J.pieges.map(p => `<li style="margin:6px 0">${esc(p)}</li>`).join('')}</ul></div>`;
}
function carteYT(v){
  const m = Math.floor(v.duree/60), s = String(v.duree%60).padStart(2,'0');
  return `<div class="yt" data-yt="${v.id}"><img loading="lazy" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt=""><div class="play">▶</div><div class="dur">${m}:${s}</div></div>
    <div class="credit">${esc(v.titre)} — ${esc(v.chaine)}${v.debut ? ` · démarre à ${Math.floor(v.debut/60)}:${String(v.debut%60).padStart(2,'0')}` : ''}</div>`;
}

/* ---------- Activité du programme surlignée sur la carte ---------- */
const calqueActivite = L.layerGroup().addTo(map);
function voirActivite(i){
  const p = J.programme[i]; if (!p || !p.chemin) return;
  calqueActivite.clearLayers();
  const coul = p.m === 'pied' ? '#2f6fd0' : '#c4572e';
  if (p.chemin.length > 1) {
    L.polyline(p.chemin, {color:'#fff', weight:9, opacity:.9}).addTo(calqueActivite);
    const l = L.polyline(p.chemin, {color:coul, weight:5, dashArray: p.m === 'pied' ? '8 8' : null}).addTo(calqueActivite);
    L.circleMarker(p.chemin[0], {radius:7, color:'#fff', weight:3, fillColor:'#1d1a17', fillOpacity:1}).bindTooltip('Départ').addTo(calqueActivite);
    map.fitBounds(l.getBounds(), {padding:[40,40], maxZoom:17});
  } else map.setView(p.chemin[0], 15);
  L.marker(p.chemin[p.chemin.length-1], {icon: badge(p.m === 'pied' ? '🚶' : '🏍', coul, 36)})
    .bindTooltip(p.t, {permanent:true, direction:'top', offset:[0,-36]}).addTo(calqueActivite);
  document.getElementById('map').scrollIntoView({behavior:'smooth', block:'start'});
}

/* ---------- Interactions : photos, vidéos ---------- */
function brancher(){
  document.querySelectorAll('#contenu [data-voir]').forEach(b => b.onclick = () => voirActivite(+b.dataset.voir));
  document.querySelectorAll('#contenu [data-g]').forEach(el => el.onclick = () => {
    const g = el.dataset.g, i = +el.dataset.i;
    const liste = g === 'route' ? J.photos_route : g === 'nuit' ? J.nuit.photos
      : g.startsWith('resto') ? tousRestos()[+g.slice(5)].photos.map(p => ({src: photoG(p.name, 1600), auteur: (p.auteurs||[]).join(', '), source: 'Google Maps', licence: '', lien: tousRestos()[+g.slice(5)].maps}))
      : J.visites[+g.slice(3)].photos;
    ouvrirGalerie(liste, i);
  });
  document.querySelectorAll('#contenu .yt').forEach(el => el.onclick = () => {
    if (el.querySelector('iframe')) return;
    const v = [...(J.videos_route||[]), ...J.visites.flatMap(x => x.videos||[])].find(x => x.id === el.dataset.yt) || {};
    el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${el.dataset.yt}?autoplay=1&rel=0${v.debut ? '&start='+v.debut : ''}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
  });
}
function ouvrirGalerie(liste, i){ galerieCourante = liste; idxPhoto = i; montrerPhoto(); $('#visionneuse').classList.remove('hidden'); }
function montrerPhoto(){
  const p = galerieCourante[idxPhoto]; if (!p) return;
  $('#visionneuse img').src = p.src;
  $('#visionneuse .legende').innerHTML = `${p.km !== undefined ? `<b>km ${p.km}</b> · ` : ''}${p.annee ? p.annee + ' · ' : ''}© ${esc(p.auteur)} · ${esc(p.source)} ${esc(p.licence)} · <a href="${p.lien}" target="_blank">voir l'original</a>
    ${p.lat ? ` · <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank">situer</a>` : ''}`;
}
$('#visionneuse .fermer').onclick = () => $('#visionneuse').classList.add('hidden');
$('#visionneuse .prec').onclick = () => { idxPhoto = (idxPhoto - 1 + galerieCourante.length) % galerieCourante.length; montrerPhoto(); };
$('#visionneuse .suiv').onclick = () => { idxPhoto = (idxPhoto + 1) % galerieCourante.length; montrerPhoto(); };
document.addEventListener('keydown', e => {
  if ($('#visionneuse').classList.contains('hidden')) return;
  if (e.key === 'Escape') $('#visionneuse .fermer').click();
  if (e.key === 'ArrowLeft') $('#visionneuse .prec').click();
  if (e.key === 'ArrowRight') $('#visionneuse .suiv').click();
});

/* ---------- Urgences ---------- */
$('#btn-urgence').onclick = () => {
  $('#urgences').innerHTML = `<div class="boite"><h2>🆘 Urgences Maroc</h2>
    <div class="num"><span>Police (en ville)</span><b>19</b></div>
    <div class="num"><span>Gendarmerie royale (hors ville, routes)</span><b>177</b></div>
    <div class="num"><span>Ambulance · pompiers</span><b>15</b></div>
    <div class="num"><span>Depuis un portable</span><b>112</b></div>
    <div class="carte" style="margin-top:12px"><h3>Assistance santé · carte Gold Mastercard</h3>
      <p>Appeler le numéro <b>au dos de la carte</b> (Europ Assistance, 24h/24) <b>AVANT toute dépense</b>, sinon rien n'est remboursé. Rapatriement, frais médicaux jusqu'à 155 000 €, avance des frais d'hôpital.</p>
      <p>Mail médical : medical@europ-assistance.fr</p></div>
    <div class="carte"><h3>Moto</h3><p>Panne ou accident : appeler l'assistance de l'assurance moto (numéro sur la carte verte). Garder carte grise, carte verte et déclaration d'importation temporaire sur soi.</p></div>
    <button class="btn" style="width:100%" onclick="document.getElementById('urgences').classList.add('hidden')">Fermer</button></div>`;
  $('#urgences').classList.remove('hidden');
};
$('#urgences').onclick = e => { if (e.target.id === 'urgences') $('#urgences').classList.add('hidden'); };

/* ---------- Démarrage ---------- */
function route(){ const id = location.hash.slice(1); chargerJour(PRETS.includes(id) ? id : PRETS[0]).catch(err => { $('#contenu').innerHTML = '<div class="alerte ko">Impossible de charger la journée (réseau ?).</div>'; console.log(err); }); }
barreJours(); window.addEventListener('hashchange', route); route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

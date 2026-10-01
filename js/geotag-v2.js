(function () {
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function tm3(lon,lat){var cm=lon<117?115.5:118.5;return{x:Math.round(200000+(lon-cm)*111320*Math.cos(lat*Math.PI/180)),y:Math.round((lat+10)*110540)}}
  function inRing(pt,ring){var x=pt[0],y=pt[1],hit=false;for(var i=0,j=ring.length-1;i<ring.length;j=i++){var a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
  function geometryContains(geometry,lon,lat){var polygons=geometry&&geometry.type==='Polygon'?[geometry.coordinates]:geometry&&geometry.type==='MultiPolygon'?geometry.coordinates:[];for(var p=0;p<polygons.length;p++){var rings=polygons[p]||[];if(!rings.length||!inRing([lon,lat],rings[0]))continue;var inHole=false;for(var h=1;h<rings.length;h++)if(inRing([lon,lat],rings[h])){inHole=true;break}if(!inHole)return true}return false}
  function adminRecord(feature){var a=feature&&feature.properties||{};return{village:a.WADMKD||a.DESA||a.NAMOBJ||'-',district:a.WADMKC||a.KECAMATAN||'-',regency:a.WADMKK||a.KAB_KOTA||'-',province:a.WADMPR||'Nusa Tenggara Barat',address:'',source:'Batas Administrasi Desa/Kelurahan NTB (SHP terbaru)'}}
  function localAdmin(lon,lat){
    if(typeof window.ntbAdminLookup==='function')return window.ntbAdminLookup(lon,lat,geometryContains).then(function(features){return features&&features.length?adminRecord(features[0]):null}).catch(function(){return null});
    var data=window.json_BatasAdministrasiKelurahandanDesaLombokTimur_3,fs=data&&data.features||[];for(var i=0;i<fs.length;i++)if(geometryContains(fs[i].geometry,lon,lat))return Promise.resolve(adminRecord(fs[i]));return Promise.resolve(null)
  }
  function internetAdmin(lon,lat){var url='https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&zoom=18&namedetails=1';return fetch(url,{headers:{'Accept-Language':'id'}}).then(function(r){if(!r.ok)throw Error();return r.json()}).then(function(d){var a=d.address||{};return{village:a.village||a.hamlet||a.neighbourhood||a.suburb||a.quarter||a.residential||a.locality||'-',district:a.city_district||a.district||a.subdistrict||a.town||a.municipality||'-',regency:a.county||a.city||a.municipality||'-',province:a.state||'-',address:d.display_name||'-',source:'OpenStreetMap/Nominatim'}}).catch(function(){return{village:'-',district:'-',regency:'-',province:'-',address:'Alamat internet tidak tersedia',source:'Koordinat GPS'}})}
  function adminAt(lon,lat){return localAdmin(lon,lat).then(function(local){if(local&&local.village!=='-'&&local.district!=='-')return local;return internetAdmin(lon,lat).then(function(remote){if(!local)return remote;local.village=local.village!=='-'?local.village:remote.village;local.district=local.district!=='-'?local.district:remote.district;local.regency=local.regency!=='-'?local.regency:remote.regency;local.province=local.province!=='-'?local.province:remote.province;local.address=remote.address;local.source='Batas Administrasi NTB terbaru + alamat internet';return local})})}
  function locate(success,failed){
    if(!navigator.geolocation){failed({code:0,message:'Geolocation tidak tersedia'});return}
    var finished=false;
    function done(position){if(finished)return;finished=true;success(position)}
    function lastError(error){if(finished)return;finished=true;failed(error||{code:0,message:'Lokasi tidak tersedia'})}
    navigator.geolocation.getCurrentPosition(done,function(firstError){
      if(firstError&&firstError.code===1){lastError(firstError);return}
      navigator.geolocation.getCurrentPosition(done,lastError,{enableHighAccuracy:false,timeout:30000,maximumAge:300000});
    },{enableHighAccuracy:true,timeout:20000,maximumAge:15000});
  }
  function locationErrorText(error){
    if(!window.isSecureContext)return 'GPS browser hanya dapat digunakan melalui HTTPS. Buka Bale Ruang NTB dari https://atrbpnproject.github.io/geopatuh/, bukan alamat HTTP atau IP lokal.';
    if(error&&error.code===1)return 'Akses lokasi ditolak oleh browser. Buka pengaturan situs Bale Ruang NTB, pilih Lokasi: Izinkan, lalu muat ulang halaman.';
    if(error&&error.code===2)return 'Sinyal lokasi perangkat belum tersedia. Aktifkan GPS/Location perangkat dan coba di area yang lebih terbuka.';
    if(error&&error.code===3)return 'Pembacaan lokasi terlalu lama. Pastikan GPS perangkat aktif lalu coba kembali.';
    return 'Lokasi perangkat belum dapat dibaca. Aktifkan GPS dan izin lokasi browser lalu coba kembali.';
  }
  function report(canvas,lat,lon,admin,stamp,w){
    if(!w){alert('Izinkan pop-up untuk membuka laporan PDF.');return}
    var photo=canvas.toDataURL('image/jpeg',.93);
    var portrait=canvas.height>canvas.width;
    var m=tm3(lon,lat);
    var maps='https://www.google.com/maps?q='+lat+','+lon;
    var appUrl='https://atrbpnproject.github.io/geopatuh/';
    var fileName='BaleRuangNTB_Geotagging_X_'+m.x+'_Y_'+m.y;
    var qr='https://quickchart.io/qr?size=220&margin=1&text='+encodeURIComponent(maps);
    var leafletCss=new URL('css/leaflet.css',location.href).href;
    var leafletJs=new URL('js/leaflet.js',location.href).href;
    var logo=new URL('images/bale-ruang-ntb-logo-v3.png',location.href).href;
    var payload=JSON.stringify({lat:lat,lon:lon,fileName:fileName}).replace(/</g,'\\u003c');
    var date=stamp.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    var time=stamp.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
    var html='<!doctype html><html><head><meta charset="utf-8"><title>'+fileName+'</title><link rel="stylesheet" href="'+leafletCss+'"><style>'+
      '@page{size:A4 portrait;margin:9mm}*{box-sizing:border-box}body{margin:0;color:#111;font:9px Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.header{height:25mm;display:flex;align-items:center;justify-content:space-between;margin-bottom:5mm;padding:4mm 6mm;border-bottom:2px solid #758692;background:#fff;color:#111}.brand{display:flex;align-items:center;gap:10px}.brand img{width:15mm;height:15mm;object-fit:contain}.brand b{display:block;font-size:18px;color:#111}.brand span{font-size:8px;color:#333}.doc-title{text-align:right;color:#111}.doc-title b{display:block;font-size:13px}.doc-title span{font-size:8px;color:#444}.photo-main{height:123mm;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #9aa8b1;border-radius:3mm;background:#e8ecef}.photo-main img{width:100%;height:100%;object-fit:contain}.photo-main.landscape img{object-fit:contain}.bottom{display:grid;grid-template-columns:55mm minmax(0,1fr) 40mm;gap:3mm;height:74mm;margin-top:4mm}.card{min-width:0;overflow:hidden;border:1px solid #aeb9c0;border-radius:2.5mm;background:#f7f9fa}.card h3{margin:0;padding:2.6mm 3mm;border-bottom:1px solid #c9d1d6;background:#e4e8eb;color:#111;font-size:10px}.map-wrap{position:relative;height:61mm;padding:3px}#map{height:100%;border-radius:1.5mm}.north{position:absolute;z-index:700;right:7px;top:7px;padding:3px 5px;border:1px solid #555;background:#fffffff0;color:#111;font-weight:700}.north:after{content:"▲";display:block;text-align:center;font-size:13px}.rows{display:grid;grid-template-columns:25mm 1fr}.rows b,.rows span{min-width:0;padding:1.5mm 2mm;border-bottom:1px solid #dde2e5;line-height:1.25}.rows b{color:#3f4a51}.rows span{overflow-wrap:anywhere}.source{padding:1.8mm 2mm;color:#66747c;font-size:7px}.qr-card{text-align:center}.qr-card img{display:block;width:27mm;height:27mm;margin:5mm auto 2mm}.qr-card strong{display:block;font-size:10px}.qr-card p{margin:1.5mm 3mm;color:#515d64;font-size:8px}.map-link{display:block;margin:3mm;padding:2mm;border:1px solid #8d9ba4;border-radius:2mm;color:#111;font-size:8px;font-weight:700;text-decoration:none;word-break:break-word}.footer{position:fixed;left:9mm;right:9mm;bottom:3mm;padding-top:2mm;border-top:1px solid #aeb8be;text-align:center;color:#111;font-size:7px}.footer a{color:#111}.print-action{display:none;position:fixed;z-index:9999;left:50%;bottom:18px;transform:translateX(-50%);padding:13px 22px;border:0;border-radius:10px;background:#0878cf;color:#fff;font-size:14px;font-weight:700;box-shadow:0 8px 25px #0005}.leaflet-control-attribution{font-size:5px!important}@media print{button{display:none!important}}</style></head><body><button class="print-action" id="printDocument" type="button">Cetak / Simpan PDF</button>'+
      '<header class="header"><div class="brand"><img src="'+logo+'"><div><b>Bale Ruang NTB</b><span>Satu Tempat, Seluruh Informasi Ruang</span></div></div><div class="doc-title"><b>Dokumentasi Geotagging</b><span>Foto kondisi berbasis koordinat</span></div></header>'+
      '<section class="photo-main '+(portrait?'portrait':'landscape')+'"><img src="'+photo+'" alt="Foto hasil jepretan"></section>'+
      '<section class="bottom"><article class="card"><h3>Peta Lokasi</h3><div class="map-wrap"><div id="map"></div><div class="north">U</div></div></article>'+
      '<article class="card"><h3>Data Geotagging</h3><div class="rows"><b>Desa/Kelurahan</b><span>'+esc(admin.village)+'</span><b>Kecamatan</b><span>'+esc(admin.district)+'</span><b>Kabupaten</b><span>'+esc(admin.regency)+'</span><b>Provinsi</b><span>'+esc(admin.province)+'</span><b>Latitude</b><span>'+lat.toFixed(7)+'</span><b>Longitude</b><span>'+lon.toFixed(7)+'</span><b>X TM3</b><span>'+m.x.toLocaleString('id-ID')+'</span><b>Y TM3</b><span>'+m.y.toLocaleString('id-ID')+'</span><b>Tanggal</b><span>'+esc(date)+'</span><b>Waktu</b><span>'+esc(time)+'</span>'+(admin.address?'<b>Alamat Internet</b><span>'+esc(admin.address)+'</span>':'')+'</div><div class="source">Sumber: '+esc(admin.source)+'</div></article>'+
      '<article class="card qr-card"><h3>Lokasi Digital</h3><img id="locationQr" src="'+qr+'" alt="QR lokasi"><strong>Scan QR Code</strong><p>Arahkan kamera untuk membuka posisi foto.</p><a class="map-link" href="'+maps+'" target="_blank">Buka lokasi di Map</a></article></section>'+
      '<footer class="footer">Dibuat menggunakan Bale Ruang NTB - <a href="'+appUrl+'" target="_blank">'+esc(appUrl)+'</a></footer><script src="'+leafletJs+'"><\/script><script>var r='+payload+';document.title=r.fileName;window.addEventListener("load",function(){document.title=r.fileName;var map=L.map("map",{zoomControl:false,attributionControl:false}),tiles=L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",{maxZoom:20,maxNativeZoom:20}).addTo(map);map.setView([r.lat,r.lon],18);L.marker([r.lat,r.lon]).addTo(map);L.control.scale({imperial:false,position:"bottomright"}).addTo(map);var done=false;function ready(){if(done)return;done=true;setTimeout(function(){document.title=r.fileName;try{parent.document.title=r.fileName}catch(e){}window.focus();window.print()},900)}tiles.on("load",ready);setTimeout(ready,3500)});<\/script></body></html>';
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
  function capture(){
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){alert('Kamera tidak tersedia pada browser ini.');return}
    var status=document.createElement('div');
    status.textContent='Mengambil koordinat lokasi…';
    status.style.cssText='position:fixed;z-index:2900;left:50%;top:50%;transform:translate(-50%,-50%);padding:15px 20px;border-radius:12px;background:#08233e;color:#fff;font:700 14px Arial;box-shadow:0 10px 35px #0007';
    document.body.appendChild(status);
    locate(function(pos){
      var capturedPosition={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy||0,timestamp:pos.timestamp||Date.now()},watchId=null;
      status.textContent='Koordinat diperoleh. Membuka kamera…';
      navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}).then(function(stream){
        status.remove();
        var video=document.createElement('video'),snap=document.createElement('button');
        watchId=navigator.geolocation.watchPosition(function(update){capturedPosition={latitude:update.coords.latitude,longitude:update.coords.longitude,accuracy:update.coords.accuracy||0,timestamp:update.timestamp||Date.now()}},function(){},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
        video.autoplay=true;video.playsInline=true;video.srcObject=stream;
        video.style.cssText='position:fixed;z-index:2800;inset:6%;width:88%;height:78%;object-fit:contain;background:#000;border-radius:14px';
        snap.textContent='Jepret dan Buat PDF';
        snap.style.cssText='position:fixed;z-index:2801;left:50%;bottom:7%;transform:translateX(-50%);padding:13px 24px;border:0;border-radius:10px;background:#0878cf;color:#fff;font-weight:700';
        document.body.append(video,snap);
        snap.onclick=function(){
          if(!video.videoWidth){alert('Kamera belum siap.');return}
          var canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
          var stamp=new Date();
          stream.getTracks().forEach(function(t){t.stop()});video.remove();snap.remove();
          var reserved=window.open('','_blank');
          if(!reserved){if(watchId!=null)navigator.geolocation.clearWatch(watchId);alert('Browser memblokir halaman laporan. Izinkan pop-up untuk Bale Ruang NTB.');return}
          reserved.document.open();reserved.document.write('<!doctype html><title>Menyiapkan laporan...</title><p style="font:16px Arial;padding:24px">Mengunci koordinat saat foto dijepret…</p>');reserved.document.close();
          var completed=false;
          function build(position){
            if(completed)return;completed=true;if(watchId!=null)navigator.geolocation.clearWatch(watchId);
            var lat=position.latitude,lon=position.longitude;
            try{reserved.document.body.innerHTML='<p style="font:16px Arial;padding:24px">Menganalisis koordinat terhadap batas administrasi dan menyiapkan PDF...</p>'}catch(e){}
            adminAt(lon,lat).then(function(a){report(canvas,lat,lon,a,stamp,reserved)});
          }
          var positionAge=Math.abs(stamp.getTime()-capturedPosition.timestamp);
          if(positionAge<=5000){build(capturedPosition);return}
          navigator.geolocation.getCurrentPosition(function(fresh){build({latitude:fresh.coords.latitude,longitude:fresh.coords.longitude,accuracy:fresh.coords.accuracy||0,timestamp:fresh.timestamp||Date.now()})},function(){build(capturedPosition)},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
        };
      }).catch(function(error){if(watchId!=null)navigator.geolocation.clearWatch(watchId);status.remove();alert(error&&error.name==='NotAllowedError'?'Izin kamera ditolak. Aktifkan izin kamera pada pengaturan situs Bale Ruang NTB.':'Kamera perangkat belum dapat dibuka.')});
    },function(error){status.remove();alert(locationErrorText(error))});
  }
  function init(){var menu=document.querySelector('.lontar-toolbox-menu');if(!menu||menu.querySelector('[data-geotag-report]'))return;var b=document.createElement('button');b.className='lontar-toolbox-item';b.type='button';b.dataset.geotagReport='1';b.innerHTML='<i class="fas fa-camera"></i>Foto & PDF Geotag';b.onclick=capture;menu.appendChild(b)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
}());

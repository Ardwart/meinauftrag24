// MeinAuftrag24 – Anbieterprofil mit Profilfoto & Referenzbildern
(() => {
  const MEDIA_BUCKET = 'provider-media';

  function portfolioLimit(){
    if(!activeSub()) return 0;
    return subscription?.plan==='pro' ? 30 : 8;
  }

  const style = document.createElement('style');
  style.textContent = `
    .providerIdentity{display:flex;align-items:center;gap:12px;margin-top:10px;flex-wrap:wrap}
    .providerAvatar{width:58px;height:58px;border-radius:50%;object-fit:cover;border:2px solid #e4e7ec;background:#f2f4f7}
    .providerAvatar.large{width:96px;height:96px}
    .profileMediaBox{margin-top:16px;border:1px solid var(--line);border-radius:18px;padding:18px;background:#fff}
    .mediaGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}
    .mediaTile{position:relative;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#f2f4f7;border:1px solid var(--line)}
    .mediaTile img{width:100%;height:100%;object-fit:cover;display:block}
    .mediaTile button{position:absolute;right:7px;top:7px;border:0;border-radius:999px;background:rgba(255,255,255,.94);padding:5px 8px;font-weight:900;color:#b42318}
    .profileHero{display:flex;gap:16px;align-items:center;margin:12px 0 18px}
    .profileGallery{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
    .profileGallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px;border:1px solid var(--line)}
    .uploadLine{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}
    .uploadLine input[type=file]{max-width:360px}
    @media(max-width:700px){.mediaGrid,.profileGallery{grid-template-columns:repeat(2,1fr)}}
  `;
  document.head.appendChild(style);

  function publicMediaUrl(path){
    if(!path) return '';
    if(/^https?:\/\//i.test(path)) return path;
    return sb.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  getProfiles = async function(ids){
    const unique=[...new Set(ids.filter(Boolean))];
    if(!unique.length)return{};
    const {data}=await sb.from('profiles').select('id,role,full_name,company_name,phone,postal_code,city,avatar_url,description').in('id',unique);
    return Object.fromEntries((data||[]).map(p=>[p.id,p]));
  };

  contactInfo = function(p){
    if(!p)return'';
    const isProvider=p.role==='provider';
    const avatar=isProvider&&p.avatar_url?`<img class="providerAvatar" src="${esc(publicMediaUrl(p.avatar_url))}" alt="Profilfoto">`:'';
    const phone=isProvider&&p.phone?`<span>📞 ${esc(p.phone)}</span>`:'';
    const place=p.city?`<span>📍 ${esc(p.postal_code||'')} ${esc(p.city)}</span>`:'';
    const profileBtn=isProvider?`<button class="btn ghost small" type="button" onclick="openProviderProfile('${p.id}')">👤 Anbieterprofil ansehen</button>`:'';
    if(isProvider) return `<div class="providerIdentity">${avatar}<div><div class="contactLine">${phone}${place}</div><div class="toolbar" style="margin-top:8px">${profileBtn}</div></div></div>`;
    return `<div class="contactLine">${place}<span>🔒 Telefonnummer nur nach Freigabe durch den Kunden</span></div>`;
  };

  window.openProviderProfile = async function(providerId){
    const [{data:p},{data:photos}] = await Promise.all([
      sb.from('profiles').select('id,role,full_name,company_name,phone,postal_code,city,avatar_url,description,verified').eq('id',providerId).single(),
      sb.from('provider_portfolio').select('*').eq('provider_id',providerId).order('created_at',{ascending:false})
    ]);
    if(!p) return alert('Anbieterprofil konnte nicht geladen werden.');
    const avatar=p.avatar_url?`<img class="providerAvatar large" src="${esc(publicMediaUrl(p.avatar_url))}" alt="Profilfoto">`:`<div class="providerAvatar large" style="display:grid;place-items:center;font-size:34px">👤</div>`;
    $('modalRoot').innerHTML=`<div class="modalBack" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="profileHero">${avatar}<div><span class="pill ${p.verified?'green':'blue'}">${p.verified?'Verifiziert':'Anbieter'}</span><h3 style="margin-top:7px">${esc(p.company_name||p.full_name||'Anbieter')}</h3><div class="meta">📍 ${esc(p.postal_code||'')} ${esc(p.city||'')}</div>${p.phone?`<div class="meta">📞 ${esc(p.phone)}</div>`:''}</div></div>${p.description?`<p class="desc">${esc(p.description)}</p>`:''}<h4>Referenzen & Arbeiten</h4>${photos?.length?`<div class="profileGallery">${photos.map(x=>`<img src="${esc(publicMediaUrl(x.image_path))}" alt="Referenzarbeit" title="${esc(x.caption||'Referenzarbeit')}">`).join('')}</div>`:'<div class="notice info">Dieser Anbieter hat noch keine Referenzbilder hochgeladen.</div>'}<div class="modalActions"><button class="btn primary" onclick="closeModal()">Schliessen</button></div></div></div>`;
  };

  async function uploadProviderFile(file,kind){
    if(!activeSub()) throw new Error('Für Profil- und Referenzbilder ist ein aktives Anbieter-Abo erforderlich.');
    if(!file || !file.type.startsWith('image/')) throw new Error('Bitte eine Bilddatei auswählen.');
    if(file.size > 5*1024*1024) throw new Error('Das Bild darf maximal 5 MB gross sein.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path=`${session.user.id}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const {error}=await sb.storage.from(MEDIA_BUCKET).upload(path,file,{cacheControl:'3600',upsert:false});
    if(error) throw error;
    return path;
  }

  window.uploadProviderAvatar = async function(){
    const input=$('providerAvatarInput'), file=input?.files?.[0];
    if(!file)return alert('Bitte zuerst ein Profilfoto auswählen.');
    try{
      const path=await uploadProviderFile(file,'avatar');
      const {error}=await sb.from('profiles').update({avatar_url:path}).eq('id',session.user.id);
      if(error) throw error;
      profile.avatar_url=path;
      alert('Profilfoto wurde gespeichert.');
      await renderMy();
    }catch(e){alert(e.message||'Profilfoto konnte nicht hochgeladen werden.');}
  };

  window.uploadPortfolioPhoto = async function(){
    const input=$('portfolioInput'), file=input?.files?.[0];
    if(!file)return alert('Bitte zuerst ein Foto auswählen.');
    try{
      const limit=portfolioLimit();
      const {count}=await sb.from('provider_portfolio').select('*',{count:'exact',head:true}).eq('provider_id',session.user.id);
      if((count||0)>=limit){
        if(subscription?.plan==='basic'){
          $('modalRoot').innerHTML=`<div class="modalBack" onclick="if(event.target===this)closeModal()"><div class="modal"><span class="pill orange">Basic-Limit erreicht</span><h3 style="margin-top:10px">8 Referenzbilder erreicht</h3><p class="desc">Du hast dein Basic-Limit von 8 Referenzbildern erreicht. Mit Pro kannst du bis zu 30 Referenzbilder präsentieren und unbegrenzt Offerten senden.</p><div class="modalActions"><button class="btn ghost" onclick="closeModal()">Später</button><button class="btn primary" onclick="closeModal();show('pricing')">Auf Pro wechseln</button></div></div></div>`;
          return;
        }
        return alert(`Du hast dein Pro-Limit von ${limit} Referenzbildern erreicht.`);
      }
      const path=await uploadProviderFile(file,'work');
      const caption=($('portfolioCaption')?.value||'').trim();
      const {error}=await sb.from('provider_portfolio').insert({provider_id:session.user.id,image_path:path,caption:caption||null});
      if(error){await sb.storage.from(MEDIA_BUCKET).remove([path]);throw error;}
      alert('Referenzbild wurde hinzugefügt.');
      await renderMy();
    }catch(e){alert(e.message||'Bild konnte nicht hochgeladen werden.');}
  };

  window.deletePortfolioPhoto = async function(id,path){
    if(!confirm('Dieses Referenzbild wirklich löschen?'))return;
    const {error}=await sb.from('provider_portfolio').delete().eq('id',id).eq('provider_id',session.user.id);
    if(error)return alert(error.message);
    await sb.storage.from(MEDIA_BUCKET).remove([path]);
    await renderMy();
  };

  async function renderProviderMediaManager(){
    if(profile?.role!=='provider')return;
    const target=$('myProfile');
    if(!target)return;
    const {data:photos}=await sb.from('provider_portfolio').select('*').eq('provider_id',session.user.id).order('created_at',{ascending:false});
    const count=photos?.length||0,limit=portfolioLimit();
    const avatar=profile.avatar_url?`<img class="providerAvatar large" src="${esc(publicMediaUrl(profile.avatar_url))}" alt="Profilfoto">`:`<div class="providerAvatar large" style="display:grid;place-items:center;font-size:34px">👤</div>`;
    const lock=!activeSub()?`<div class="notice warn"><strong>Profilbilder sind für Anbieter mit aktivem Abo verfügbar.</strong> Aktiviere Basic oder Pro, um dein Anbieterprofil mit Fotos aufzuwerten.</div>`:'';
    const upgrade=activeSub()&&subscription?.plan==='basic'&&count>=8?`<div class="notice warn"><strong>Basic-Limit erreicht: 8 von 8 Referenzbildern.</strong><br>Mit Pro kannst du bis zu 30 Referenzbilder präsentieren.<div class="toolbar"><button class="btn primary small" onclick="show('pricing')">Auf Pro wechseln</button></div></div>`:'';
    target.insertAdjacentHTML('beforeend',`<div class="profileMediaBox"><h3 style="margin-top:0">Dein Anbieterprofil</h3><p class="meta">Kunden sehen dein Profilfoto und deine Referenzarbeiten bei deinen Offerten und Nachrichten.</p>${lock}<div class="profileHero">${avatar}<div style="flex:1"><strong>Profilfoto</strong><div class="uploadLine"><input id="providerAvatarInput" type="file" accept="image/jpeg,image/png,image/webp" ${activeSub()?'':'disabled'}><button class="btn secondary small" onclick="uploadProviderAvatar()" ${activeSub()?'':'disabled'}>Profilfoto hochladen</button></div><div class="meta">JPG, PNG oder WebP · maximal 5 MB</div></div></div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><strong>Referenzbilder / ausgeführte Arbeiten</strong><div class="meta">${activeSub()?`${subscription?.plan==='pro'?'Pro':'Basic'}: ${count} von ${limit} Bildern verwendet.`:'Basic: bis 8 Bilder · Pro: bis 30 Bilder'} Lade nur Bilder hoch, für die du die nötigen Rechte hast.</div>${upgrade}<div class="uploadLine"><input id="portfolioInput" type="file" accept="image/jpeg,image/png,image/webp" ${activeSub()&&count<limit?'':'disabled'}><input id="portfolioCaption" placeholder="Kurze Beschreibung, z.B. Endreinigung" style="max-width:300px" ${activeSub()&&count<limit?'':'disabled'}><button class="btn primary small" onclick="uploadPortfolioPhoto()" ${activeSub()&&count<limit?'':'disabled'}>Foto hinzufügen</button></div>${photos?.length?`<div class="mediaGrid">${photos.map(x=>`<div class="mediaTile"><img src="${esc(publicMediaUrl(x.image_path))}" alt="Referenzbild"><button onclick="deletePortfolioPhoto('${x.id}','${esc(x.image_path)}')" title="Bild löschen">×</button></div>`).join('')}</div>`:'<div class="notice info">Noch keine Referenzbilder vorhanden.</div>'}</div>`);
  }

  const originalRenderMy = renderMy;
  renderMy = async function(){
    await originalRenderMy();
    await renderProviderMediaManager();
  };
})();

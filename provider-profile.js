// MeinAuftrag24 – lädt Zusatzmodule
(() => {
  function load(src,onload){
    const s=document.createElement('script');
    s.src=src+'?v='+Date.now();
    s.onload=onload||null;
    s.onerror=()=>console.error('Script konnte nicht geladen werden:',src);
    document.body.appendChild(s);
  }
  load('/provider-profile-core.js',()=>{
    load('/job-checklist.js',()=>{
      load('/rental-marketplace.js',()=>{
        load('/rental-management.js',()=>{
          load('/rental-edit.js',()=>load('/provider-reviews.js'));
        });
      });
    });
  });
})();

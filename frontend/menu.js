const yemekhaneSecimi = document.getElementById('yemekhane-secimi');
const ogunSecimi = document.getElementById('ogun-secimi');
const liste = document.getElementById('yemek-listesi');
const toplamAlani = document.getElementById('toplam-kalori');
let istekNo = 0;

async function menuyuYukle() {
  const no = ++istekNo;
  liste.replaceChildren();
  toplamAlani.textContent = 'Menü yükleniyor…';
  try {
    const secim = new URLSearchParams({ yemekhaneId: yemekhaneSecimi.value, ogunId: ogunSecimi.value });
    const yanit = await fetch('/api/menuler/bugun?' + secim);
    if (!yanit.ok) throw new Error('HTTP ' + yanit.status);
    const yemekler = await yanit.json();
    if (no !== istekNo) return;
    if (!yemekler.length) {
      toplamAlani.textContent = 'Bu yemekhane ve öğün için bugün menü kaydı yok.';
      return;
    }

    let toplamKalori = 0;
    for (const kayit of yemekler) {
      const madde = document.createElement('li');
      madde.textContent = kayit.yemek + ' (' + kayit.kalori + ' kcal)';
      if (kayit.vejetaryen === 1) madde.textContent += ' · Vejetaryen';
      if (kayit.alerjenler) madde.textContent += ' · Alerjenler: ' + kayit.alerjenler;
      liste.append(madde);
      toplamKalori += kayit.kalori ?? 0;
    }
    toplamAlani.textContent = 'Menünün toplam kalorisi: ' + toplamKalori + ' kcal';
  } catch (hata) {
    if (no !== istekNo) return;
    liste.replaceChildren();
    toplamAlani.textContent = 'Menü yüklenemedi.';
    console.error(hata);
  }
}

yemekhaneSecimi.addEventListener('change', menuyuYukle);
ogunSecimi.addEventListener('change', menuyuYukle);
menuyuYukle();

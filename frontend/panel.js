const eleman = id => document.getElementById(id);
const para = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
const bolumler = ['giris', 'hafta', 'rezervasyon', 'bakiye', 'degerlendirme', 'yonetim'];
const yonetimFormu = eleman('yonetim-formu');
const haftaSecimi = eleman('hafta-yemekhane');
let kullanici;
let ekranNo = 0;

async function api(yol, method = 'GET', veri) {
  const yanit = await fetch('/api' + yol, {
    method,
    headers: veri === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: veri === undefined ? undefined : JSON.stringify(veri),
    cache: 'no-store'
  });
  const sonuc = await yanit.json().catch(() => null);
  if (!yanit.ok) throw new Error(sonuc?.hata || 'Sunucuya ulaşılamadı (HTTP ' + yanit.status + ').');
  return sonuc;
}

function mesaj(metin, hata = false) {
  const alan = eleman('durum');
  alan.textContent = metin;
  alan.hidden = !metin;
  alan.classList.toggle('hata', hata);
}

async function calistir(islem, dugme) {
  if (dugme) dugme.disabled = true;
  mesaj('');
  try {
    await islem();
  } catch (hata) {
    mesaj(hata.message || 'İşlem tamamlanamadı.', true);
  } finally {
    if (dugme) dugme.disabled = false;
  }
}

function oge(tur, metin, sinif) {
  const sonuc = document.createElement(tur);
  sonuc.textContent = metin;
  if (sinif) sonuc.className = sinif;
  return sonuc;
}

function kart(baslik, ...satirlar) {
  const alan = oge('article', '', 'kart');
  alan.append(oge('h2', baslik), ...satirlar.map(satir => oge('p', satir)));
  return alan;
}

function secenekler(select, kayitlar) {
  select.replaceChildren(...kayitlar.map(({ id, ad }) => new Option(ad, id)));
}

function kutular(alan, kayitlar, name) {
  alan.replaceChildren(...kayitlar.map(({ id, ad }) => {
    const etiket = oge('label', '');
    const kutu = document.createElement('input');
    Object.assign(kutu, { name, type: 'checkbox', value: String(id) });
    etiket.append(kutu, ad);
    return etiket;
  }));
}

function formIsle(form, islem) {
  form.addEventListener('submit', olay => {
    olay.preventDefault();
    calistir(() => islem(new FormData(form)), olay.submitter);
  });
}

function baslik(kayit) {
  return kayit.tarih + ' · ' + kayit.yemekhane + ' · ' + kayit.ogun;
}

function listele(alan, satirlar, bosMesaj) {
  alan.replaceChildren(...(satirlar.length ? satirlar : [oge('p', bosMesaj)]));
}

async function haftayiGoster(no) {
  const liste = await api('/menuler/haftalik?yemekhaneId=' + encodeURIComponent(haftaSecimi.value));
  if (no !== ekranNo) return;
  const kartlar = liste.map(menu => {
    const alan = kart(baslik(menu), menu.yemekler.join(', '), 'Boş yer: ' + menu.bos_yer, 'Tam porsiyon: ' + para.format(menu.fiyat));
    if (!menu.sure_var || Number(menu.bos_yer) < 1) {
      const dugme = oge('button', menu.sure_var ? 'Yer kalmadı' : 'Rezervasyon süresi doldu');
      dugme.disabled = true;
      alan.append(dugme);
      return alan;
    }
    const form = oge('form', '');
    form.append(oge('button', 'Rezervasyon yap'));
    formIsle(form, async () => {
      const sonuc = await api('/rezervasyonlar', 'POST', { menuId: menu.menu_id });
      mesaj('Rezervasyon yapıldı. Güncel bakiye ' + para.format(sonuc.bakiye));
      if (no === ekranNo) await haftayiGoster(no);
    });
    alan.append(form);
    return alan;
  });
  listele(eleman('hafta-listesi'), kartlar, 'Bu yemekhane için haftalık menü yok.');
}

const durumlar = { aktif: 'Aktif', kullanildi: 'Kullanıldı', iptal: 'İptal' };

async function rezervasyonlariGoster(no) {
  const liste = await api('/rezervasyonlar');
  if (no !== ekranNo) return;
  const kartlar = liste.map(kayit => {
    const alan = kart(baslik(kayit), durumlar[kayit.durum], (kayit.porsiyon === 'yarim' ? 'Yarım' : 'Tam') + ' porsiyon · ' + para.format(kayit.ucret));
    if (kayit.durum === 'aktif' && kayit.sure_var) {
      const dugme = oge('button', 'Rezervasyonu iptal et');
      dugme.addEventListener('click', () => calistir(async () => {
        const sonuc = await api('/rezervasyonlar/' + kayit.id + '/iptal', 'POST');
        mesaj('Rezervasyon iptal edildi. Güncel bakiye ' + para.format(sonuc.bakiye));
        if (no === ekranNo) await rezervasyonlariGoster(no);
      }, dugme));
      alan.append(dugme);
    }
    return alan;
  });
  listele(eleman('rezervasyon-listesi'), kartlar, 'Henüz rezervasyon yok.');
}

async function bakiyeyiGoster(no) {
  const sonuc = await api('/bakiye');
  if (no !== ekranNo) return;
  eleman('bakiye-tutar').textContent = para.format(sonuc.bakiye);
  const turler = { yukleme: 'Yükleme', rezervasyon: 'Rezervasyon', iade: 'İade' };
  const satirlar = sonuc.hareketler.map(kayit =>
    oge('li', kayit.olusturma + ' · ' + turler[kayit.tur] + ' · ' + para.format(kayit.tutar))
  );
  eleman('hareketler').replaceChildren(...(satirlar.length ? satirlar : [oge('li', 'Henüz hareket yok.')]));
}

async function degerlendirmeleriGoster(no) {
  const liste = await api('/rezervasyonlar');
  if (no !== ekranNo) return;
  const kartlar = liste.filter(kayit => kayit.durum === 'kullanildi').map(kayit => {
    const alan = kart(baslik(kayit));
    if (kayit.puan !== null) {
      alan.append(oge('p', 'Verdiğin puan: ' + kayit.puan + '/5'));
      return alan;
    }
    const form = oge('form', '');
    const puanEtiketi = oge('label', 'Puan');
    const puan = document.createElement('select');
    puan.name = 'puan';
    for (let sayi = 1; sayi <= 5; sayi++) puan.append(new Option(String(sayi), sayi));
    puanEtiketi.append(puan);
    const yorumEtiketi = oge('label', 'Yorum');
    const yorum = document.createElement('textarea');
    Object.assign(yorum, { name: 'yorum', maxLength: 500 });
    yorumEtiketi.append(yorum);
    form.append(puanEtiketi, yorumEtiketi, oge('button', 'Değerlendirmeyi gönder'));
    formIsle(form, async veri => {
      await api('/degerlendirmeler', 'POST', { menuId: kayit.menu_id, puan: veri.get('puan'), yorum: veri.get('yorum') });
      mesaj('Değerlendirme kaydedildi.');
      if (no === ekranNo) form.replaceWith(oge('p', 'Verdiğin puan: ' + veri.get('puan') + '/5'));
    });
    alan.append(form);
    return alan;
  });
  listele(eleman('degerlendirme-listesi'), kartlar, 'Değerlendirilebilecek kullanılmış menü yok.');
}

function yeniMenu() {
  yonetimFormu.reset();
  yonetimFormu.elements.id.value = '';
  eleman('yonetim-form-baslik').textContent = 'Yeni menü';
}

async function yonetimiGoster(no) {
  const liste = await api('/yonetim/menuler');
  if (no !== ekranNo) return;
  const kartlar = liste.map(menu => {
    const alan = kart(baslik(menu), 'Doluluk: ' + menu.rezerve + '/' + menu.kapasite +
      ' (%' + menu.doluluk_yuzde + ')', 'Ortalama puan: ' + (menu.ortalama_puan ?? 'Henüz puan yok') + ' · ' + menu.oy_sayisi + ' oy');
    const dugme = oge('button', 'Düzenle');
    dugme.addEventListener('click', () => calistir(async () => {
      const kayit = await api('/yonetim/menuler/' + menu.menu_id);
      if (no !== ekranNo) return;
      const alanlar = yonetimFormu.elements;
      alanlar.id.value = kayit.id;
      alanlar.tarih.value = kayit.tarih;
      alanlar.yemekhaneId.value = kayit.yemekhane_id;
      alanlar.ogunId.value = kayit.ogun_id;
      alanlar.ogrenci.value = kayit.ogrenci_fiyati;
      alanlar.personel.value = kayit.personel_fiyati;
      const secili = new Set(kayit.yemekler.map(String));
      for (const kutu of eleman('yemek-secimleri').querySelectorAll('input')) kutu.checked = secili.has(kutu.value);
      eleman('yonetim-form-baslik').textContent = 'Menüyü düzenle';
      alanlar.tarih.focus();
    }, dugme));
    alan.append(dugme);
    return alan;
  });
  listele(eleman('yonetim-listesi'), kartlar, 'Henüz menü yok.');
}

async function ekraniGoster() {
  const no = ++ekranNo;
  const istenen = location.hash.slice(1);
  let ekran = kullanici && bolumler.includes(istenen) && istenen !== 'giris' ? istenen : kullanici ? 'hafta' : 'giris';
  if (ekran === 'yonetim' && kullanici.rol !== 'yonetici') ekran = 'hafta';
  for (const id of bolumler) eleman(id).hidden = id !== ekran;
  for (const oge of document.querySelectorAll('[data-oturum]')) oge.hidden = !kullanici;
  eleman('yonetim-baglanti').hidden = kullanici?.rol !== 'yonetici';
  eleman('kullanici').hidden = !kullanici;
  eleman('kullanici').textContent = kullanici ? kullanici.ad + ' ' + kullanici.soyad : '';
  const yukleyici = {
    hafta: haftayiGoster, rezervasyon: rezervasyonlariGoster, bakiye: bakiyeyiGoster,
    degerlendirme: degerlendirmeleriGoster, yonetim: yonetimiGoster
  }[ekran];
  if (yukleyici) await yukleyici(no);
}

formIsle(eleman('giris-formu'), async veri => {
  kullanici = await api('/giris', 'POST', Object.fromEntries(veri));
  eleman('giris-formu').reset();
  await ekraniGoster();
});

eleman('cikis').addEventListener('click', () => calistir(async () => {
  await api('/cikis', 'POST');
  kullanici = null;
  yeniMenu();
  history.replaceState(null, '', '/');
  await ekraniGoster();
}, eleman('cikis')));

formIsle(eleman('bakiye-formu'), async veri => {
  const sonuc = await api('/bakiye', 'POST', { tutar: veri.get('tutar') });
  eleman('bakiye-formu').reset();
  mesaj('Yükleme tamamlandı. Güncel bakiye ' + para.format(sonuc.bakiye));
  await bakiyeyiGoster(ekranNo);
});

formIsle(yonetimFormu, async veri => {
  const id = veri.get('id');
  const sonuc = await api('/yonetim/menuler' + (id ? '/' + id : ''), id ? 'PUT' : 'POST', {
    ...Object.fromEntries(veri),
    yemekler: veri.getAll('yemek')
  });
  yeniMenu();
  mesaj(sonuc.uyari || 'Menü kaydedildi.');
  await yonetimiGoster(ekranNo);
});

formIsle(eleman('turnike-formu'), async veri => {
  const sonuc = await api('/yonetim/turnike', 'POST', Object.fromEntries(veri));
  mesaj('Geçiş kaydedildi. Öğün: ' + sonuc.ogun);
});

eleman('yeni-menu').addEventListener('click', yeniMenu);
haftaSecimi.addEventListener('change', () => calistir(() => haftayiGoster(++ekranNo)));
window.addEventListener('hashchange', () => calistir(ekraniGoster));

calistir(async () => {
  const [oturum, secimler] = await Promise.all([api('/oturum'), api('/secenekler')]);
  kullanici = oturum;
  secenekler(haftaSecimi, secimler.yemekhaneler);
  secenekler(eleman('turnike-formu').elements.yemekhaneId, secimler.yemekhaneler);
  secenekler(yonetimFormu.elements.yemekhaneId, secimler.yemekhaneler);
  secenekler(yonetimFormu.elements.ogunId, secimler.ogunler);
  kutular(eleman('yemek-secimleri'), secimler.yemekler, 'yemek');
  await ekraniGoster();
});

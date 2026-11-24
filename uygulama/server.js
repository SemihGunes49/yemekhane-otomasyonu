const express = require('express');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const oturumlar = new Map();
const veriKatmani = require('./veri');
const menu = require('./menu');

const app = express();
const oturumSuresi = 1800;
app.disable('x-powered-by');
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '16kb' }));

function sorun(status, message) {
  return Object.assign(new Error(message), { status });
}

function kimlik(deger) {
  if (!/^\d+$/.test(String(deger)) || Array.isArray(deger)) throw sorun(400, 'Geçersiz kimlik.');
  const id = Number(deger);
  if (!Number.isSafeInteger(id) || id < 1 || id > 4294967295) throw sorun(400, 'Geçersiz kimlik.');
  return id;
}

function tarih(deger) {
  if (typeof deger !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deger)) throw sorun(400, 'Geçersiz tarih.');
  const zaman = new Date(deger);
  if (Number.isNaN(+zaman) || zaman.toISOString().slice(0, 10) !== deger || deger < '1000-01-01') {
    throw sorun(400, 'Geçersiz tarih.');
  }
  return deger;
}

function tutar(deger, min, max) {
  if (typeof deger !== 'number' && typeof deger !== 'string') throw sorun(400, 'Geçersiz tutar.');
  const sayi = Number(deger);
  if (!/^\d+(\.\d{1,2})?$/.test(String(deger)) || sayi < min || sayi > max) {
    throw sorun(400, `Tutar ${min}–${max} TL arasında olmalı ve en fazla iki ondalık içermeli.`);
  }
  return sayi;
}

function token(req) {
  return /(?:^|;\s*)oturum=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
}

async function kimlikDogrula(req, res, next) {
  const anahtar = token(req);
  const mevcut = oturumlar.get(anahtar);
  req.kullanici = mevcut?.bitis > Date.now() ? mevcut.kullanici : null;
  if (req.kullanici) mevcut.bitis = Date.now() + oturumSuresi * 1000;
  else if (mevcut) oturumlar.delete(anahtar);
  if (req.kullanici) res.cookie('oturum', anahtar, { httpOnly: true, sameSite: 'lax', maxAge: oturumSuresi * 1000 });
  next();
}

function giris(req, res, next) {
  if (!req.kullanici) throw sorun(401, 'Önce giriş yapın.');
  next();
}

function yonetici(req, res, next) {
  if (req.kullanici.rol !== 'yonetici') throw sorun(403, 'Yönetici yetkisi gerekiyor.');
  next();
}

app.use('/api', kimlikDogrula);
app.get('/api', (req, res) => res.json({ durum: 'hazır' }));

app.post('/api/giris', async (req, res) => {
  const { eposta, sifre } = req.body || {};
  if (typeof eposta !== 'string' || eposta.length > 120 || typeof sifre !== 'string' ||
      !sifre || Buffer.byteLength(sifre) > 72) throw sorun(400, 'E-posta ve şifreyi kontrol edin.');
  const hesap = await veriKatmani.hesap(eposta.trim());
  if (!hesap || !await bcrypt.compare(sifre, hesap.sifre_hash)) throw sorun(401, 'E-posta veya şifre hatalı.');
  const eski = token(req);
  if (eski) oturumlar.delete(eski);
  const yeni = randomBytes(32).toString('hex');
  const { sifre_hash, ...kullanici } = hesap;
  oturumlar.set(yeni, { kullanici, bitis: Date.now() + oturumSuresi * 1000 });
  res.cookie('oturum', yeni, { httpOnly: true, sameSite: 'lax', maxAge: oturumSuresi * 1000 });
  res.json(kullanici);
});

app.post('/api/cikis', async (req, res) => {
  const mevcut = token(req);
  if (mevcut) oturumlar.delete(mevcut);
  res.clearCookie('oturum', { httpOnly: true, sameSite: 'lax' });
  res.json({ tamam: true });
});

app.get('/api/oturum', (req, res) => res.json(req.kullanici));
app.get('/api/secenekler', async (req, res) => {
  res.json(await veriKatmani.secenekler());
});

const istanbulSaati = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

function istanbulGunu() {
  const parc = Object.fromEntries(istanbulSaati.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return {
    gun: [parc.year, parc.month, parc.day].join('-'),
    sure: 86400 - (Number(parc.hour) * 3600 + Number(parc.minute) * 60 + Number(parc.second))
  };
}

app.get('/api/menuler/bugun', async (req, res) => {
  const yemekhaneId = kimlik(req.query.yemekhaneId ?? 2);
  const ogunId = kimlik(req.query.ogunId ?? 1);
  const { gun, sure } = istanbulGunu();
  const yemekler = await menu.bugun(gun, yemekhaneId, ogunId);
  res.json(yemekler);
});

app.get('/api/menuler/haftalik', giris, async (req, res) => {
  const yemekhaneId = kimlik(req.query.yemekhaneId ?? 1);
  const { list, yemekler } = await menu.haftalik(yemekhaneId);
  res.json(list.map(kayit => ({
    ...kayit,
    fiyat: req.kullanici.rol === 'ogrenci' ? kayit.ogrenci_fiyati : kayit.personel_fiyati,
    yemekler: yemekler.filter(yemek => yemek.menu_id === kayit.menu_id).map(yemek => yemek.yemek)
  })));
});

app.get('/api/rezervasyonlar', giris, async (req, res) => {
  res.json(await veriKatmani.rezervasyonlar(req.kullanici.id));
});

app.post('/api/rezervasyonlar', giris, async (req, res) => {
  const id = req.kullanici.id;
  res.status(201).json(await veriKatmani.rezervasyonYap(id, kimlik(req.body?.menuId)));
});

app.post('/api/rezervasyonlar/:id/iptal', giris, async (req, res) => {
  const id = req.kullanici.id;
  res.json(await veriKatmani.rezervasyonIptal(id, kimlik(req.params.id)));
});

app.get('/api/bakiye', giris, async (req, res) => {
  const id = req.kullanici.id;
  res.json(await veriKatmani.bakiyeDetay(id));
});

app.post('/api/bakiye', giris, async (req, res) => {
  const id = req.kullanici.id;
  res.json(await veriKatmani.bakiyeYukle(id, tutar(req.body?.tutar, 10, 1000)));
});

app.post('/api/degerlendirmeler', giris, async (req, res) => {
  const id = req.kullanici.id;
  const menuId = kimlik(req.body?.menuId);
  const puan = kimlik(req.body?.puan);
  const yorum = req.body?.yorum ?? '';
  if (puan > 5 || typeof yorum !== 'string' || yorum.length > 500) throw sorun(400, 'Puan 1–5, yorum en fazla 500 karakter olmalı.');
  const yazildi = await veriKatmani.degerlendir(id, menuId, puan, yorum.trim() || null);
  if (!yazildi) throw sorun(409, 'Yalnızca kullanılan menüler değerlendirilebilir.');
  res.status(201).json({ tamam: true });
});

app.post('/api/yonetim/turnike', giris, yonetici, async (req, res) => {
  res.json(await veriKatmani.turnikeGecis(kimlik(req.body?.kullaniciId), kimlik(req.body?.yemekhaneId)));
});

app.get('/api/yonetim/menuler', giris, yonetici, async (req, res) => {
  res.json(await menu.yonetimListesi());
});

app.get('/api/yonetim/menuler/:id', giris, yonetici, async (req, res) => {
  const kayit = await menu.duzenleme(kimlik(req.params.id));
  if (!kayit) throw sorun(404, 'Menü bulunamadı.');
  res.json(kayit);
});

async function menuKaydet(req, res) {
  const id = req.params.id ? kimlik(req.params.id) : null;
  const veri = req.body || {};
  if (!Array.isArray(veri.yemekler) || !veri.yemekler.length || veri.yemekler.length > 100) {
    throw sorun(400, 'En az bir yemek seçin.');
  }
  const secim = {
    yemekhaneId: kimlik(veri.yemekhaneId), ogunId: kimlik(veri.ogunId),
    tarih: tarih(veri.tarih), ogrenci: tutar(veri.ogrenci, 0.01, 999999.99),
    personel: tutar(veri.personel, 0.01, 999999.99),
    yemekler: [...new Set(veri.yemekler.map(kimlik))]
  };
  const kayit = await menu.kaydet(id, secim);
  if (!kayit) throw sorun(404, 'Menü bulunamadı.');
  res.status(id ? 200 : 201).json({ id: kayit.id });
}

app.post('/api/yonetim/menuler', giris, yonetici, menuKaydet);
app.put('/api/yonetim/menuler/:id', giris, yonetici, menuKaydet);

app.use('/api', (req, res) => res.status(404).json({ hata: 'Adres bulunamadı.' }));
app.use((hata, req, res, next) => {
  if (res.headersSent) return next(hata);
  if (hata.sqlState === '45000') return res.status(409).json({ hata: hata.sqlMessage });
  if (hata.code === 'ER_DUP_ENTRY') return res.status(409).json({ hata: 'Bu kayıt zaten var.' });
  if (hata.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ hata: 'Seçilen kayıt bulunamadı.' });
  if (hata.status && hata.status < 500) return res.status(hata.status).json({ hata: hata.message });
  console.error(hata);
  res.status(500).json({ hata: 'Sunucu işlemi tamamlayamadı.' });
});

app.listen(Number(process.env.PORT || 8000), '0.0.0.0');

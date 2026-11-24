const { okuma, yazma } = require('./db');

async function satirlar(havuz, sql, degerler = []) {
  const [sonuc] = await havuz.execute(sql, degerler);
  return sonuc;
}

const oku = (sql, degerler) => satirlar(okuma, sql, degerler);
const yaz = (sql, degerler) => satirlar(yazma, sql, degerler);

async function islem(fonksiyon) {
  const baglanti = await yazma.getConnection();
  try {
    await baglanti.beginTransaction();
    const sonuc = await fonksiyon((sql, degerler) => satirlar(baglanti, sql, degerler));
    await baglanti.commit();
    return sonuc;
  } catch (hata) {
    await baglanti.rollback();
    throw hata;
  } finally {
    baglanti.release();
  }
}

async function bakiye(id) {
  const [hesap] = await yaz('SELECT bakiye FROM kullanicilar WHERE id = ?', [id]);
  return hesap.bakiye;
}

async function yordam(sql, degerler, id) {
  const [kayitlar] = await yaz(sql, degerler);
  return { ...kayitlar[0], bakiye: await bakiye(id) };
}

async function hesap(eposta) {
  const [kayit] = await oku('SELECT id,ad,soyad,rol,sifre_hash FROM kullanicilar WHERE eposta=? AND aktif=1', [eposta]);
  return kayit;
}

async function secenekler() {
  const [yemekhaneler, ogunler, yemekler, alerjenler] = await Promise.all([
    oku('SELECT id,ad FROM yemekhaneler ORDER BY id'),
    oku('SELECT id,ad FROM ogunler ORDER BY sira'),
    oku('SELECT id,ad FROM yemekler ORDER BY ad'),
    oku('SELECT id,ad FROM alerjenler ORDER BY ad')
  ]);
  return { yemekhaneler, ogunler, yemekler, alerjenler };
}

async function bakiyeDetay(id) {
  const guncel = await bakiye(id);
  const hareketler = await oku('SELECT id,tur,tutar,aciklama,olusturma FROM bakiye_hareketleri WHERE kullanici_id=? ORDER BY id DESC', [id]);
  return { bakiye: guncel, hareketler };
}

function rezervasyonlar(id) {
  return oku(`SELECT r.id,r.menu_id,r.durum,r.ucret, 'tam' AS porsiyon,d.tarih,d.yemekhane,d.ogun,
    NOW() < d.rezervasyon_son AS sure_var, deg.puan
    FROM rezervasyonlar r JOIN v_menu_doluluk d ON d.menu_id=r.menu_id
    LEFT JOIN degerlendirmeler deg ON deg.menu_id=r.menu_id AND deg.kullanici_id=r.kullanici_id
    WHERE r.kullanici_id=? ORDER BY d.tarih DESC,r.id DESC`, [id]);
}

async function degerlendir(id, menuId, puan, yorum) {
  const sonuc = await yaz(`INSERT INTO degerlendirmeler (kullanici_id,menu_id,puan,yorum)
    SELECT kullanici_id,menu_id,?,? FROM rezervasyonlar WHERE kullanici_id=? AND menu_id=? AND durum='kullanildi'`,
    [puan, yorum, id, menuId]);
  return sonuc.affectedRows > 0;
}

async function kaynakGtid() {
  const [{ gtid }] = await yaz('SELECT @@GLOBAL.gtid_executed AS gtid');
  return gtid;
}

async function replikayiBekle(gtid) {
  const [{ bekleme }] = await oku('SELECT WAIT_FOR_EXECUTED_GTID_SET(?,5) AS bekleme', [gtid]);
  return bekleme === 0;
}

module.exports = {
  oku, yaz, islem, hesap, secenekler, bakiyeDetay, rezervasyonlar, degerlendir,
  kaynakGtid, replikayiBekle,
  rezervasyonYap: (id, menuId) => yordam('CALL sp_rezervasyon_yap(?,?)', [id, menuId], id),
  rezervasyonIptal: (id, rezervasyonId) => yordam('CALL sp_rezervasyon_iptal(?,?)', [id, rezervasyonId], id),
  turnikeGecis: async (id, yemekhaneId) => {
    const [satirlar] = await yaz('CALL sp_turnike_gecis(?,?,NULL)', [id, yemekhaneId]);
    return satirlar[0];
  },
  bakiyeYukle: (id, tutar) => yordam('CALL sp_bakiye_yukle(?,?)', [id, tutar], id)
};

const { oku, yaz, islem } = require('./veri');

const detay = `SELECT menu_id, yemekhane_id, ogun_id, yemekhane, ogun, yemek, kalori,
  vejetaryen, alerjenler, alerjen_idler
  FROM v_menu_detay WHERE tarih = ? AND yemekhane_id = ? AND ogun_id = ?
  ORDER BY kategori_sira, yemek`;

const liste = `SELECT d.*, m.ogrenci_fiyati, m.personel_fiyati,
  NOW() < d.rezervasyon_son AS sure_var, p.ortalama_puan, p.oy_sayisi
  FROM v_menu_doluluk d JOIN menuler m ON m.id = d.menu_id
  JOIN v_menu_puan p ON p.menu_id = d.menu_id`;

async function kaydet(id, menu) {
  return islem(async sorgu => {
    const degerler = [menu.yemekhaneId, menu.tarih, menu.ogunId, menu.ogrenci, menu.personel];
    let eski = null;
    if (id) {
      [eski] = await sorgu('SELECT yemekhane_id, tarih, ogun_id FROM menuler WHERE id = ? FOR UPDATE', [id]);
      if (!eski) return null;
      await sorgu('UPDATE menuler SET yemekhane_id=?, tarih=?, ogun_id=?, ogrenci_fiyati=?, personel_fiyati=? WHERE id=?', [...degerler, id]);
      await sorgu('DELETE FROM menu_yemekleri WHERE menu_id=?', [id]);
    } else {
      const sonuc = await sorgu('INSERT INTO menuler (yemekhane_id,tarih,ogun_id,ogrenci_fiyati,personel_fiyati) VALUES (?,?,?,?,?)', degerler);
      id = sonuc.insertId;
    }
    for (const yemekId of menu.yemekler) {
      await sorgu('INSERT INTO menu_yemekleri (menu_id,yemek_id) VALUES (?,?)', [id, yemekId]);
    }
    return { id, eski };
  });
}

async function duzenleme(id) {
  const [menu] = await yaz('SELECT * FROM menuler WHERE id=?', [id]);
  if (!menu) return null;
  const yemekler = await yaz('SELECT yemek_id FROM menu_yemekleri WHERE menu_id=?', [id]);
  return { ...menu, yemekler: yemekler.map(yemek => yemek.yemek_id) };
}

async function haftalik(id) {
  const [list, yemekler] = await Promise.all([
    oku(liste + ' WHERE d.yemekhane_id=? AND d.tarih BETWEEN CURDATE() AND CURDATE()+INTERVAL 6 DAY ORDER BY d.tarih,d.ogun_id', [id]),
    oku('SELECT menu_id,yemek FROM v_menu_detay WHERE yemekhane_id=? AND tarih BETWEEN CURDATE() AND CURDATE()+INTERVAL 6 DAY ORDER BY kategori_sira,yemek', [id])
  ]);
  return { list, yemekler };
}

module.exports = {
  bugun: (gun, yemekhaneId, ogunId) => oku(detay, [gun, yemekhaneId, ogunId]),
  yonetimListesi: () => oku(liste + ' ORDER BY d.tarih DESC,d.yemekhane_id,d.ogun_id'),
  haftalik, kaydet, duzenleme
};

# Yemekhane Otomasyonu

Mimari **Web API + HTML/CSS/JavaScript**. Backend Express, veri katmanı MySQL, oturum ve önbellek Redis. Başlangıç paketindeki örnek hesaplar README.md içinde.

## Çalıştırma

Docker Desktop çalışırken bu klasörde `docker compose up -d` çalıştırın.
`docker compose ps -a` ile uygulama ve frontend durumunu kontrol edin. `replica-setup` için `Exited (0)` normaldir. Ardından http://localhost:8080/ adresini açın.

Önceki başlangıç paketiyle aynı Docker projesi ve volume’lar kullanılıyorsa Docker Compose güncel servisleri oluşturur. Migration kaynak veritabanına otomatik uygulanır. Ödevin eski verileri korunur. Eski konteynerleri kaldırmak gerekirse volume’ları silmeden ilerleyin.

## Gösterim sırası

1. Günün Menüsü sayfasında yemekhaneyi ve öğünü değiştirin. Kalorileri ve alerjenleri gösterin.
2. Bir öğrenci hesabıyla giriş yapın. Haftalık menüden süresi geçmemiş bir öğle veya akşam menüsü seçin. Yarım porsiyon ayırın ve rezervasyonlar ekranından iptal edin.
3. Bakiye hareketlerini gösterin. Kullanılmış bir menüyü değerlendirin. Alerjen profilini kaydedip Günün Menüsü sayfasına dönün.
4. Yönetici hesabıyla menü oluşturun veya düzenleyin. Doluluk ve ortalama puanı gösterin. Menü önbelleğini güncellemeden önce ve sonra karşılaştırın.
5. Uygulama servisini yeniden başlatıp oturumun durduğunu doğrulayın. Çıkış yapınca Redis oturum anahtarı silinir.

Rapor, ekran görüntüleri, migration’ın replika çıktısı ve test özeti `rapor/` klasöründe.

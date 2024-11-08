- Proje dockerize edilmedi hızlı başlangıç için xampp kurun.
- C:\xampp\htdocs klasörü içine projeyi ekleyin ( git clone https://github.com/ozgurvurgun/corder-restaurant-order-management.git )
- Projede ki SQL dosyasını xampp ile dahili olarak gelen mysql'in içine aktarın.
- .env dosyasında ki bilgilerinizi düzeltin (veritabanı adını "corder" yaparsanız ve projeyi htdocs klasörü içinde iken git ile dahil ederseniz .env dosyasını varsayılan gelen değerler ile bırakabilirsiniz. Tabi veritabanı kullanıcı adınızı ve parolanızı siz biliyorsunuz!)
- Eğer proje dizininde değişiklik var ise manifest dosyaları ve serviceWorker dosyalarında buna uygun url leri belirtin.
- Bu aşamalardan sonra proje çalışıyor olmalı
- PHP sürümünüzün 8 ve üstü olmasını öneririm. Son xampp versiyonunu indirdi iseniz problem yok.


<br>
<br>

- Proje PWA el terminali ve masaüstünde kullanılacak iki parça şeklinde dizayn edildi. http://localhost/corder-restaurant-order-management/terminal-users bu linkten el terminalini kullanırsınız.

- http://localhost/corder-restaurant-order-management/admin/dashboard bu linkten admin paneline ulaşırsınız
- http://localhost/corder-restaurant-order-management/?table=2 QR menü (masadan sipariş alma işlevi mevcut ama pasif. Apisi yazılıp hemen işlevsel duruma gelebilir)
- Terminal kullanıcı adı: admin@admin.com
- Terminal parola: 1234
- Masa üzerine tıklayınca masa ile ilgili yapabileceğiniz operasyonlar gelir. Bu sayfa da adisyon adedinin belirtildiği kısıma tıklarsanız açık masanın bütün sipariş geçmişi görebilirsiniz.

<br>

- Kısaca hikaye; garson masaya gider el terminalinden sipariş alır, aldığı sipariş admin paneline düşer ve aynı zamanda yazıcıdan sipariş basılır. 

- printer-service dizininde ki ufak app corder apilerine istek atık yeni sipariş olup olmama veya fiş basım emri durumlarına göre yazıcıdan çıktı alınmasını sağlar. Bu özelliği aktif etmek için bat dosyasında ki düzenlemeleri yapınız.
<br>

- Siparişleri alır almaz print etmek istiyorsanız ilk olarak bir varsayılan yazıcı tanımlayın windows pc de. ardından C dizini altında "compartPrinter" klasörü oluşturun. Ardından proje içinde ki printer-service klasörü altında ki .bat ve .php dosyasını  compartPrinter klasörü içine yerleştirin. Bat dosyanız için dilediğiniz bir yerde kısayol oluşturup dosyayı çalışıtırın. Sol üstte küçük bir console size yazdırma durumu ile ilgili bilgi verecektir.

- Projede çok çok fazla eksik bulunuyor. Örneğin güvenlik namına hiçbir şey yok, sistemin bazı işlevleri eksik, başta ki temiz kod alayışı ilerleyen noktalarda makarna tadı vermeye başlıyor. Projenin başlarında motivasyonum çeşitli standartlara(PSR gibi), mimarilere uygun, genişletilebilir, modüler, side effect'i minimum seviyede olan pure teknolojilerin en efektif şekilde kullanıldığı öğretici bir proje yapmak idi. Ne yazık ki dikkatim çabuk dağılabiliyor ve çabuk sıkılıyorum. O yüzden bir çok noktayı sallamasyon geçtim diyebiliim.
<br>
<br>

(İş yükümü hafifletir isem projenin eksik her detayını kapatacağım.Bu mesaj burada duruyor ise bahsi geçen açıklar hala bulunuyor demektir.)
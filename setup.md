- Proje dockerize edilmedi hızlı başlangıç için xampp kurun
- htdocs klasörü içine projeyi ekleyin
- Projede ki SQL dosyasını içe aktarın. (xampp phpmyadmin ile yapabilirsiniz)
- .env dosyasında ki bilgilerinizi düzeltin (veritabanı adını "corder" yaparsanız ve projeyi htdocs klasörü içinde iken git ile dahil ederseniz .env dosyasını varsayılan gelen değerler ile bırakabilirsiniz. Tabi veritabanı kullanıcı adınızı ve parolanızı siz biliyorsunuz!)
- Eğer proje dizininde değişiklik var ise manifest dosyaları ve serviceWorker dosyalarında buna uygun url leri belirtin.
- Bu aşamalardan sonra proje çalışıyor olmalı
- PHP sürümünüzün 8 ve üstü olmasını öneririm. Son xampp versiyonunu indirdi iseniz problem yok.


<br>
<br>

- Proje PWA el terminali ve masaüstünde kullanılacak iki parça şeklinde dizayn edildi. http://localhost/corder-restaurant-order-management/terminal-users bu linkten el terminalini kullanırsınız.

- http://localhost/corder-restaurant-order-management/admin/dashboard bu linkten admin paneline ulaşırsınız
- http://localhost/corder-restaurant-order-management/?table=2 QR menü (masadan sipariş alma işlevi mevcut ama pasif. Apisi yazılıp hemen işlevsel duruma gelebilir)
- Terminal kullanıcı adı: a@a.com
- Terminal parola: 12345
- Masa üzerine tıklayınca masa ile ilgili yapabileceğiniz operasyonlar gelir. Bu sayfa da adisyon sayısının belirtildiği kısıma tıklarsanız açık masanın bütün sipariş geçmişi görebilirsiniz.

<br>

- Kısaca hikaye; garson masaya gider el terminalinden sipariş alır, aldığı sipariş admin paneline düşer ve aynı zamanda yazıcıdan sipariş basılır. 

- printer-service dizininde ki ufak app corder apilerine istek atık yeni sipariş olup olmama veya fiş basım emri durumlarına göre yazıcıdan çıktı alınmasını sağlar.
<br>

- Projede çok fazla eksik bulunuyor. Başta ki motivasyonum çeşitli standartlara(PSR gibi), mimarilere uygun, genişletilebilir, modüler, side effect'i minimum seviyede olan bir proje yapmak idi. Ne yazık ki dikkatim çabuk dağılabiliyor ve çabuk sıkılıyorum. O yüzden bir çok noktayı sallamasyon geçebiliyorum.
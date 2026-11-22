# Corder Enterprise POS - Tanıtım ve Sistem Mimarisi Portalı (`corder-web-frontend`)

Corder çok kiracılı (multi-tenant) restoran POS, franchise yönetimi, garson terminali, kasa/vardiya otomasyonu, reçete bazlı stok ve suistimal tespit platformunun tüm özelliklerini, çalışma mantığını ve teknik mimarisini interaktif olarak tanıtan web uygulamasıdır.

## Kapsanan Başlıklar

1. **7 Bileşenli Tam Ekosistem:**
   - **Corder Merchant Panel (`Port 3001`):** Kasa, adisyon, masa planı, reçete stok, cari defter ve X/Z vardiya yönetimi
   - **Corder Garson Terminali (`Port 3000`):** Pessimistic masa kilidi, GPS Geofence, VAPID Web Push ve hızlı saha sipariş PWA uygulaması
   - **Corder Boss (`Port 3004`):** Çoklu şube & franchise royalty konsolidasyonu, 48 granüler RBAC yetki matrisi ve 6 kurallı gerçek zamanlı suistimal (fraud) motoru
   - **Corder QR Dijital Menü (`Port 3002`):** Müşteri menüsü, anlık garson çağrısı ve hesap isteme
   - **Corder Platform Admin (`Port 3003`):** 2 aşamalı kimlik doğrulama, SaaS abonelik/tahsilat otomasyonu ve 360° canlı şube teşhisi
   - **Corder Print-Agent (`Windows/Linux Servis`):** Socket.IO + HTTP Polling çift kanallı, sıfır fiş kayıplı ESC/POS termal yazıcı köprüsü
   - **Corder Core Backend (`Port 4000`):** NestJS 10, TypeORM 0.3, PostgreSQL 16, 35 Entity, 21 Migration ve 10.000+ restoran ölçek testi

2. **Çalışma Mimarisi & Kurumsal POS Garantileri:**
   - **SOD / EOD İş Günü (Business Day) & Açık Masa Duyarlı Otomatik Vardiya Kapanışı**
   - **Kuruş Hassasiyetinde (`Minor Units`) Finansal Motor & Atomik Geriye Dönük Adisyon Mutabakatı**
   - **Eşzamanlılık Koruması (`pessimistic_write`, `pg_advisory_xact_lock`, `In-Flight Coalescing`)**
   - **48 Granüler Yetki Matrisi & Savunma Derinliği (`Defense-in-Depth`)**

## Çalıştırma

```bash
pnpm install
pnpm run dev
```

Varsayılan geliştirme adresi: `http://localhost:3005`


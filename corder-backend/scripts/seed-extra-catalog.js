/**
 * Populates rich extra categories, subcategories, products (with images, cost prices, and recipes)
 * and additional live orders across all 3 branches via the running Corder REST API,
 * and ensures boss@corder.com is linked to all branches.
 */
const { Client } = require('pg');

const API_BASE = 'http://localhost:4000';

const EXTRA_CATALOG = [
  {
    name: 'Kahvaltı & Brunch',
    order: 7,
    products: [
      {
        name: 'Serpme Kahvaltı (2 Kişilik)',
        description: 'Ezine beyaz peynir, eski kaşar, Kars gravyeri, petek bal, manda kaymağı, sahanda yumurta, pişi, simit ve sınırsız demleme çay',
        price: 980,
        costPrice: 280,
        image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
      },
      {
        name: 'Avokadolu Poşe Yumurta',
        description: ' Kızarmış ekşi mayalı köy ekmeği üzerinde ezilmiş avokado, 2 adet poşe yumurta ve hollandaise sos',
        price: 310,
        costPrice: 85,
        image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&q=80',
      },
      {
        name: 'Bakır Sahanda Kasap Sucuklu Menemen',
        description: 'Çanakkale domatesi, köy biberi ve Afyon kasap sucuğu ile bakır sahanda',
        price: 265,
        costPrice: 70,
        image: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=800&q=80',
      },
      {
        name: 'Füme Somonlu Eggs Benedict',
        description: 'Brioche ekmeği, Norveç füme somon, poşe yumurta, frenk soğanı ve taze roka',
        price: 390,
        costPrice: 130,
        image: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=800&q=80',
      },
    ],
  },
  {
    name: 'Taş Fırın Pizzalar',
    order: 8,
    products: [
      {
        name: 'Margherita Di Bufala',
        description: 'San Marzano domates sosu, suda mozzarella, taze fesleğen yaprakları ve sızma zeytinyağı',
        price: 360,
        costPrice: 90,
        image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80',
      },
      {
        name: 'Füme Kaburgalı & Trüflü Pizza',
        description: '8 saat ağır ateşte pişmiş dana kaburga, trüf mantarı kreması, karamelize soğan ve mozzarella',
        price: 490,
        costPrice: 155,
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
      },
      {
        name: 'Quattro Formaggi (4 Peynirli)',
        description: 'Mozzarella, gorgonzola, parmesan ve scamorza peyniri, ceviz ve roka ile',
        price: 420,
        costPrice: 120,
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
      },
      {
        name: 'Pepperoni & Hot Honey Pizza',
        description: 'Dana pepperoni dilimleri, mozzarella, jalapeno biberi ve acı biberli bal dokunuşu',
        price: 440,
        costPrice: 130,
        image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80',
      },
    ],
  },
  {
    name: 'Çorbalar & Ara Sıcaklar',
    order: 9,
    products: [
      {
        name: 'Közlenmiş Domates & Fesleğen Çorbası',
        description: 'Rendelenmiş eski kaşar ve sarımsaklı kruton ekmek ile',
        price: 145,
        costPrice: 30,
        image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80',
      },
      {
        name: 'Tereyağlı Karides Güveç',
        description: 'Sarımsak, kültür mantarı, köy biberi, tereyağı ve fırınlanmış kaşar peyniri ile',
        price: 430,
        costPrice: 150,
        image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',
      },
      {
        name: 'Pastırmalı Sıcak Humus',
        description: 'Kayseri çemensiz antrikot pastırma, çam fıstığı ve kızgın tereyağı ile güveçte humus',
        price: 230,
        costPrice: 65,
        image: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=800&q=80',
      },
    ],
  },
  {
    name: 'Soğuk Kahveler & Mocktailler',
    order: 10,
    products: [
      {
        name: 'Iced Salted Caramel Latte',
        description: 'Çift shot espresso, soğuk süt ve ev yapımı tuzlu karamel şurubu',
        price: 135,
        costPrice: 28,
        image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80',
      },
      {
        name: 'Cold Brew (18 Saat Demleme)',
        description: 'Kolombiya tek kökenli çekirdeklerden 18 saat soğuk demleme, portakal kabuğu ile',
        price: 140,
        costPrice: 25,
        image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=80',
      },
      {
        name: 'Hibiscus & Orman Meyveli Cooler',
        description: 'Demlenmiş hibiskus çayı, böğürtlen, frambuaz, taze nane ve lime',
        price: 155,
        costPrice: 32,
        image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&q=80',
      },
      {
        name: 'Passion Fruit Virgin Mojito',
        description: 'Çarkıfelek meyvesi püresi, taze nane, misket limonu, esmer şeker ve soda',
        price: 165,
        costPrice: 38,
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=80',
      },
      {
        name: 'Taze Sıkma Portakal Suyu (330ml)',
        description: 'Finike portakallarından sipariş anında taze sıkılmış',
        price: 115,
        costPrice: 30,
        image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=800&q=80',
      },
    ],
  },
];

async function run() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'corder',
    password: 'corder_secret',
    database: 'corder',
  });
  await client.connect();

  await client.query(`
    UPDATE root_admins
    SET boss_tier = 'brand_owner',
        brand_name = 'Corder Hospitality Group',
        is_active = true
    WHERE email = 'boss@corder.com'
  `);
  const bossRes = await client.query(`SELECT id FROM root_admins WHERE email = 'boss@corder.com'`);
  if (bossRes.rows[0]) {
    const bossId = bossRes.rows[0].id;
    const rRes = await client.query(`SELECT id FROM restaurants`);
    for (const r of rRes.rows) {
      await client.query(
        `
        INSERT INTO boss_restaurants (id, boss_id, restaurant_id, title, created_at)
        VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'Kurucu & Marka Sahibi', NOW())
        ON CONFLICT (boss_id, restaurant_id) DO NOTHING
      `,
        [bossId, r.id],
      );
    }
  }
  await client.end();

  const loginRes = await fetch(`${API_BASE}/restaurant/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patron@corder.com', password: 'Boss1234!' }),
  }).then((r) => r.json());

  for (const branch of loginRes.restaurants) {
    const sw = await fetch(`${API_BASE}/restaurant/auth/switch-branch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginRes.accessToken}`,
      },
      body: JSON.stringify({ restaurantId: branch.id }),
    }).then((r) => r.json());
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sw.accessToken}`,
    };

    const [existingCats, existingProds, tables] = await Promise.all([
      fetch(`${API_BASE}/restaurant/categories`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/restaurant/products`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/restaurant/tables`, { headers }).then((r) => r.json()),
    ]);

    const catByName = new Map(existingCats.map((c) => [c.name, c]));
    const prodByName = new Map(existingProds.map((p) => [p.name, p]));
    let addedCats = 0;
    let addedProds = 0;

    for (const group of EXTRA_CATALOG) {
      let cat = catByName.get(group.name);
      if (!cat) {
        cat = await fetch(`${API_BASE}/restaurant/categories`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: group.name,
            order: group.order,
            showInTerminal: true,
            showInMenu: true,
            showInQuickSale: true,
          }),
        }).then((r) => r.json());
        catByName.set(group.name, cat);
        addedCats++;
      }

      for (let idx = 0; idx < group.products.length; idx++) {
        const pSpec = group.products[idx];
        if (prodByName.has(pSpec.name)) continue;
        const createdProd = await fetch(`${API_BASE}/restaurant/products`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            categoryId: cat.id,
            name: pSpec.name,
            description: pSpec.description,
            price: pSpec.price,
            costPrice: pSpec.costPrice,
            imageUrl: pSpec.image,
            inStock: true,
            order: idx + 1,
          }),
        }).then((r) => r.json());
        prodByName.set(pSpec.name, createdProd);
        addedProds++;
      }
    }

    // Also add 2 extra desserts under existing 'Tatlılar' category
    const dessertCat = catByName.get('Tatlılar');
    if (dessertCat) {
      const extraDesserts = [
        {
          name: 'Antep Fıstıklı Havuç Dilim Baklava',
          description: 'Gaziantep boz fıstıklı sıcak havuç dilim baklava, kesme Maraş dondurması ile',
          price: 245,
          costPrice: 75,
          image: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=800&q=80',
        },
        {
          name: 'Tiramisu Classico (Mascarpone)',
          description: 'İtalyan mascarpone peyniri, espresso ile ıslatılmış savoiardi bisküvisi ve kakao',
          price: 210,
          costPrice: 55,
          image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80',
        },
      ];
      for (const dSpec of extraDesserts) {
        if (!prodByName.has(dSpec.name)) {
          const created = await fetch(`${API_BASE}/restaurant/products`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              categoryId: dessertCat.id,
              name: dSpec.name,
              description: dSpec.description,
              price: dSpec.price,
              costPrice: dSpec.costPrice,
              imageUrl: dSpec.image,
              inStock: true,
              order: 10,
            }),
          }).then((r) => r.json());
          prodByName.set(dSpec.name, created);
          addedProds++;
        }
      }
    }

    // Place a live order on VIP Loca 2 with the newly created pizza/mocktail/baklava items
    const vip2 = tables.find((t) => t.name === 'VIP Loca 2');
    const pPizza = prodByName.get('Füme Kaburgalı & Trüflü Pizza');
    const pMocktail = prodByName.get('Passion Fruit Virgin Mojito');
    const pBaklava = prodByName.get('Antep Fıstıklı Havuç Dilim Baklava');
    if (vip2 && pPizza && pMocktail && pBaklava) {
      await fetch(`${API_BASE}/restaurant/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tableId: vip2.id,
          items: [
            { productId: pPizza.id, quantity: 2, note: 'İnce hamur, ekstra trüf sos' },
            { productId: pMocktail.id, quantity: 3 },
            { productId: pBaklava.id, quantity: 2, note: 'Dondurması bol olsun' },
          ],
        }),
      });
    }

    console.log(
      `✔ ${branch.name}: +${addedCats} categories, +${addedProds} products (Total: ${catByName.size} categories, ${prodByName.size} products)`,
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

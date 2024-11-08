<?php

declare(strict_types=1);

function compartOrderControlApi($url): array
{
    $apiKey = 'api_key';
    $data = [
        'api_key'     => $apiKey,
    ];

    return post($url, $data);
}

//sideEffect!!!
function post(string $url, array $data): array
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded; charset=utf-8',
        'Accept-Charset: utf-8'
    ]);

    $response = curl_exec($ch);
    curl_close($ch);

    return $response = json_decode($response, true);
}


function kelimeleriFormatla(string $metin, int $satirUzunlugu = 16, string $boslukKarakteri = ' '): string
{
    $satirlar = [];

    // İlk 16 karakteri al
    $ilkSatir = mb_substr($metin, 0, $satirUzunlugu);
    $satirlar[] = $ilkSatir;

    // Geri kalan metni işle
    $geriKalanMetin = mb_substr($metin, $satirUzunlugu);

    // Metindeki her karakter için işlem yap
    for ($i = 0; $i < mb_strlen($geriKalanMetin); $i++) {
        // Eğer mevcut satır uzunluğuna ulaşıldıysa
        if (($i % $satirUzunlugu) === 0) {
            // 21 karakter boşluk ekle ve satıra ekle
            $satirlar[] = str_repeat($boslukKarakteri, 21);
        }

        // Karakteri ekle
        $satirlar[count($satirlar) - 1] .= $geriKalanMetin[$i];
    }
    // Son satıra bir alt satıra geçiş karakteri ekle
    $satirlar[count($satirlar) - 1] .= "\n";

    // Satırları birleştirerek döndür
    return implode(PHP_EOL, $satirlar);
}


function editFileToPrint(array $data): void
{
    if (isset($data['status_code'])) {
        if ($data['status_code'] == 'no_order') {
            die('no_order');
        }
    }

    $i = 0;
    foreach ($data as  $value) {
        $fileName = "compart-order-$i.txt";
        $unixTimestamp = strtotime($value['order_time']);
        $order_note = "NOT: " . $value['order_note'] . "\n\n";
        $receiptContent = "Tarih/Saat:  " . date('d-m-Y H:i:s', $unixTimestamp) . "\n" .
            "Sipariş No:  " . $value['id'] . "\n" .
            "Masa      :  " . $value['table_area'] . " - " . $value['table_number'] . "\n" .
            "Garson    :  " .($value['custom'] == 'y' ? 'Yazıcı Servisi' : $value['waiter_name']) . "\n\n\n" .
            "SİPARİŞ\n\n" .
            $order_note  .
            "_____________________________________\n" .
            "Miktar  Birim Fiyat  Ürün\n" .
            "‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\n";

        $order =  json_decode($value['order_content'], true);
        $totalPrice = 0;
        foreach ($order as $value) {
            $receiptContent .= "  " . $value['amount']  . "      ₺" . $value['product_price'] . ".00     " . kelimeleriFormatla($value['product_name']) . "\n";
            $totalPrice += $value['amount'] * $value['product_price'];
        }

        //$receiptContent .= $order_note;
        $receiptContent .=
            "_____________________________________\n" .
            "Toplam:  ₺$totalPrice.00\n" .
            "‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\n\n" .
            "            Özgür'ün Yeri";

        $file = fopen($fileName, 'w') or die("Unable to create file!");
        fwrite($file, $receiptContent);
        fclose($file);
        $i++;
    }

    printerExecute(count($data));
}

function printerExecute(int $count): void
{
    $apiKey = 'api_key';
    $data = [
        'api_key'     => $apiKey,
    ];
    $response = post('http://localhost/corder-restaurant-order-management/order-service/printer-status-update', $data);

    if ($response['status_code'] == 'success') {
        for ($i = 0; $i < $count; $i++) {
            $command = 'powershell.exe -Command "Start-Process \'C:\compartPrinter\compart-order-' . $i . '.txt\' -WindowStyle Hidden –Verb Print"';
            exec($command);
        }
        die('success');
    } else {
        die('xxxx');
    }
}


editFileToPrint(compartOrderControlApi('http://localhost/corder-restaurant-order-management/order-service/last-order'));
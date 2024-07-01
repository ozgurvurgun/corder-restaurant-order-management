-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Anamakine: localhost:3306
-- Üretim Zamanı: 02 Tem 2024, 00:58:18
-- Sunucu sürümü: 10.11.8-MariaDB
-- PHP Sürümü: 8.1.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Veritabanı: `fik2acinyericom_db`
--

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `categories`
--

CREATE TABLE `categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(700) NOT NULL,
  `image_path` varchar(1000) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Tablo döküm verisi `categories`
--

INSERT INTO `categories` (`id`, `name`, `image_path`, `status`) VALUES
(13, 'kahvaltı turkish breakfast', 'public/images/categories/kahvaltı turkish breakfast.png', 1),
(15, 'aperatifler', 'public/images/categories/aperatifler.png', 1),
(16, 'izgaralar', 'public/images/categories/izgaralar.png', 1),
(17, 'alkollüler', 'public/images/categories/alkollüler.png', 1),
(18, 'sıcak i̇çecekler', 'public/images/categories/sıcak i̇çecekler.png', 1),
(19, 'soğuk i̇çecekler', 'public/images/categories/soğuk i̇çecekler.png', 1),
(20, 'vi̇ski̇ setler', 'public/images/categories/viski.png', 1),
(21, 'vodka setler', 'public/images/categories/vodka setler.png', 1),
(22, 'kampanya efes malt patates', 'public/images/categories/kampanyaaaaa.png', 1),
(23, 'market', 'public/images/categories/market.png', 1),
(24, 'buz kovasi', 'public/images/categories/buz kovasi.png', 1),
(25, 'şezlong şemsi̇ye', 'public/images/categories/şezlong şemsi̇ye.png', 1),
(26, 'tatlilar', 'public/images/categories/tatlilar.png', 1),
(27, 'dondurma', 'public/images/categories/dondurma.png', 1),
(28, 'şezlog şemsi̇ye 500', 'public/images/categories/şezlog şemsi̇ye 500.png', 1);

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `orders`
--

CREATE TABLE `orders` (
  `id` int(10) UNSIGNED NOT NULL,
  `table_area` varchar(10) NOT NULL,
  `table_number` varchar(40) NOT NULL,
  `order_content` varchar(2500) NOT NULL,
  `order_total` mediumint(9) NOT NULL,
  `waiter_name` varchar(2500) NOT NULL,
  `order_note` varchar(1500) NOT NULL,
  `order_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_table_open` tinyint(1) NOT NULL,
  `is_printed` tinyint(1) NOT NULL DEFAULT 0,
  `custom` varchar(50) NOT NULL DEFAULT 'x'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Tablo döküm verisi `orders`
--

INSERT INTO `orders` (`id`, `table_area`, `table_number`, `order_content`, `order_total`, `waiter_name`, `order_note`, `order_time`, `is_table_open`, `is_printed`, `custom`) VALUES
(1355, 'Sahil', '20', '[{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":2}]', 275, 'ibrahim ', '', '2024-06-30 12:16:59', 1, 1, 'x'),
(1375, 'Sahil', '20', '[{\"id\":\"92\",\"product_name\":\"köfte ekmek arası\",\"product_price\":\"200\",\"amount\":5},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', 1095, 'serkan ', '', '2024-06-30 13:25:17', 1, 1, 'x'),
(1427, 'Sahil', '20', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', 20, 'serkan ', '', '2024-07-01 12:18:46', 1, 1, 'x');

--
-- Tetikleyiciler `orders`
--
DELIMITER $$
CREATE TRIGGER `DeleteOrder` AFTER DELETE ON `orders` FOR EACH ROW INSERT INTO orders_log(old_id, table_area, table_number, order_content, order_total, waiter_name, table_opening_time) VALUES(OLD.id, OLD.table_area, OLD.table_number, OLD.order_content, OLD.order_total, OLD.waiter_name, OLD.order_time)
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `orders_log`
--

CREATE TABLE `orders_log` (
  `id` int(10) UNSIGNED NOT NULL,
  `old_id` int(10) UNSIGNED NOT NULL,
  `table_area` varchar(10) NOT NULL,
  `table_number` varchar(40) NOT NULL,
  `order_content` varchar(2500) NOT NULL,
  `order_total` varchar(40) NOT NULL,
  `waiter_name` varchar(500) NOT NULL,
  `table_opening_time` timestamp NOT NULL,
  `order_closing_time` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Tablo döküm verisi `orders_log`
--

INSERT INTO `orders_log` (`id`, `old_id`, `table_area`, `table_number`, `order_content`, `order_total`, `waiter_name`, `table_opening_time`, `order_closing_time`) VALUES
(610, 744, 'Paket', '0', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":4}]', '960', 'selma ', '2024-06-19 06:02:16', '2024-06-19 06:31:02'),
(611, 759, 'Bahçe', '5', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":4},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '1180', 'selma ', '2024-06-19 09:28:40', '2024-06-19 10:04:04'),
(617, 766, 'Bahçe', '3', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2}]', '520', 'selma ', '2024-06-19 10:16:00', '2024-06-19 10:46:13'),
(618, 753, 'Bahçe', '4', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-19 08:33:32', '2024-06-19 10:51:58'),
(619, 770, 'Bahçe', '4', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"61\",\"product_name\":\"kutu meyve suyu karışık\",\"product_price\":\"60\",\"amount\":1}]', '380', 'selma ', '2024-06-19 10:28:58', '2024-06-19 10:51:58'),
(620, 782, 'Bahçe', '4', '[{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1}]', '60', 'selma ', '2024-06-19 10:46:30', '2024-06-19 10:51:58'),
(621, 769, 'Sahil', '31', '[{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":1}]', '175', 'ibrahim ', '2024-06-19 10:25:19', '2024-06-19 10:53:36'),
(622, 779, 'Sahil', '31', '[{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":1}]', '30', 'ibrahim ', '2024-06-19 10:40:21', '2024-06-19 10:53:36'),
(623, 783, 'Paket', '0', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '210', 'selma ', '2024-06-19 10:49:02', '2024-06-19 10:54:29'),
(624, 760, 'Bahçe', '7', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":3}]', '60', 'selma ', '2024-06-19 09:54:39', '2024-06-19 10:58:11'),
(625, 761, 'Bahçe', '7', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3}]', '60', 'selma ', '2024-06-19 09:56:00', '2024-06-19 10:58:11'),
(626, 764, 'Bahçe', '7', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'selma ', '2024-06-19 10:09:56', '2024-06-19 10:58:11'),
(627, 768, 'Bahçe', '7', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'selma ', '2024-06-19 10:19:41', '2024-06-19 10:58:11'),
(628, 788, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2}]', '300', 'serkan ', '2024-06-19 11:05:24', '2024-06-19 11:10:10'),
(630, 796, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '215', 'serkan ', '2024-06-19 11:14:21', '2024-06-19 11:26:02'),
(632, 800, 'Paket', '0', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '300', 'serkan ', '2024-06-19 11:27:38', '2024-06-19 11:34:52'),
(633, 801, 'Bahçe', '4', '[{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"100\",\"amount\":3}]', '300', 'selma ', '2024-06-19 11:29:02', '2024-06-19 11:40:02'),
(634, 805, 'Paket', '0', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":2}]', '450', 'serkan ', '2024-06-19 11:41:03', '2024-06-19 11:43:13'),
(635, 765, 'Sahil', '1', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":3},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":4},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":3},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3}]', '1325', 'serkan ', '2024-06-19 10:13:41', '2024-06-19 11:43:31'),
(636, 771, 'Sahil', '1', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2}]', '520', 'mehmet ', '2024-06-19 10:31:06', '2024-06-19 11:43:31'),
(637, 781, 'Sahil', '1', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":3}]', '180', 'serkan ', '2024-06-19 10:45:30', '2024-06-19 11:43:31'),
(638, 789, 'Bahçe', '2', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'selma ', '2024-06-19 11:06:53', '2024-06-19 12:04:28'),
(639, 791, 'Bahçe', '2', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":5},{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"76\",\"product_name\":\"li̇pton kutu karpuz\",\"product_price\":\"60\",\"amount\":2}]', '1730', 'selma ', '2024-06-19 11:09:36', '2024-06-19 12:04:28'),
(640, 792, 'Bahçe', '2', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'selma ', '2024-06-19 11:10:04', '2024-06-19 12:04:28'),
(641, 794, 'Bahçe', '2', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-19 11:11:01', '2024-06-19 12:04:28'),
(642, 797, 'Bahçe', '2', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-19 11:15:26', '2024-06-19 12:04:28'),
(643, 807, 'Bahçe', '2', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '120', 'selma ', '2024-06-19 11:48:53', '2024-06-19 12:04:28'),
(644, 793, 'Bahçe', '8', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '625', 'serkan ', '2024-06-19 11:10:49', '2024-06-19 12:10:23'),
(645, 812, 'Bahçe', '4', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":4}]', '240', 'selma ', '2024-06-19 12:11:16', '2024-06-19 12:31:30'),
(646, 813, 'Bahçe', '4', '[{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-19 12:11:43', '2024-06-19 12:31:30'),
(647, 819, 'Sahil', '4', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":3}]', '870', 'ibrahim ', '2024-06-19 12:25:20', '2024-06-19 12:32:24'),
(648, 802, 'Sahil', '28', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":4}]', '240', 'serkan ', '2024-06-19 11:32:22', '2024-06-19 12:37:20'),
(649, 820, 'Paket', '0', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '390', 'serkan ', '2024-06-19 12:26:36', '2024-06-19 12:59:32'),
(650, 756, 'Sahil', '15', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1},{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1}]', '465', 'selma ', '2024-06-19 09:03:24', '2024-06-19 13:08:09'),
(651, 784, 'Sahil', '27', '[{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '280', 'ibrahim ', '2024-06-19 10:49:11', '2024-06-19 13:11:41'),
(652, 786, 'Sahil', '27', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '60', 'ibrahim ', '2024-06-19 11:01:22', '2024-06-19 13:11:41'),
(653, 806, 'Sahil', '27', '[{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-19 11:45:33', '2024-06-19 13:11:41'),
(654, 823, 'Bahçe', '4', '[{\"id\":\"135\",\"product_name\":\"manti\",\"product_price\":\"250\",\"amount\":1}]', '250', 'serkan ', '2024-06-19 12:44:17', '2024-06-19 13:26:16'),
(655, 828, 'Bahçe', '4', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '120', 'serkan ', '2024-06-19 13:15:20', '2024-06-19 13:26:16'),
(656, 825, 'Paket', '0', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":4},{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '275', 'serkan ', '2024-06-19 13:00:09', '2024-06-19 13:28:21'),
(658, 790, 'Sahil', '6', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1}]', '510', 'ibrahim ', '2024-06-19 11:08:51', '2024-06-19 13:43:11'),
(659, 811, 'Sahil', '6', '[{\"id\":\"85\",\"product_name\":\"carslberg\",\"product_price\":\"135\",\"amount\":1}]', '135', 'ibrahim ', '2024-06-19 12:03:23', '2024-06-19 13:43:11'),
(660, 839, 'Paket', '0', '[{\"id\":\"125\",\"product_name\":\"cool lime\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-19 14:06:40', '2024-06-19 14:06:58'),
(661, 840, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":3}]', '450', 'serkan ', '2024-06-19 14:07:13', '2024-06-19 14:08:58'),
(662, 821, 'Sahil', '4', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '600', 'serkan ', '2024-06-19 12:33:12', '2024-06-19 14:15:57'),
(663, 749, 'Sahil', '19', '[{\"id\":\"115\",\"product_name\":\"ci̇tos\",\"product_price\":\"50\",\"amount\":1}]', '50', 'serkan ', '2024-06-19 08:18:29', '2024-06-19 14:21:24'),
(664, 754, 'Sahil', '19', '[{\"id\":\"115\",\"product_name\":\"ci̇tos\",\"product_price\":\"50\",\"amount\":1}]', '50', 'serkan ', '2024-06-19 08:54:43', '2024-06-19 14:21:24'),
(665, 755, 'Sahil', '19', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1}]', '225', 'serkan ', '2024-06-19 09:02:15', '2024-06-19 14:21:24'),
(666, 772, 'Sahil', '19', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1},{\"id\":\"74\",\"product_name\":\"li̇pton  kutu li̇mon\",\"product_price\":\"60\",\"amount\":1}]', '560', 'serkan ', '2024-06-19 10:33:24', '2024-06-19 14:21:24'),
(667, 822, 'Sahil', '19', '[{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":1}]', '30', 'ibrahim ', '2024-06-19 12:34:34', '2024-06-19 14:21:24'),
(668, 834, 'Sahil', '19', '[{\"id\":\"72\",\"product_name\":\"miller 330cl\",\"product_price\":\"110\",\"amount\":1},{\"id\":\"111\",\"product_name\":\"beck\'s\",\"product_price\":\"125\",\"amount\":2},{\"id\":\"115\",\"product_name\":\"ci̇tos\",\"product_price\":\"50\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '430', 'serkan ', '2024-06-19 13:41:51', '2024-06-19 14:21:24'),
(669, 844, 'Paket', '0', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2}]', '200', 'selma ', '2024-06-19 14:37:18', '2024-06-19 14:39:02'),
(670, 798, 'Sahil', '16', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'ibrahim ', '2024-06-19 11:20:04', '2024-06-19 14:41:24'),
(671, 808, 'Sahil', '16', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"59\",\"product_name\":\"kutu meyve suyu şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '80', 'ibrahim ', '2024-06-19 11:51:04', '2024-06-19 14:41:24'),
(672, 816, 'Sahil', '16', '[{\"id\":\"135\",\"product_name\":\"manti\",\"product_price\":\"250\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"59\",\"product_name\":\"kutu meyve suyu şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '590', 'ibrahim ', '2024-06-19 12:17:13', '2024-06-19 14:41:24'),
(673, 831, 'Sahil', '16', '[{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":2}]', '150', 'serkan ', '2024-06-19 13:30:47', '2024-06-19 14:41:24'),
(674, 746, 'Sahil', '23', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'ibrahim ', '2024-06-19 07:06:00', '2024-06-19 14:53:29'),
(675, 752, 'Sahil', '23', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'ibrahim ', '2024-06-19 08:30:43', '2024-06-19 14:53:29'),
(676, 837, 'Bahçe', '3', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'selma ', '2024-06-19 14:01:28', '2024-06-19 15:01:02'),
(677, 842, 'Bahçe', '3', '[{\"id\":\"125\",\"product_name\":\"cool lime\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-19 14:26:27', '2024-06-19 15:01:02'),
(678, 849, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":4}]', '600', 'serkan ', '2024-06-19 15:20:14', '2024-06-19 15:21:00'),
(679, 745, 'Sahil', '18', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2}]', '120', 'ibrahim ', '2024-06-19 06:58:14', '2024-06-19 15:26:12'),
(680, 748, 'Sahil', '18', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-19 08:09:02', '2024-06-19 15:26:12'),
(681, 827, 'Sahil', '28', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":4}]', '140', 'serkan ', '2024-06-19 13:13:15', '2024-06-19 15:42:32'),
(682, 843, 'Sahil', '28', '[{\"id\":\"111\",\"product_name\":\"beck\'s\",\"product_price\":\"125\",\"amount\":2},{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"93\",\"product_name\":\"churchill\",\"product_price\":\"80\",\"amount\":1}]', '460', 'serkan ', '2024-06-19 14:36:46', '2024-06-19 15:42:32'),
(683, 845, 'Sahil', '28', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'ibrahim ', '2024-06-19 14:40:10', '2024-06-19 15:42:32'),
(684, 856, 'Paket', '0', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-19 15:51:34', '2024-06-19 15:56:11'),
(685, 857, 'Paket', '0', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":3}]', '180', 'serkan ', '2024-06-19 15:56:37', '2024-06-19 16:02:13'),
(686, 751, 'Sahil', '11', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":2}]', '450', 'ibrahim ', '2024-06-19 08:29:05', '2024-06-19 16:07:04'),
(687, 817, 'Sahil', '11', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-19 12:23:10', '2024-06-19 16:07:04'),
(688, 818, 'Sahil', '11', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'serkan ', '2024-06-19 12:24:55', '2024-06-19 16:07:04'),
(689, 835, 'Sahil', '11', '[{\"id\":\"30\",\"product_name\":\"sahanda yumurta\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":1}]', '175', 'serkan ', '2024-06-19 13:51:43', '2024-06-19 16:07:04'),
(690, 850, 'Bahçe', '4', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":3}]', '450', 'serkan ', '2024-06-19 15:22:31', '2024-06-19 16:08:48'),
(691, 851, 'Bahçe', '4', '[{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-19 15:36:31', '2024-06-19 16:08:48'),
(692, 858, 'Bahçe', '4', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '120', 'serkan ', '2024-06-19 16:08:09', '2024-06-19 16:08:48'),
(693, 747, 'Sahil', '8', '[{\"id\":\"71\",\"product_name\":\"miller 500cl\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-19 08:06:39', '2024-06-19 16:10:42'),
(694, 750, 'Sahil', '8', '[{\"id\":\"98\",\"product_name\":\"chi̇vas 70cl(redbull, kola, çikolata, meyve tabağı ve çerez ikramı ile)\",\"product_price\":\"4500\",\"amount\":1}]', '4500', 'serkan ', '2024-06-19 08:18:54', '2024-06-19 16:10:42'),
(695, 758, 'Sahil', '8', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"87\",\"product_name\":\"redbull küçük\",\"product_price\":\"75\",\"amount\":2}]', '305', 'serkan ', '2024-06-19 09:15:32', '2024-06-19 16:10:42'),
(696, 763, 'Sahil', '8', '[{\"id\":\"43\",\"product_name\":\"meyve tabağı(i̇ki kişilik)double\",\"product_price\":\"250\",\"amount\":1},{\"id\":\"44\",\"product_name\":\"karışık çerez\",\"product_price\":\"125\",\"amount\":1},{\"id\":\"133\",\"product_name\":\"ülker çi̇kolatali\",\"product_price\":\"60\",\"amount\":1}]', '435', 'serkan ', '2024-06-19 10:07:01', '2024-06-19 16:10:42'),
(697, 810, 'Sahil', '8', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":4},{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":4}]', '1450', 'serkan ', '2024-06-19 12:00:09', '2024-06-19 16:10:42'),
(698, 815, 'Sahil', '8', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '600', 'serkan ', '2024-06-19 12:16:58', '2024-06-19 16:10:42'),
(699, 833, 'Sahil', '8', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'ibrahim ', '2024-06-19 13:36:50', '2024-06-19 16:10:42'),
(700, 846, 'Sahil', '8', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'serkan ', '2024-06-19 14:44:47', '2024-06-19 16:10:42'),
(701, 859, 'Sahil', '8', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":7}]', '140', 'serkan ', '2024-06-19 16:09:35', '2024-06-19 16:10:42'),
(702, 852, 'Bahçe', '2', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '180', 'serkan ', '2024-06-19 15:43:05', '2024-06-19 16:18:23'),
(703, 803, 'Sahil', '35', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":2}]', '70', 'serkan ', '2024-06-19 11:33:23', '2024-06-19 16:32:00'),
(704, 809, 'Sahil', '35', '[{\"id\":\"89\",\"product_name\":\"soğuk nescafe orjinal\",\"product_price\":\"75\",\"amount\":1}]', '75', 'serkan ', '2024-06-19 11:52:19', '2024-06-19 16:32:00'),
(705, 836, 'Sahil', '35', '[{\"id\":\"115\",\"product_name\":\"ci̇tos\",\"product_price\":\"50\",\"amount\":2}]', '100', 'serkan ', '2024-06-19 13:52:58', '2024-06-19 16:32:00'),
(706, 832, 'Sahil', '1', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'ibrahim ', '2024-06-19 13:36:26', '2024-06-19 16:40:35'),
(707, 830, 'Sahil', '14', '[{\"id\":\"67\",\"product_name\":\"belfast\",\"product_price\":\"100\",\"amount\":3},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3},{\"id\":\"115\",\"product_name\":\"ci̇tos\",\"product_price\":\"50\",\"amount\":2}]', '460', 'serkan ', '2024-06-19 13:30:24', '2024-06-19 16:45:22'),
(708, 863, 'Sahil', '14', '[{\"id\":\"44\",\"product_name\":\"karışık çerez\",\"product_price\":\"125\",\"amount\":1}]', '125', 'serkan ', '2024-06-19 16:20:59', '2024-06-19 16:45:22'),
(709, 860, 'Bahçe', '5', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":5},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1}]', '810', 'selma ', '2024-06-19 16:13:55', '2024-06-19 17:13:37'),
(710, 871, 'Bahçe', '5', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'selma ', '2024-06-19 17:02:28', '2024-06-19 17:13:37'),
(711, 876, 'Bahçe', '3', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":3}]', '450', 'serkan ', '2024-06-19 17:11:26', '2024-06-19 17:16:24'),
(712, 877, 'Bahçe', '3', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-19 17:11:50', '2024-06-19 17:16:24'),
(713, 824, 'Bahçe', '1', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":4},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '810', 'selma ', '2024-06-19 12:45:07', '2024-06-19 17:24:08'),
(714, 853, 'Sahil', '23', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '385', 'serkan ', '2024-06-19 15:44:39', '2024-06-19 17:30:24'),
(715, 872, 'Bahçe', '4', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-19 17:05:30', '2024-06-19 17:52:35'),
(716, 873, 'Bahçe', '4', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '190', 'serkan ', '2024-06-19 17:08:02', '2024-06-19 17:52:35'),
(717, 847, 'Bahçe', '8', '[{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '130', 'selma ', '2024-06-19 14:49:09', '2024-06-19 18:39:08'),
(718, 861, 'Bahçe', '8', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-19 16:16:02', '2024-06-19 18:39:08'),
(719, 862, 'Bahçe', '8', '[{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-19 16:18:48', '2024-06-19 18:39:08'),
(720, 865, 'Bahçe', '8', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":4},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1}]', '975', 'serkan ', '2024-06-19 16:23:56', '2024-06-19 18:39:08'),
(721, 866, 'Bahçe', '8', '[{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":3},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":2}]', '710', 'serkan ', '2024-06-19 16:27:34', '2024-06-19 18:39:08'),
(722, 867, 'Bahçe', '8', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-19 16:29:51', '2024-06-19 18:39:08'),
(723, 869, 'Bahçe', '8', '[{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1},{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '285', 'selma ', '2024-06-19 16:46:10', '2024-06-19 18:39:08'),
(724, 870, 'Bahçe', '8', '[{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '130', 'selma ', '2024-06-19 16:50:18', '2024-06-19 18:39:08'),
(725, 773, 'Sahil', '2', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-19 10:34:08', '2024-06-19 19:24:16'),
(726, 785, 'Sahil', '2', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"100\",\"amount\":5}]', '800', 'ibrahim ', '2024-06-19 10:57:45', '2024-06-19 19:24:16'),
(727, 787, 'Sahil', '17', '[{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":3}]', '225', 'ibrahim ', '2024-06-19 11:04:32', '2024-06-19 19:24:31'),
(728, 804, 'Sahil', '17', '[{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":2},{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":1}]', '80', 'serkan ', '2024-06-19 11:39:00', '2024-06-19 19:24:31'),
(729, 814, 'Sahil', '17', '[{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '220', 'ibrahim ', '2024-06-19 12:14:44', '2024-06-19 19:24:31'),
(730, 826, 'Sahil', '17', '[{\"id\":\"85\",\"product_name\":\"carslberg\",\"product_price\":\"135\",\"amount\":2}]', '270', 'ibrahim ', '2024-06-19 13:02:34', '2024-06-19 19:24:31'),
(731, 838, 'Sahil', '17', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":2}]', '260', 'serkan ', '2024-06-19 14:05:57', '2024-06-19 19:24:31'),
(732, 841, 'Sahil', '17', '[{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-19 14:12:35', '2024-06-19 19:24:31'),
(733, 854, 'Sahil', '17', '[{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1}]', '25', 'serkan ', '2024-06-19 15:50:49', '2024-06-19 19:24:31'),
(734, 855, 'Sahil', '17', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-19 15:51:20', '2024-06-19 19:24:31'),
(735, 864, 'Sahil', '17', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'serkan ', '2024-06-19 16:22:04', '2024-06-19 19:24:31'),
(736, 875, 'Sahil', '17', '[{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":5}]', '375', 'selma ', '2024-06-19 17:11:24', '2024-06-19 19:24:31'),
(737, 878, 'Sahil', '17', '[{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":1}]', '300', 'serkan ', '2024-06-19 17:22:26', '2024-06-19 19:24:31'),
(738, 879, 'Sahil', '17', '[{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":2},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":2}]', '1050', 'serkan ', '2024-06-19 17:25:53', '2024-06-19 19:24:31'),
(739, 880, 'Sahil', '17', '[{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-19 17:49:29', '2024-06-19 19:24:31'),
(740, 881, 'Sahil', '17', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1}]', '225', 'serkan ', '2024-06-19 17:58:59', '2024-06-19 19:24:31'),
(741, 868, 'Bahçe', '2', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":2}]', '120', 'serkan ', '2024-06-19 16:31:12', '2024-06-20 07:47:55'),
(742, 874, 'Bahçe', '2', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-19 17:10:26', '2024-06-20 07:47:55'),
(743, 882, 'Bahçe', '3', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '210', 'serkan ', '2024-06-19 19:15:52', '2024-06-20 07:49:44'),
(744, 884, 'Sahil', '4', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-20 07:38:39', '2024-06-20 07:49:54'),
(745, 883, 'Sahil', '8', '[{\"id\":\"64\",\"product_name\":\"efes malt kutu\",\"product_price\":\"100\",\"amount\":3}]', '300', 'serkan ', '2024-06-20 07:30:31', '2024-06-20 07:50:03'),
(746, 848, 'Sahil', '20', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":3}]', '490', 'serkan ', '2024-06-19 14:58:47', '2024-06-20 07:50:44'),
(747, 767, 'Sahil', '45', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3}]', '60', 'mehmet ', '2024-06-19 10:17:20', '2024-06-20 07:50:52'),
(748, 780, 'Sahil', '45', '[{\"id\":\"64\",\"product_name\":\"efes malt kutu\",\"product_price\":\"100\",\"amount\":2},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '240', 'serkan ', '2024-06-19 10:43:27', '2024-06-20 07:50:52'),
(749, 757, 'Sahil', '50', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '280', 'serkan ', '2024-06-19 09:14:59', '2024-06-20 07:51:00'),
(750, 762, 'Sahil', '50', '[{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-19 10:05:50', '2024-06-20 07:51:00'),
(751, 885, 'Bahçe', '4', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-20 07:39:25', '2024-06-20 07:59:27'),
(752, 889, 'Bahçe', '6', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '400', 'selma ', '2024-06-20 08:54:09', '2024-06-20 09:31:11'),
(754, 892, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-20 09:41:03', '2024-06-20 09:55:43'),
(755, 896, 'Sahil', '7', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":2},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '835', 'selma ', '2024-06-20 09:54:41', '2024-06-20 10:56:44'),
(756, 909, 'Sahil', '7', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-20 10:55:04', '2024-06-20 10:56:44'),
(757, 910, 'Sahil', '3', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-20 10:55:59', '2024-06-20 10:57:16'),
(758, 902, 'Bahçe', '7', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":3}]', '525', 'selma ', '2024-06-20 10:35:21', '2024-06-20 11:16:39'),
(759, 904, 'Bahçe', '7', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'selma ', '2024-06-20 10:36:51', '2024-06-20 11:16:39'),
(760, 905, 'Bahçe', '7', '[{\"id\":\"65\",\"product_name\":\"efes extra\",\"product_price\":\"130\",\"amount\":1}]', '130', 'selma ', '2024-06-20 10:37:16', '2024-06-20 11:16:39'),
(761, 908, 'Bahçe', '7', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '310', 'selma ', '2024-06-20 10:44:01', '2024-06-20 11:16:39'),
(762, 912, 'Bahçe', '5', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":5}]', '300', 'selma ', '2024-06-20 11:01:14', '2024-06-20 11:30:19'),
(764, 915, 'Bahçe', '6', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"45\",\"product_name\":\"nugget 6 adet\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '645', 'selma ', '2024-06-20 11:14:04', '2024-06-20 12:07:18'),
(765, 926, 'Bahçe', '6', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '40', 'selma ', '2024-06-20 12:01:00', '2024-06-20 12:07:18'),
(766, 928, 'Bahçe', '5', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '375', 'serkan ', '2024-06-20 12:14:20', '2024-06-20 12:27:39'),
(767, 893, 'Sahil', '27', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg şişe\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '340', 'ibrahim ', '2024-06-20 09:45:42', '2024-06-20 13:22:47'),
(768, 900, 'Sahil', '27', '[{\"id\":\"57\",\"product_name\":\"kutu fanta\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '190', 'ibrahim ', '2024-06-20 10:27:34', '2024-06-20 13:22:47'),
(769, 922, 'Sahil', '27', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"31\",\"product_name\":\"sucuklu yumurta\",\"product_price\":\"150\",\"amount\":1}]', '250', 'serkan ', '2024-06-20 11:33:55', '2024-06-20 13:22:47'),
(770, 939, 'Sahil', '27', '[{\"id\":\"33\",\"product_name\":\"kaşarlı omlet\",\"product_price\":\"125\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '145', 'mehmet ', '2024-06-20 12:44:09', '2024-06-20 13:22:47'),
(771, 945, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'mehmet ', '2024-06-20 13:06:17', '2024-06-20 13:29:43'),
(772, 920, 'Sahil', '7', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'ibrahim ', '2024-06-20 11:25:19', '2024-06-20 13:50:03'),
(773, 931, 'Sahil', '7', '[{\"id\":\"121\",\"product_name\":\"soğuk kahve ice latte\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-20 12:19:38', '2024-06-20 13:50:03'),
(774, 899, 'Sahil', '15', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '240', 'ibrahim ', '2024-06-20 10:18:18', '2024-06-20 13:52:37'),
(775, 924, 'Sahil', '15', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":2}]', '900', 'selma ', '2024-06-20 11:43:40', '2024-06-20 13:52:37'),
(776, 897, 'Sahil', '50', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"116\",\"product_name\":\"corona\",\"product_price\":\"200\",\"amount\":3},{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '830', 'mehmet ', '2024-06-20 10:10:03', '2024-06-20 14:18:23'),
(777, 935, 'Sahil', '50', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-20 12:34:39', '2024-06-20 14:18:23'),
(778, 890, 'Sahil', '8', '[{\"id\":\"64\",\"product_name\":\"efes malt kutu\",\"product_price\":\"100\",\"amount\":4},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2},{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":1}]', '480', 'serkan ', '2024-06-20 08:55:58', '2024-06-20 14:22:23'),
(779, 901, 'Sahil', '8', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-20 10:31:45', '2024-06-20 14:22:23'),
(780, 907, 'Sahil', '8', '[{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":1}]', '70', 'serkan ', '2024-06-20 10:41:45', '2024-06-20 14:22:23'),
(781, 932, 'Sahil', '8', '[{\"id\":\"64\",\"product_name\":\"efes malt kutu\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-20 12:20:30', '2024-06-20 14:22:23'),
(782, 930, 'Sahil', '9', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":4},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2}]', '980', 'ibrahim ', '2024-06-20 12:19:11', '2024-06-20 14:22:35'),
(783, 888, 'Sahil', '2', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":2}]', '170', 'serkan ', '2024-06-20 08:52:01', '2024-06-20 14:44:15'),
(784, 940, 'Sahil', '2', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2}]', '120', 'ibrahim ', '2024-06-20 12:50:25', '2024-06-20 14:44:15'),
(787, 949, 'Sahil', '26', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '280', 'ibrahim ', '2024-06-20 13:32:37', '2024-06-20 15:12:29'),
(788, 951, 'Sahil', '26', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-20 14:05:24', '2024-06-20 15:12:29'),
(789, 944, 'Sahil', '10', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '410', 'ibrahim ', '2024-06-20 13:02:56', '2024-06-20 15:17:41'),
(790, 927, 'Sahil', '19', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"74\",\"product_name\":\"lipton kutu limon\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":1},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":2}]', '465', 'serkan ', '2024-06-20 12:04:22', '2024-06-20 15:22:54'),
(791, 933, 'Sahil', '19', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2}]', '300', 'ibrahim ', '2024-06-20 12:25:57', '2024-06-20 15:22:54'),
(792, 925, 'Sahil', '17', '[{\"id\":\"111\",\"product_name\":\"beck\'s\",\"product_price\":\"125\",\"amount\":1}]', '125', 'mehmet ', '2024-06-20 11:44:37', '2024-06-20 16:36:08'),
(793, 963, 'Sahil', '17', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"74\",\"product_name\":\"lipton kutu limon\",\"product_price\":\"60\",\"amount\":1}]', '210', 'serkan ', '2024-06-20 15:56:48', '2024-06-20 16:36:08'),
(794, 956, 'Sahil', '45', '[{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":2},{\"id\":\"39\",\"product_name\":\"patates(double)\",\"product_price\":\"250\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2},{\"id\":\"114\",\"product_name\":\"1li̇tre li̇pton\",\"product_price\":\"60\",\"amount\":1}]', '960', 'mehmet ', '2024-06-20 14:54:12', '2024-06-20 16:40:32'),
(795, 894, 'Sahil', '16', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '160', 'ibrahim ', '2024-06-20 09:53:32', '2024-06-20 16:46:46'),
(796, 906, 'Sahil', '16', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-20 10:39:17', '2024-06-20 16:46:46'),
(797, 916, 'Sahil', '16', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'ibrahim ', '2024-06-20 11:18:35', '2024-06-20 16:46:46'),
(798, 921, 'Sahil', '16', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'ibrahim ', '2024-06-20 11:29:45', '2024-06-20 16:46:46'),
(799, 936, 'Sahil', '16', '[{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '315', 'serkan ', '2024-06-20 12:38:38', '2024-06-20 16:46:46'),
(800, 942, 'Sahil', '16', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '300', 'ibrahim ', '2024-06-20 12:55:49', '2024-06-20 16:46:46'),
(801, 952, 'Sahil', '16', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-20 14:15:36', '2024-06-20 16:46:46'),
(802, 962, 'Sahil', '16', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-20 15:50:07', '2024-06-20 16:46:46'),
(803, 973, 'Sahil', '16', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-20 16:44:34', '2024-06-20 16:46:46'),
(804, 950, 'Sahil', '3', '[{\"id\":\"65\",\"product_name\":\"efes extra\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-20 13:54:54', '2024-06-20 16:58:23'),
(805, 953, 'Sahil', '3', '[{\"id\":\"65\",\"product_name\":\"efes extra\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-20 14:18:29', '2024-06-20 16:58:23'),
(806, 954, 'Sahil', '3', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-20 14:32:54', '2024-06-20 16:58:23'),
(807, 958, 'Sahil', '3', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-20 15:09:02', '2024-06-20 16:58:23'),
(808, 964, 'Sahil', '3', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '300', 'ibrahim ', '2024-06-20 15:57:46', '2024-06-20 16:58:23'),
(809, 971, 'Sahil', '3', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '80', 'serkan ', '2024-06-20 16:31:56', '2024-06-20 16:58:23'),
(810, 967, 'Bahçe', '5', '[{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":5}]', '350', 'serkan ', '2024-06-20 16:14:05', '2024-06-20 17:00:17'),
(811, 959, 'Sahil', '2', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '420', 'ibrahim ', '2024-06-20 15:42:35', '2024-06-20 17:04:19'),
(812, 977, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-20 17:09:08', '2024-06-20 17:24:48'),
(814, 966, 'Sahil', '15', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '385', 'serkan ', '2024-06-20 16:08:35', '2024-06-20 17:49:27'),
(815, 969, 'Sahil', '15', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '175', 'selma ', '2024-06-20 16:25:32', '2024-06-20 17:49:27'),
(816, 974, 'Sahil', '15', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1}]', '375', 'ibrahim ', '2024-06-20 16:55:35', '2024-06-20 17:49:27'),
(817, 960, 'Sahil', '9', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":1},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"61\",\"product_name\":\"kutu meyve suyu karışık\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2}]', '985', 'ibrahim ', '2024-06-20 15:46:00', '2024-06-20 17:54:30'),
(818, 965, 'Sahil', '50', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '300', 'ibrahim ', '2024-06-20 16:08:13', '2024-06-20 18:36:03'),
(819, 981, 'Sahil', '50', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '100', 'ibrahim ', '2024-06-20 18:06:31', '2024-06-20 18:36:03'),
(820, 961, 'Sahil', '8', '[{\"id\":\"65\",\"product_name\":\"efes extra\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-20 15:47:31', '2024-06-20 19:39:25'),
(821, 978, 'Sahil', '8', '[{\"id\":\"65\",\"product_name\":\"efes extra\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-20 17:11:40', '2024-06-20 19:39:25'),
(822, 982, 'Sahil', '8', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-20 18:15:06', '2024-06-20 19:39:25'),
(823, 970, 'Sahil', '11', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'ibrahim ', '2024-06-20 16:26:06', '2024-06-20 21:21:39'),
(824, 972, 'Sahil', '11', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '320', 'serkan ', '2024-06-20 16:38:23', '2024-06-20 21:21:39');
INSERT INTO `orders_log` (`id`, `old_id`, `table_area`, `table_number`, `order_content`, `order_total`, `waiter_name`, `table_opening_time`, `order_closing_time`) VALUES
(825, 979, 'Sahil', '11', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '230', 'serkan ', '2024-06-20 17:19:12', '2024-06-20 21:21:39'),
(826, 946, 'Sahil', '35', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":4}]', '80', 'serkan ', '2024-06-20 13:09:08', '2024-06-20 21:22:02'),
(827, 914, 'Sahil', '24', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'selma ', '2024-06-20 11:03:16', '2024-06-21 06:16:23'),
(828, 980, 'Sahil', '4', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'admin ', '2024-06-20 17:37:57', '2024-06-21 06:16:33'),
(829, 983, 'Sahil', '6', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":2}]', '600', 'ibrahim ', '2024-06-20 18:32:53', '2024-06-21 06:16:50'),
(830, 984, 'Sahil', '6', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-20 19:04:11', '2024-06-21 06:16:50'),
(831, 968, 'Sahil', '10', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":2},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"58\",\"product_name\":\"kutu gazoz\",\"product_price\":\"60\",\"amount\":4},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '1030', 'ibrahim ', '2024-06-20 16:17:03', '2024-06-21 06:16:59'),
(832, 975, 'Sahil', '10', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'ibrahim ', '2024-06-20 17:01:55', '2024-06-21 06:16:59'),
(833, 976, 'Sahil', '10', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'ibrahim ', '2024-06-20 17:02:31', '2024-06-21 06:16:59'),
(834, 886, 'Sahil', '18', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":4}]', '600', 'serkan ', '2024-06-20 07:52:52', '2024-06-21 06:17:14'),
(835, 887, 'Sahil', '18', '[{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":4}]', '100', 'serkan ', '2024-06-20 07:54:05', '2024-06-21 06:17:14'),
(836, 891, 'Sahil', '18', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":3}]', '300', 'serkan ', '2024-06-20 09:22:17', '2024-06-21 06:17:14'),
(837, 898, 'Sahil', '18', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":4}]', '80', 'mehmet ', '2024-06-20 10:12:42', '2024-06-21 06:17:14'),
(838, 911, 'Sahil', '18', '[{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":2}]', '150', 'serkan ', '2024-06-20 10:58:08', '2024-06-21 06:17:14'),
(839, 917, 'Sahil', '18', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '170', 'ibrahim ', '2024-06-20 11:19:53', '2024-06-21 06:17:14'),
(840, 937, 'Sahil', '18', '[{\"id\":\"30\",\"product_name\":\"sahanda yumurta\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-20 12:40:32', '2024-06-21 06:17:14'),
(841, 938, 'Sahil', '18', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-20 12:42:55', '2024-06-21 06:17:14'),
(842, 948, 'Sahil', '18', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":4}]', '80', 'mehmet ', '2024-06-20 13:15:41', '2024-06-21 06:17:14'),
(843, 913, 'Sahil', '20', '[{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":3}]', '210', 'ibrahim ', '2024-06-20 11:02:47', '2024-06-21 06:18:20'),
(844, 929, 'Sahil', '20', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '100', 'ibrahim ', '2024-06-20 12:14:23', '2024-06-21 06:18:20'),
(845, 943, 'Sahil', '20', '[{\"id\":\"130\",\"product_name\":\"mi̇lkshake karamel\",\"product_price\":\"110\",\"amount\":2}]', '220', 'ibrahim ', '2024-06-20 12:57:34', '2024-06-21 06:18:20'),
(846, 947, 'Sahil', '20', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1}]', '225', 'ibrahim ', '2024-06-20 13:11:47', '2024-06-21 06:18:20'),
(847, 918, 'Sahil', '21', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '510', 'serkan ', '2024-06-20 11:21:27', '2024-06-21 06:19:31'),
(848, 941, 'Sahil', '21', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '100', 'ibrahim ', '2024-06-20 12:54:36', '2024-06-21 06:19:31'),
(849, 934, 'Sahil', '25', '[{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":3}]', '115', 'ibrahim ', '2024-06-20 12:34:12', '2024-06-21 06:19:41'),
(850, 903, 'Sahil', '31', '[{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '200', 'ibrahim ', '2024-06-20 10:36:44', '2024-06-21 06:19:50'),
(851, 987, 'Bahçe', '4', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '340', 'serkan ', '2024-06-21 09:09:22', '2024-06-21 11:21:21'),
(852, 992, 'Bahçe', '4', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"89\",\"product_name\":\"soğuk nescafe orjinal\",\"product_price\":\"75\",\"amount\":1}]', '205', 'serkan ', '2024-06-21 10:24:25', '2024-06-21 11:21:21'),
(853, 996, 'Bahçe', '4', '[{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":1}]', '90', 'serkan ', '2024-06-21 11:01:38', '2024-06-21 11:21:21'),
(854, 998, 'Sahil', '17', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1}]', '935', 'serkan ', '2024-06-21 11:11:10', '2024-06-21 11:32:47'),
(855, 1000, 'Sahil', '17', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '120', 'selma ', '2024-06-21 11:14:53', '2024-06-21 11:32:47'),
(856, 1002, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-21 11:20:24', '2024-06-21 11:44:45'),
(857, 989, 'Bahçe', '5', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1}]', '130', 'selma ', '2024-06-21 10:08:20', '2024-06-21 11:50:43'),
(858, 991, 'Bahçe', '5', '[{\"id\":\"115\",\"product_name\":\"ci̇tos\",\"product_price\":\"50\",\"amount\":2}]', '100', 'selma ', '2024-06-21 10:15:18', '2024-06-21 11:50:43'),
(859, 993, 'Bahçe', '5', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1}]', '130', 'selma ', '2024-06-21 10:28:06', '2024-06-21 11:50:43'),
(860, 997, 'Bahçe', '5', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1}]', '130', 'selma ', '2024-06-21 11:03:37', '2024-06-21 11:50:43'),
(862, 1006, 'Bahçe', '4', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1}]', '510', 'selma ', '2024-06-21 11:57:52', '2024-06-21 12:19:53'),
(864, 1003, 'Sahil', '24', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1},{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '905', 'serkan ', '2024-06-21 11:33:43', '2024-06-21 12:56:03'),
(865, 985, 'Sahil', '1', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'ibrahim ', '2024-06-21 06:17:53', '2024-06-21 14:24:29'),
(866, 988, 'Sahil', '1', '[{\"id\":\"93\",\"product_name\":\"churchill\",\"product_price\":\"75\",\"amount\":2}]', '150', 'ibrahim ', '2024-06-21 09:53:40', '2024-06-21 14:24:29'),
(867, 1001, 'Sahil', '1', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"114\",\"product_name\":\"1li̇tre li̇pton\",\"product_price\":\"60\",\"amount\":1}]', '360', 'serkan ', '2024-06-21 11:18:29', '2024-06-21 14:24:29'),
(868, 1008, 'Sahil', '1', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1},{\"id\":\"58\",\"product_name\":\"kutu gazoz\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"60\",\"product_name\":\"kutu meyve suyu vi̇şne\",\"product_price\":\"60\",\"amount\":1}]', '155', 'ibrahim ', '2024-06-21 12:29:15', '2024-06-21 14:24:29'),
(869, 1004, 'Paket', '0', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-21 11:45:22', '2024-06-21 14:28:44'),
(870, 1028, 'Paket', '0', '[{\"id\":\"129\",\"product_name\":\"mi̇lkshake çi̇lek\",\"product_price\":\"110\",\"amount\":2},{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":1}]', '295', 'serkan ', '2024-06-21 14:29:35', '2024-06-21 14:30:45'),
(871, 999, 'Sahil', '9', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":2},{\"id\":\"61\",\"product_name\":\"kutu meyve suyu karışık\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2}]', '820', 'ibrahim ', '2024-06-21 11:14:31', '2024-06-21 14:44:30'),
(872, 1021, 'Sahil', '9', '[{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":4}]', '100', 'selma ', '2024-06-21 13:38:37', '2024-06-21 14:44:30'),
(873, 1025, 'Sahil', '9', '[{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":1}]', '70', 'selma ', '2024-06-21 14:18:33', '2024-06-21 14:44:30'),
(874, 1027, 'Sahil', '9', '[{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":2}]', '140', 'selma ', '2024-06-21 14:19:28', '2024-06-21 14:44:30'),
(875, 1016, 'Sahil', '16', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"75\",\"product_name\":\"li̇pton mango\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '630', 'ibrahim ', '2024-06-21 12:54:41', '2024-06-21 15:20:13'),
(876, 1020, 'Sahil', '23', '[{\"id\":\"71\",\"product_name\":\"miller 500cl\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '680', 'ibrahim ', '2024-06-21 13:29:33', '2024-06-21 15:20:47'),
(877, 1023, 'Sahil', '23', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-21 14:10:49', '2024-06-21 15:20:47'),
(878, 994, 'Sahil', '8', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'ibrahim ', '2024-06-21 10:30:29', '2024-06-21 15:29:58'),
(879, 995, 'Sahil', '8', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":5}]', '100', 'ibrahim ', '2024-06-21 10:31:20', '2024-06-21 15:29:58'),
(880, 1009, 'Sahil', '7', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '350', 'ibrahim ', '2024-06-21 12:33:12', '2024-06-21 15:38:17'),
(881, 1015, 'Sahil', '7', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '100', 'ibrahim ', '2024-06-21 12:52:08', '2024-06-21 15:38:17'),
(882, 1017, 'Sahil', '7', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":2}]', '70', 'serkan ', '2024-06-21 13:01:49', '2024-06-21 15:38:17'),
(883, 1033, 'Sahil', '50', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'ibrahim ', '2024-06-21 16:00:36', '2024-06-21 16:04:41'),
(884, 1029, 'Paket', '0', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1}]', '225', 'serkan ', '2024-06-21 14:53:31', '2024-06-21 16:27:40'),
(885, 986, 'Sahil', '2', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '540', 'selma ', '2024-06-21 08:05:45', '2024-06-21 16:30:27'),
(886, 990, 'Sahil', '2', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-21 10:11:15', '2024-06-21 16:30:27'),
(887, 1024, 'Sahil', '2', '[{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":1}]', '75', 'serkan ', '2024-06-21 14:16:40', '2024-06-21 16:30:27'),
(888, 1030, 'Sahil', '2', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'ibrahim ', '2024-06-21 15:27:47', '2024-06-21 16:30:27'),
(889, 1013, 'Bahçe', '3', '[{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2},{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '370', 'selma ', '2024-06-21 12:47:32', '2024-06-21 16:31:24'),
(890, 1014, 'Bahçe', '3', '[{\"id\":\"46\",\"product_name\":\"soğan halkası\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-21 12:51:17', '2024-06-21 16:31:24'),
(891, 1010, 'Sahil', '6', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2}]', '260', 'serkan ', '2024-06-21 12:36:55', '2024-06-21 17:26:21'),
(892, 1011, 'Sahil', '6', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '300', 'serkan ', '2024-06-21 12:37:19', '2024-06-21 17:26:21'),
(893, 1012, 'Sahil', '6', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2}]', '260', 'ibrahim ', '2024-06-21 12:43:17', '2024-06-21 17:26:21'),
(894, 1018, 'Sahil', '6', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2}]', '200', 'serkan ', '2024-06-21 13:14:46', '2024-06-21 17:26:21'),
(895, 1026, 'Sahil', '6', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-21 14:18:45', '2024-06-21 17:26:21'),
(896, 1031, 'Sahil', '6', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-21 15:31:09', '2024-06-21 17:26:21'),
(897, 1036, 'Sahil', '6', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-21 16:18:17', '2024-06-21 17:26:21'),
(898, 1037, 'Sahil', '6', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '140', 'serkan ', '2024-06-21 16:22:47', '2024-06-21 17:26:21'),
(899, 1034, 'Sahil', '23', '[{\"id\":\"71\",\"product_name\":\"miller 500cl\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1}]', '260', 'selma ', '2024-06-21 16:04:32', '2024-06-21 17:30:49'),
(900, 1035, 'Sahil', '23', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'selma ', '2024-06-21 16:07:03', '2024-06-21 17:30:49'),
(901, 1039, 'Sahil', '23', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-21 17:06:05', '2024-06-21 17:30:49'),
(902, 1019, 'Sahil', '35', '[{\"id\":\"93\",\"product_name\":\"churchill\",\"product_price\":\"75\",\"amount\":2}]', '150', 'serkan ', '2024-06-21 13:21:09', '2024-06-21 17:34:53'),
(903, 1022, 'Sahil', '3', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-21 14:03:14', '2024-06-21 17:43:29'),
(904, 1032, 'Sahil', '3', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'ibrahim ', '2024-06-21 15:32:29', '2024-06-21 17:43:29'),
(905, 1038, 'Sahil', '3', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2}]', '120', 'serkan ', '2024-06-21 16:37:45', '2024-06-21 17:43:29'),
(907, 1051, 'Bahçe', '3', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"72\",\"product_name\":\"miller 330cl\",\"product_price\":\"110\",\"amount\":1},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', '600', 'selma ', '2024-06-22 10:19:59', '2024-06-22 10:55:05'),
(908, 1045, 'Bahçe', '4', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2}]', '120', 'serkan ', '2024-06-22 09:02:32', '2024-06-22 10:56:14'),
(909, 1054, 'Bahçe', '7', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":1}]', '310', 'serkan ', '2024-06-22 11:01:33', '2024-06-22 11:03:45'),
(910, 1040, 'Sahil', '8', '[{\"id\":\"29\",\"product_name\":\"kahvaltı tabağı\",\"product_price\":\"200\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '240', 'serkan ', '2024-06-22 07:00:05', '2024-06-22 12:47:43'),
(911, 1043, 'Sahil', '8', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-22 07:56:16', '2024-06-22 12:47:43'),
(912, 1053, 'Sahil', '8', '[{\"id\":\"72\",\"product_name\":\"miller 330cl\",\"product_price\":\"110\",\"amount\":2}]', '220', 'ibrahim ', '2024-06-22 10:50:04', '2024-06-22 12:47:43'),
(913, 1047, 'Sahil', '11', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"57\",\"product_name\":\"kutu fanta\",\"product_price\":\"60\",\"amount\":1}]', '445', 'mehmet ', '2024-06-22 09:33:10', '2024-06-22 13:28:24'),
(914, 1050, 'Sahil', '11', '[{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":2},{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":2}]', '130', 'serkan ', '2024-06-22 10:19:48', '2024-06-22 13:28:24'),
(915, 1065, 'Bahçe', '3', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":7},{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '1085', 'selma ', '2024-06-22 12:52:56', '2024-06-22 13:55:31'),
(916, 1070, 'Bahçe', '3', '[{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"87\",\"product_name\":\"redbull küçük\",\"product_price\":\"75\",\"amount\":1},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1}]', '160', 'serkan ', '2024-06-22 13:32:49', '2024-06-22 13:55:31'),
(917, 1076, 'Bahçe', '3', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":4}]', '80', 'serkan ', '2024-06-22 13:54:44', '2024-06-22 13:55:31'),
(919, 1041, 'Sahil', '35', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":3}]', '60', 'mehmet ', '2024-06-22 07:37:28', '2024-06-22 14:47:12'),
(920, 1044, 'Sahil', '35', '[{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":2}]', '300', 'serkan ', '2024-06-22 09:00:58', '2024-06-22 14:47:12'),
(921, 1049, 'Sahil', '35', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":1}]', '675', 'serkan ', '2024-06-22 10:17:35', '2024-06-22 14:47:12'),
(922, 1058, 'Sahil', '35', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":2}]', '70', 'serkan ', '2024-06-22 11:30:52', '2024-06-22 14:47:12'),
(923, 1063, 'Sahil', '35', '[{\"id\":\"68\",\"product_name\":\"efes malt mavi kutu\",\"product_price\":\"120\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '250', 'serkan ', '2024-06-22 12:43:53', '2024-06-22 14:47:12'),
(924, 1081, 'Sahil', '35', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":7}]', '140', 'serkan ', '2024-06-22 14:30:26', '2024-06-22 14:47:12'),
(925, 1068, 'Bahçe', '7', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"120\",\"product_name\":\"li̇monata shake\",\"product_price\":\"75\",\"amount\":1}]', '135', 'selma ', '2024-06-22 13:29:34', '2024-06-22 14:50:45'),
(926, 1057, 'Sahil', '26', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', '200', 'ibrahim ', '2024-06-22 11:28:04', '2024-06-22 15:03:20'),
(927, 1060, 'Sahil', '26', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '200', 'ibrahim ', '2024-06-22 12:17:13', '2024-06-22 15:03:20'),
(928, 1061, 'Sahil', '26', '[{\"id\":\"39\",\"product_name\":\"patates(double)\",\"product_price\":\"250\",\"amount\":1}]', '250', 'ibrahim ', '2024-06-22 12:23:02', '2024-06-22 15:03:20'),
(929, 1062, 'Sahil', '26', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'ibrahim ', '2024-06-22 12:25:28', '2024-06-22 15:03:20'),
(930, 1069, 'Sahil', '26', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '160', 'ibrahim ', '2024-06-22 13:32:35', '2024-06-22 15:03:20'),
(931, 1074, 'Sahil', '26', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-22 13:51:47', '2024-06-22 15:03:20'),
(932, 1052, 'Sahil', '40', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'selma ', '2024-06-22 10:29:54', '2024-06-22 15:05:12'),
(933, 1055, 'Sahil', '40', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2}]', '260', 'serkan ', '2024-06-22 11:04:45', '2024-06-22 15:05:12'),
(934, 1064, 'Sahil', '40', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'serkan ', '2024-06-22 12:44:10', '2024-06-22 15:05:12'),
(935, 1071, 'Sahil', '40', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-22 13:40:55', '2024-06-22 15:05:12'),
(936, 1067, 'Bahçe', '8', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '685', 'selma ', '2024-06-22 13:25:49', '2024-06-22 16:32:46'),
(937, 1072, 'Bahçe', '8', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":1}]', '90', 'selma ', '2024-06-22 13:47:51', '2024-06-22 16:32:46'),
(938, 1073, 'Bahçe', '8', '[{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":1}]', '300', 'selma ', '2024-06-22 13:49:18', '2024-06-22 16:32:46'),
(939, 1079, 'Bahçe', '8', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'serkan ', '2024-06-22 14:23:02', '2024-06-22 16:32:46'),
(940, 1092, 'Sahil', '18', '[{\"id\":\"39\",\"product_name\":\"patates(double)\",\"product_price\":\"250\",\"amount\":1},{\"id\":\"71\",\"product_name\":\"miller 500cl\",\"product_price\":\"130\",\"amount\":1}]', '380', 'ibrahim ', '2024-06-22 16:41:10', '2024-06-22 17:05:42'),
(941, 1056, 'Sahil', '1', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3}]', '60', 'ibrahim ', '2024-06-22 11:08:13', '2024-06-22 17:27:19'),
(942, 1059, 'Sahil', '1', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'ibrahim ', '2024-06-22 11:55:02', '2024-06-22 17:27:19'),
(943, 1080, 'Sahil', '1', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":2},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":1},{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '1110', 'serkan ', '2024-06-22 14:29:46', '2024-06-22 17:27:19'),
(944, 1085, 'Sahil', '1', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'serkan ', '2024-06-22 15:46:35', '2024-06-22 17:27:19'),
(945, 1077, 'Sahil', '23', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1}]', '240', 'serkan ', '2024-06-22 14:01:33', '2024-06-22 17:56:15'),
(946, 1078, 'Sahil', '23', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-22 14:11:10', '2024-06-22 17:56:15'),
(947, 1083, 'Sahil', '23', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '320', 'serkan ', '2024-06-22 15:37:36', '2024-06-22 17:56:15'),
(948, 1084, 'Sahil', '23', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-22 15:37:49', '2024-06-22 17:56:15'),
(949, 1091, 'Sahil', '11', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":4},{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1},{\"id\":\"58\",\"product_name\":\"kutu gazoz\",\"product_price\":\"60\",\"amount\":1}]', '995', 'selma ', '2024-06-22 16:11:11', '2024-06-22 17:57:39'),
(950, 1088, 'Sahil', '5', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2}]', '410', 'selma ', '2024-06-22 16:03:38', '2024-06-22 17:59:03'),
(951, 1099, 'Bahçe', '2', '[{\"id\":\"28\",\"product_name\":\"serpme kahvaltı(iki kişilik)\",\"product_price\":\"600\",\"amount\":1}]', '600', 'serkan ', '2024-06-23 06:09:24', '2024-06-23 07:14:35'),
(952, 1100, 'Bahçe', '1', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"65\",\"product_name\":\"efes extra\",\"product_price\":\"130\",\"amount\":2}]', '410', 'serkan ', '2024-06-23 07:15:06', '2024-06-23 07:38:01'),
(953, 1102, 'Bahçe', '1', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2}]', '120', 'serkan ', '2024-06-23 07:22:35', '2024-06-23 07:38:01'),
(954, 1042, 'Sahil', '4', '[{\"id\":\"65\",\"product_name\":\"efes extra\",\"product_price\":\"130\",\"amount\":1}]', '130', 'mehmet ', '2024-06-22 07:52:00', '2024-06-23 07:39:15'),
(955, 1048, 'Sahil', '4', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-22 10:12:00', '2024-06-23 07:39:15'),
(956, 1087, 'Sahil', '6', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":1}]', '560', 'ibrahim ', '2024-06-22 15:52:00', '2024-06-23 07:39:22'),
(957, 1089, 'Sahil', '6', '[{\"id\":\"115\",\"product_name\":\"ci̇tos\",\"product_price\":\"50\",\"amount\":1}]', '50', 'serkan ', '2024-06-22 16:07:58', '2024-06-23 07:39:22'),
(958, 1090, 'Sahil', '6', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":5},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"76\",\"product_name\":\"li̇pton kutu karpuz\",\"product_price\":\"60\",\"amount\":1}]', '220', 'selma ', '2024-06-22 16:09:58', '2024-06-23 07:39:22'),
(959, 1066, 'Sahil', '22', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":5}]', '250', 'ibrahim ', '2024-06-22 12:53:31', '2024-06-23 07:39:29'),
(960, 1082, 'Sahil', '28', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":5}]', '950', 'ibrahim ', '2024-06-22 15:29:00', '2024-06-23 07:39:52'),
(961, 1086, 'Sahil', '28', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":5}]', '650', 'serkan ', '2024-06-22 15:50:34', '2024-06-23 07:39:52'),
(962, 1093, 'Sahil', '28', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":3}]', '390', 'serkan ', '2024-06-22 16:45:34', '2024-06-23 07:39:52'),
(963, 1094, 'Sahil', '28', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"116\",\"product_name\":\"corona\",\"product_price\":\"200\",\"amount\":1}]', '460', 'serkan ', '2024-06-22 16:46:41', '2024-06-23 07:39:52'),
(964, 1095, 'Sahil', '28', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":5}]', '650', 'serkan ', '2024-06-22 17:27:01', '2024-06-23 07:39:52'),
(965, 1096, 'Sahil', '28', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":6}]', '930', 'serkan ', '2024-06-22 17:59:23', '2024-06-23 07:39:52'),
(966, 1097, 'Bahçe', '5', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":5},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '120', 'serkan ', '2024-06-23 06:05:13', '2024-06-23 07:41:57'),
(967, 1098, 'Bahçe', '5', '[{\"id\":\"29\",\"product_name\":\"kahvaltı tabağı\",\"product_price\":\"200\",\"amount\":1},{\"id\":\"28\",\"product_name\":\"serpme kahvaltı(iki kişilik)\",\"product_price\":\"600\",\"amount\":1}]', '800', 'serkan ', '2024-06-23 06:06:47', '2024-06-23 07:41:57'),
(968, 1103, 'Bahçe', '5', '[{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":5}]', '325', 'selma ', '2024-06-23 07:38:24', '2024-06-23 07:41:57'),
(969, 1101, 'Bahçe', '2', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-23 07:15:22', '2024-06-23 08:32:15'),
(970, 1114, 'Bahçe', '4', '[{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":1}]', '175', 'selma ', '2024-06-23 09:08:56', '2024-06-23 09:37:20'),
(971, 1115, 'Bahçe', '4', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'selma ', '2024-06-23 09:09:11', '2024-06-23 09:37:20'),
(972, 1126, 'Sahil', '20', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2}]', '260', 'ibrahim ', '2024-06-23 09:53:57', '2024-06-23 10:02:45'),
(973, 1136, 'Sahil', '12', '[{\"id\":\"39\",\"product_name\":\"patates(double)\",\"product_price\":\"250\",\"amount\":2},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1}]', '575', 'ibrahim ', '2024-06-23 10:34:45', '2024-06-23 10:37:25'),
(974, 1130, 'Sahil', '20', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-23 10:03:38', '2024-06-23 11:00:02'),
(981, 1118, 'Sahil', '8', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'selma ', '2024-06-23 09:20:20', '2024-06-23 12:12:09'),
(982, 1119, 'Sahil', '8', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"57\",\"product_name\":\"kutu fanta\",\"product_price\":\"60\",\"amount\":1}]', '610', 'ibrahim ', '2024-06-23 09:24:51', '2024-06-23 12:12:09'),
(983, 1122, 'Sahil', '8', '[{\"id\":\"134\",\"product_name\":\"kova takimi\",\"product_price\":\"200\",\"amount\":1}]', '200', 'serkan ', '2024-06-23 09:28:52', '2024-06-23 12:12:09'),
(984, 1124, 'Sahil', '8', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-23 09:41:53', '2024-06-23 12:12:09'),
(985, 1129, 'Sahil', '8', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-23 10:00:26', '2024-06-23 12:12:09'),
(986, 1157, 'Sahil', '8', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-23 12:03:11', '2024-06-23 12:12:09'),
(987, 1142, 'Bahçe', '3', '[{\"id\":\"29\",\"product_name\":\"kahvaltı tabağı\",\"product_price\":\"200\",\"amount\":2},{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":1},{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '500', 'serkan ', '2024-06-23 11:05:35', '2024-06-23 12:14:32'),
(988, 1146, 'Bahçe', '3', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-23 11:18:11', '2024-06-23 12:14:32'),
(989, 1149, 'Bahçe', '3', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-23 11:24:53', '2024-06-23 12:14:32'),
(990, 1105, 'Sahil', '22', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"225\",\"amount\":3},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1}]', '885', 'ibrahim ', '2024-06-23 07:46:00', '2024-06-23 12:16:12'),
(991, 1112, 'Sahil', '22', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":3},{\"id\":\"44\",\"product_name\":\"karışık çerez\",\"product_price\":\"125\",\"amount\":1}]', '515', 'ibrahim ', '2024-06-23 09:02:30', '2024-06-23 12:16:12'),
(992, 1131, 'Sahil', '22', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"87\",\"product_name\":\"redbull küçük\",\"product_price\":\"75\",\"amount\":1}]', '95', 'selma ', '2024-06-23 10:24:34', '2024-06-23 12:16:12'),
(993, 1160, 'Bahçe', '2', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '770', 'serkan ', '2024-06-23 12:20:31', '2024-06-23 12:21:11'),
(994, 1162, 'Sahil', '35', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-23 12:21:50', '2024-06-23 12:27:49'),
(995, 1108, 'Sahil', '5', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-23 08:26:14', '2024-06-23 12:51:16'),
(996, 1117, 'Sahil', '5', '[{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"60.00\",\"amount\":1}]', '60', 'selma ', '2024-06-23 09:14:11', '2024-06-23 12:51:16'),
(997, 1151, 'Sahil', '5', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '160', 'serkan ', '2024-06-23 11:31:38', '2024-06-23 12:51:16'),
(998, 1104, 'Sahil', '7', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":2},{\"id\":\"125\",\"product_name\":\"cool lime\",\"product_price\":\"100\",\"amount\":2},{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '1250', 'serkan ', '2024-06-23 07:42:40', '2024-06-23 12:52:16'),
(999, 1107, 'Sahil', '7', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":4}]', '240', 'serkan ', '2024-06-23 08:10:05', '2024-06-23 12:52:16'),
(1000, 1111, 'Sahil', '7', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":7}]', '140', 'serkan ', '2024-06-23 08:46:40', '2024-06-23 12:52:16'),
(1001, 1120, 'Sahil', '7', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":4},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '440', 'serkan ', '2024-06-23 09:26:56', '2024-06-23 12:52:16'),
(1002, 1121, 'Sahil', '7', '[{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":2}]', '60', 'serkan ', '2024-06-23 09:27:30', '2024-06-23 12:52:16'),
(1003, 1123, 'Sahil', '7', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'selma ', '2024-06-23 09:40:20', '2024-06-23 12:52:16'),
(1004, 1127, 'Sahil', '7', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-23 09:57:05', '2024-06-23 12:52:16'),
(1005, 1128, 'Sahil', '7', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-23 09:58:45', '2024-06-23 12:52:16'),
(1006, 1154, 'Sahil', '7', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":4}]', '240', 'serkan ', '2024-06-23 11:44:01', '2024-06-23 12:52:16'),
(1007, 1161, 'Bahçe', '2', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '560', 'serkan ', '2024-06-23 12:21:32', '2024-06-23 13:02:06'),
(1008, 1169, 'Bahçe', '2', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', '160', 'serkan ', '2024-06-23 12:49:09', '2024-06-23 13:02:06'),
(1009, 1109, 'Sahil', '6', '[{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":2}]', '60', 'serkan ', '2024-06-23 08:39:26', '2024-06-23 13:12:07'),
(1010, 1116, 'Sahil', '6', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"74\",\"product_name\":\"lipton kutu limon\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":1}]', '265', 'ibrahim ', '2024-06-23 09:11:29', '2024-06-23 13:12:07'),
(1011, 1135, 'Sahil', '6', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-23 10:31:46', '2024-06-23 13:12:07'),
(1012, 1153, 'Sahil', '6', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"138\",\"product_name\":\"si̇gara böreği̇\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"114\",\"product_name\":\"1li̇tre li̇pton\",\"product_price\":\"75\",\"amount\":1}]', '605', 'serkan ', '2024-06-23 11:43:00', '2024-06-23 13:12:07'),
(1013, 1125, 'Sahil', '2', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3}]', '290', 'ibrahim ', '2024-06-23 09:49:36', '2024-06-23 13:20:58'),
(1014, 1141, 'Sahil', '2', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"58\",\"product_name\":\"kutu gazoz\",\"product_price\":\"60\",\"amount\":1}]', '200', 'ibrahim ', '2024-06-23 11:00:57', '2024-06-23 13:20:58'),
(1015, 1150, 'Sahil', '2', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-23 11:27:53', '2024-06-23 13:20:58'),
(1016, 1145, 'Sahil', '1', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":2},{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":1}]', '700', 'ibrahim ', '2024-06-23 11:10:50', '2024-06-23 13:42:05'),
(1017, 1147, 'Sahil', '1', '[{\"id\":\"119\",\"product_name\":\"şemsi̇ye set\",\"product_price\":\"700\",\"amount\":2}]', '1400', 'serkan ', '2024-06-23 11:24:03', '2024-06-23 13:42:05'),
(1018, 1148, 'Sahil', '1', '[]', '1400', 'serkan ', '2024-06-23 11:24:04', '2024-06-23 13:42:05'),
(1019, 1152, 'Sahil', '1', '[{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '450', 'serkan ', '2024-06-23 11:39:22', '2024-06-23 13:42:05'),
(1020, 1170, 'Sahil', '1', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-23 12:53:48', '2024-06-23 13:42:05'),
(1021, 1175, 'Sahil', '1', '[{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":1}]', '330', 'serkan ', '2024-06-23 13:15:02', '2024-06-23 13:42:05'),
(1022, 1178, 'Sahil', '1', '[{\"id\":\"57\",\"product_name\":\"kutu fanta\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3}]', '120', 'serkan ', '2024-06-23 13:31:05', '2024-06-23 13:42:05'),
(1023, 1167, 'Sahil', '24', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '280', 'ibrahim ', '2024-06-23 12:30:29', '2024-06-23 13:52:32'),
(1024, 1156, 'Sahil', '4', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":1}]', '190', 'serkan ', '2024-06-23 11:55:51', '2024-06-23 14:07:32'),
(1025, 1159, 'Sahil', '4', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":2}]', '600', 'serkan ', '2024-06-23 12:14:25', '2024-06-23 14:07:32'),
(1026, 1166, 'Sahil', '4', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-23 12:28:53', '2024-06-23 14:07:32'),
(1027, 1171, 'Sahil', '4', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":2}]', '70', 'serkan ', '2024-06-23 12:54:14', '2024-06-23 14:07:32'),
(1028, 1173, 'Sahil', '4', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-23 12:59:34', '2024-06-23 14:07:32'),
(1029, 1177, 'Sahil', '4', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '110', 'serkan ', '2024-06-23 13:29:15', '2024-06-23 14:07:32'),
(1030, 1179, 'Sahil', '4', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-23 13:31:31', '2024-06-23 14:07:32'),
(1031, 1106, 'Sahil', '29', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'selma ', '2024-06-23 08:00:26', '2024-06-23 14:20:31'),
(1032, 1164, 'Sahil', '29', '[{\"id\":\"30\",\"product_name\":\"sahanda yumurta\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"114\",\"product_name\":\"1li̇tre li̇pton\",\"product_price\":\"75\",\"amount\":1}]', '175', 'serkan ', '2024-06-23 12:23:23', '2024-06-23 14:20:31'),
(1033, 1138, 'Sahil', '12', '[{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1},{\"id\":\"39\",\"product_name\":\"patates(double)\",\"product_price\":\"250\",\"amount\":1}]', '325', 'serkan ', '2024-06-23 10:39:26', '2024-06-23 14:26:17'),
(1034, 1168, 'Sahil', '12', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1}]', '225', 'ibrahim ', '2024-06-23 12:40:31', '2024-06-23 14:26:17'),
(1035, 1143, 'Sahil', '17', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1}]', '225', 'serkan ', '2024-06-23 11:05:44', '2024-06-23 14:27:36'),
(1036, 1165, 'Sahil', '35', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-23 12:28:24', '2024-06-23 14:27:54'),
(1037, 1113, 'Sahil', '23', '[{\"id\":\"37\",\"product_name\":\"ayvalık tostu+ patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-23 09:06:38', '2024-06-23 14:40:44'),
(1038, 1140, 'Sahil', '23', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'ibrahim ', '2024-06-23 11:00:14', '2024-06-23 14:40:44'),
(1039, 1158, 'Sahil', '23', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-23 12:07:57', '2024-06-23 14:40:44'),
(1040, 1172, 'Sahil', '23', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '60', 'ibrahim ', '2024-06-23 12:56:05', '2024-06-23 14:40:44');
INSERT INTO `orders_log` (`id`, `old_id`, `table_area`, `table_number`, `order_content`, `order_total`, `waiter_name`, `table_opening_time`, `order_closing_time`) VALUES
(1041, 1182, 'Bahçe', '6', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'selma ', '2024-06-23 14:35:55', '2024-06-23 14:46:28'),
(1042, 1155, 'Sahil', '19', '[{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1}]', '540', 'selma ', '2024-06-23 11:46:49', '2024-06-23 14:59:55'),
(1043, 1176, 'Sahil', '19', '[{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":1}]', '150', 'ibrahim ', '2024-06-23 13:20:49', '2024-06-23 14:59:55'),
(1044, 1181, 'Sahil', '19', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-23 14:06:14', '2024-06-23 14:59:55'),
(1045, 1110, 'Sahil', '9', '[{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":2}]', '60', 'serkan ', '2024-06-23 08:42:44', '2024-06-23 15:01:33'),
(1046, 1163, 'Sahil', '10', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '325', 'serkan ', '2024-06-23 12:22:29', '2024-06-23 15:12:51'),
(1047, 1184, 'Paket', '0', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2}]', '290', 'serkan ', '2024-06-23 15:17:15', '2024-06-23 16:44:36'),
(1048, 1174, 'Sahil', '8', '[{\"id\":\"139\",\"product_name\":\"set\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-23 13:11:01', '2024-06-23 17:34:05'),
(1049, 1180, 'Sahil', '8', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '325', 'ibrahim ', '2024-06-23 13:52:25', '2024-06-23 17:34:05'),
(1050, 1185, 'Sahil', '8', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"57\",\"product_name\":\"kutu fanta\",\"product_price\":\"60\",\"amount\":1}]', '80', 'serkan ', '2024-06-23 15:46:28', '2024-06-23 17:34:05'),
(1051, 1183, 'Sahil', '5', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'selma ', '2024-06-23 15:10:26', '2024-06-24 08:33:49'),
(1052, 1186, 'Sahil', '5', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-23 15:48:40', '2024-06-24 08:33:49'),
(1053, 1187, 'Sahil', '5', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-23 16:33:27', '2024-06-24 08:33:49'),
(1055, 1190, 'Sahil', '6', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":1}]', '300', 'serkan ', '2024-06-24 09:28:20', '2024-06-24 11:24:25'),
(1056, 1194, 'Bahçe', '2', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":4}]', '600', 'serkan ', '2024-06-24 13:32:25', '2024-06-24 14:04:25'),
(1057, 1188, 'Sahil', '1', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2}]', '350', 'serkan ', '2024-06-24 08:34:39', '2024-06-24 14:38:28'),
(1058, 1191, 'Sahil', '1', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2},{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '520', 'serkan ', '2024-06-24 09:43:03', '2024-06-24 14:38:28'),
(1059, 1192, 'Sahil', '1', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '220', 'serkan ', '2024-06-24 11:22:01', '2024-06-24 14:38:28'),
(1060, 1193, 'Sahil', '1', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2}]', '200', 'serkan ', '2024-06-24 12:10:23', '2024-06-24 14:38:28'),
(1061, 1195, 'Bahçe', '6', '[{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":2},{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '450', 'serkan ', '2024-06-24 15:27:06', '2024-06-24 18:10:40'),
(1062, 1196, 'Sahil', '6', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-25 08:54:29', '2024-06-25 08:54:45'),
(1063, 1198, 'Paket', '0', '[{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":1},{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '135', 'serkan ', '2024-06-25 08:56:49', '2024-06-25 09:33:59'),
(1064, 1199, 'Sahil', '7', '[{\"id\":\"139\",\"product_name\":\"set\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-25 09:33:31', '2024-06-25 13:18:19'),
(1065, 1197, 'Sahil', '6', '[{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":2}]', '60', 'serkan ', '2024-06-25 08:54:59', '2024-06-25 13:59:52'),
(1066, 1203, 'Sahil', '16', '[{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":2}]', '60', 'selma ', '2024-06-25 12:42:12', '2024-06-25 16:20:11'),
(1067, 1208, 'Sahil', '3', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":2}]', '820', 'serkan ', '2024-06-25 17:00:59', '2024-06-25 17:26:27'),
(1068, 1209, 'Paket', '0', '[{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"325\",\"amount\":1}]', '325', 'serkan ', '2024-06-26 06:53:08', '2024-06-26 06:53:22'),
(1069, 1200, 'Sahil', '4', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1}]', '230', 'selma ', '2024-06-25 11:38:15', '2024-06-26 13:04:00'),
(1070, 1201, 'Sahil', '4', '[{\"id\":\"89\",\"product_name\":\"soğuk nescafe orjinal\",\"product_price\":\"75\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '95', 'selma ', '2024-06-25 11:51:39', '2024-06-26 13:04:00'),
(1071, 1202, 'Sahil', '4', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-25 11:56:35', '2024-06-26 13:04:00'),
(1072, 1205, 'Sahil', '4', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"74\",\"product_name\":\"lipton kutu limon\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":1}]', '360', 'selma ', '2024-06-25 13:40:00', '2024-06-26 13:04:00'),
(1073, 1206, 'Sahil', '4', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'selma ', '2024-06-25 13:48:58', '2024-06-26 13:04:00'),
(1074, 1216, 'Bahçe', '4', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1}]', '690', 'serkan ', '2024-06-26 12:51:20', '2024-06-26 13:52:47'),
(1075, 1220, 'Bahçe', '4', '[{\"id\":\"114\",\"product_name\":\"1li̇tre li̇pton\",\"product_price\":\"75\",\"amount\":1}]', '75', 'serkan ', '2024-06-26 13:17:27', '2024-06-26 13:52:47'),
(1076, 1221, 'Bahçe', '4', '[{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"325\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '345', 'selma ', '2024-06-26 13:36:44', '2024-06-26 13:52:47'),
(1077, 1218, 'Bahçe', '8', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-26 13:10:30', '2024-06-26 13:57:19'),
(1078, 1222, 'Bahçe', '8', '[{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":1}]', '30', 'selma ', '2024-06-26 13:39:02', '2024-06-26 13:57:19'),
(1079, 1212, 'Sahil', '2', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-26 12:00:18', '2024-06-26 13:58:19'),
(1080, 1213, 'Sahil', '2', '[{\"id\":\"139\",\"product_name\":\"set\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-26 12:00:43', '2024-06-26 13:58:19'),
(1081, 1225, 'Sahil', '28', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1}]', '240', 'serkan ', '2024-06-26 14:04:03', '2024-06-26 14:11:56'),
(1082, 1211, 'Sahil', '1', '[{\"id\":\"139\",\"product_name\":\"set\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-26 11:54:51', '2024-06-26 15:11:33'),
(1083, 1215, 'Sahil', '1', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1}]', '530', 'serkan ', '2024-06-26 12:44:23', '2024-06-26 15:11:33'),
(1084, 1210, 'Sahil', '30', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":3},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '730', 'serkan ', '2024-06-26 11:44:26', '2024-06-26 15:35:33'),
(1085, 1214, 'Sahil', '30', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '100', 'serkan ', '2024-06-26 12:08:19', '2024-06-26 15:35:33'),
(1086, 1219, 'Sahil', '30', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '190', 'serkan ', '2024-06-26 13:11:58', '2024-06-26 15:35:33'),
(1087, 1224, 'Sahil', '30', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2}]', '260', 'serkan ', '2024-06-26 13:52:34', '2024-06-26 15:35:33'),
(1088, 1226, 'Sahil', '3', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"57\",\"product_name\":\"kutu fanta\",\"product_price\":\"60\",\"amount\":1}]', '600', 'selma ', '2024-06-26 16:35:58', '2024-06-26 17:30:01'),
(1089, 1227, 'Sahil', '3', '[{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":2}]', '60', 'selma ', '2024-06-26 16:36:37', '2024-06-26 17:30:01'),
(1090, 1217, 'Sahil', '4', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-26 13:04:42', '2024-06-26 19:01:45'),
(1092, 1223, 'Sahil', '35', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '300', 'serkan ', '2024-06-26 13:39:03', '2024-06-27 08:24:32'),
(1093, 1204, 'Sahil', '9', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":3}]', '390', 'serkan ', '2024-06-25 12:48:16', '2024-06-27 08:24:39'),
(1094, 1234, 'Bahçe', '2', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1}]', '390', 'ibrahim ', '2024-06-27 10:26:14', '2024-06-27 11:02:20'),
(1095, 1236, 'Bahçe', '2', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'ibrahim ', '2024-06-27 10:28:51', '2024-06-27 11:02:20'),
(1096, 1239, 'Bahçe', '2', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '120', 'ibrahim ', '2024-06-27 10:50:28', '2024-06-27 11:02:20'),
(1097, 1232, 'Sahil', '16', '[{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '50', 'serkan ', '2024-06-27 10:09:22', '2024-06-27 12:20:23'),
(1098, 1230, 'Sahil', '1', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '60', 'ibrahim ', '2024-06-27 08:26:23', '2024-06-27 14:03:23'),
(1099, 1231, 'Sahil', '1', '[{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":1}]', '430', 'ibrahim ', '2024-06-27 09:48:44', '2024-06-27 14:03:23'),
(1100, 1242, 'Sahil', '1', '[{\"id\":\"64\",\"product_name\":\"efes malt kutu\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-27 11:30:47', '2024-06-27 14:03:23'),
(1101, 1244, 'Sahil', '1', '[{\"id\":\"64\",\"product_name\":\"efes malt kutu\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-27 11:54:16', '2024-06-27 14:03:23'),
(1102, 1233, 'Sahil', '2', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":3}]', '180', 'ibrahim ', '2024-06-27 10:25:49', '2024-06-27 14:25:16'),
(1103, 1235, 'Sahil', '2', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":2}]', '300', 'ibrahim ', '2024-06-27 10:26:41', '2024-06-27 14:25:16'),
(1104, 1238, 'Sahil', '2', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":2}]', '300', 'ibrahim ', '2024-06-27 10:50:15', '2024-06-27 14:25:16'),
(1105, 1243, 'Sahil', '2', '[{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-27 11:38:41', '2024-06-27 14:25:16'),
(1106, 1250, 'Sahil', '2', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '80', 'serkan ', '2024-06-27 12:25:31', '2024-06-27 14:25:16'),
(1107, 1253, 'Sahil', '2', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":4}]', '240', 'serkan ', '2024-06-27 13:44:18', '2024-06-27 14:25:16'),
(1108, 1237, 'Sahil', '5', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"87\",\"product_name\":\"redbull küçük\",\"product_price\":\"75\",\"amount\":1}]', '335', 'ibrahim ', '2024-06-27 10:37:54', '2024-06-27 16:16:00'),
(1109, 1249, 'Sahil', '5', '[{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '305', 'serkan ', '2024-06-27 12:16:13', '2024-06-27 16:16:00'),
(1110, 1252, 'Sahil', '5', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2}]', '260', 'serkan ', '2024-06-27 13:42:48', '2024-06-27 16:16:00'),
(1111, 1254, 'Sahil', '5', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-27 14:52:33', '2024-06-27 16:16:00'),
(1112, 1251, 'Sahil', '3', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '450', 'serkan ', '2024-06-27 12:31:02', '2024-06-27 16:31:00'),
(1113, 1255, 'Sahil', '3', '[{\"id\":\"110\",\"product_name\":\"amsterdam\",\"product_price\":\"150\",\"amount\":2}]', '300', 'selma ', '2024-06-27 15:23:44', '2024-06-27 16:31:00'),
(1114, 1228, 'Paket', '0', '[{\"id\":\"31\",\"product_name\":\"sucuklu yumurta\",\"product_price\":\"150\",\"amount\":1}]', '150', 'ibrahim ', '2024-06-27 08:24:54', '2024-06-27 18:48:18'),
(1115, 1229, 'Paket', '0', '[{\"id\":\"29\",\"product_name\":\"kahvaltı tabağı\",\"product_price\":\"250\",\"amount\":1}]', '250', 'ibrahim ', '2024-06-27 08:25:14', '2024-06-27 18:48:18'),
(1116, 1241, 'Bahçe', '6', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"92\",\"product_name\":\"köfte ekmek arası\",\"product_price\":\"200\",\"amount\":1}]', '440', 'ibrahim ', '2024-06-27 11:26:43', '2024-06-27 18:48:24'),
(1117, 1245, 'Bahçe', '6', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2},{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":1}]', '120', 'serkan ', '2024-06-27 11:58:42', '2024-06-27 18:48:24'),
(1118, 1240, 'Sahil', '9', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '560', 'ibrahim ', '2024-06-27 11:21:13', '2024-06-27 18:48:31'),
(1119, 1246, 'Sahil', '9', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-27 11:59:35', '2024-06-27 18:48:31'),
(1120, 1247, 'Sahil', '9', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '210', 'serkan ', '2024-06-27 12:11:23', '2024-06-27 18:48:31'),
(1121, 1248, 'Sahil', '9', '[{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":1}]', '30', 'serkan ', '2024-06-27 12:14:17', '2024-06-27 18:48:31'),
(1122, 1256, 'Sahil', '1', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":2},{\"id\":\"59\",\"product_name\":\"kutu meyve suyu şeftali̇\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"139\",\"product_name\":\"semsiye\",\"product_price\":\"500\",\"amount\":1}]', '1100', 'serkan ', '2024-06-28 08:44:50', '2024-06-28 15:07:45'),
(1123, 1258, 'Bahçe', '2', '[{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2},{\"id\":\"58\",\"product_name\":\"kutu gazoz\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '800', 'admin ', '2024-06-28 15:16:05', '2024-06-28 15:34:30'),
(1124, 1257, 'Sahil', '7', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', '705', 'admin ', '2024-06-28 15:09:34', '2024-06-28 16:08:03'),
(1125, 1260, 'Sahil', '7', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'admin ', '2024-06-28 15:35:56', '2024-06-28 16:08:03'),
(1126, 1261, 'Sahil', '7', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', '100', 'admin ', '2024-06-28 15:36:21', '2024-06-28 16:08:03'),
(1127, 1263, 'Sahil', '7', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'admin ', '2024-06-28 15:56:42', '2024-06-28 16:08:03'),
(1128, 1265, 'Sahil', '7', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', '100', 'admin ', '2024-06-28 16:07:26', '2024-06-28 16:08:03'),
(1129, 1264, 'Sahil', '30', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"65\",\"product_name\":\"efes extra\",\"product_price\":\"130\",\"amount\":1}]', '390', 'admin ', '2024-06-28 15:59:27', '2024-06-28 16:46:25'),
(1130, 1259, 'Bahçe', '8', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1}]', '380', 'admin ', '2024-06-28 15:34:45', '2024-06-28 18:25:45'),
(1131, 1262, 'Bahçe', '8', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'admin ', '2024-06-28 15:47:21', '2024-06-28 18:25:45'),
(1132, 1266, 'Paket', '0', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-29 05:57:45', '2024-06-29 05:58:26'),
(1133, 1267, 'Sahil', '8', '[{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"115\",\"product_name\":\"ci̇tos\",\"product_price\":\"50\",\"amount\":1}]', '170', 'serkan ', '2024-06-29 07:08:49', '2024-06-29 11:19:56'),
(1134, 1273, 'Sahil', '9', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"71\",\"product_name\":\"miller 500cl\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"76\",\"product_name\":\"li̇pton kutu karpuz\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"59\",\"product_name\":\"kutu meyve suyu şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '650', 'serkan ', '2024-06-29 11:23:19', '2024-06-29 11:23:50'),
(1136, 1272, 'Bahçe', '6', '[{\"id\":\"135\",\"product_name\":\"manti\",\"product_price\":\"250\",\"amount\":2},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '855', 'selma ', '2024-06-29 10:57:52', '2024-06-29 11:53:54'),
(1137, 1276, 'Bahçe', '6', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-29 11:45:07', '2024-06-29 11:53:54'),
(1138, 1274, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":2}]', '300', 'serkan ', '2024-06-29 11:24:41', '2024-06-29 11:54:56'),
(1139, 1278, 'Bahçe', '8', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":5},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1}]', '825', 'serkan ', '2024-06-29 12:10:53', '2024-06-29 12:57:00'),
(1140, 1280, 'Bahçe', '4', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '255', 'serkan ', '2024-06-29 12:34:09', '2024-06-29 13:08:10'),
(1141, 1281, 'Bahçe', '4', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-29 12:42:27', '2024-06-29 13:08:10'),
(1142, 1268, 'Sahil', '3', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1},{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":1}]', '160', 'ibrahim ', '2024-06-29 08:11:35', '2024-06-29 13:52:21'),
(1143, 1269, 'Sahil', '3', '[{\"id\":\"82\",\"product_name\":\"nescafe2si1arada\",\"product_price\":\"75\",\"amount\":1}]', '75', 'serkan ', '2024-06-29 09:54:01', '2024-06-29 13:52:21'),
(1144, 1282, 'Sahil', '15', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2}]', '260', 'ibrahim ', '2024-06-29 12:50:47', '2024-06-29 14:11:47'),
(1145, 1285, 'Sahil', '15', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"76\",\"product_name\":\"li̇pton kutu karpuz\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1}]', '645', 'serkan ', '2024-06-29 13:51:00', '2024-06-29 14:11:47'),
(1146, 1270, 'Sahil', '2', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":4},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1}]', '305', 'ibrahim ', '2024-06-29 09:59:02', '2024-06-29 15:47:50'),
(1147, 1286, 'Sahil', '2', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":4},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":3},{\"id\":\"60\",\"product_name\":\"kutu meyve suyu vi̇şne\",\"product_price\":\"60\",\"amount\":1}]', '840', 'ibrahim ', '2024-06-29 13:54:11', '2024-06-29 15:47:50'),
(1148, 1271, 'Sahil', '27', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '770', 'serkan ', '2024-06-29 10:36:52', '2024-06-29 16:01:35'),
(1149, 1292, 'Bahçe', '2', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '290', 'selma ', '2024-06-29 14:50:36', '2024-06-29 16:17:07'),
(1150, 1279, 'Paket', '0', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1}]', '240', 'serkan ', '2024-06-29 12:19:20', '2024-06-29 16:47:19'),
(1151, 1288, 'Sahil', '7', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":4}]', '80', 'serkan ', '2024-06-29 14:11:42', '2024-06-29 17:03:22'),
(1152, 1289, 'Sahil', '7', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":4},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1}]', '755', 'serkan ', '2024-06-29 14:12:29', '2024-06-29 17:03:22'),
(1153, 1294, 'Sahil', '7', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":2},{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":3},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1}]', '695', 'ibrahim ', '2024-06-29 15:40:52', '2024-06-29 17:03:22'),
(1154, 1295, 'Sahil', '7', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'ibrahim ', '2024-06-29 16:11:37', '2024-06-29 17:03:22'),
(1155, 1290, 'Sahil', '17', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2}]', '860', 'serkan ', '2024-06-29 14:43:30', '2024-06-29 17:12:21'),
(1156, 1291, 'Sahil', '17', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-29 14:46:28', '2024-06-29 17:12:21'),
(1157, 1275, 'Sahil', '8', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"71\",\"product_name\":\"miller 500cl\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '280', 'serkan ', '2024-06-29 11:33:43', '2024-06-29 17:23:29'),
(1158, 1283, 'Sahil', '8', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '430', 'serkan ', '2024-06-29 13:10:34', '2024-06-29 17:23:29'),
(1159, 1284, 'Sahil', '8', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":2}]', '70', 'serkan ', '2024-06-29 13:15:35', '2024-06-29 17:23:29'),
(1160, 1287, 'Sahil', '8', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-29 14:02:00', '2024-06-29 17:23:29'),
(1161, 1293, 'Sahil', '8', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-29 15:14:21', '2024-06-29 17:23:29'),
(1162, 1296, 'Paket', '0', '[{\"id\":\"64\",\"product_name\":\"efes malt kutu\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-30 06:43:05', '2024-06-30 06:44:23'),
(1163, 1299, 'Sahil', '3', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'ibrahim ', '2024-06-30 07:16:24', '2024-06-30 07:32:07'),
(1164, 1297, 'Bahçe', '4', '[{\"id\":\"28\",\"product_name\":\"serpme kahvaltı(iki kişilik)\",\"product_price\":\"600\",\"amount\":1},{\"id\":\"34\",\"product_name\":\"menemen\",\"product_price\":\"200\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":4}]', '940', 'serkan ', '2024-06-30 06:45:08', '2024-06-30 07:33:19'),
(1165, 1298, 'Bahçe', '4', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2}]', '390', 'serkan ', '2024-06-30 06:58:44', '2024-06-30 07:33:19'),
(1166, 1300, 'Bahçe', '4', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2}]', '390', 'serkan ', '2024-06-30 07:30:16', '2024-06-30 07:33:19'),
(1167, 1303, 'Bahçe', '3', '[{\"id\":\"34\",\"product_name\":\"menemen\",\"product_price\":\"200\",\"amount\":2}]', '400', 'serkan ', '2024-06-30 08:16:30', '2024-06-30 08:19:59'),
(1168, 1304, 'Bahçe', '3', '[{\"id\":\"34\",\"product_name\":\"menemen\",\"product_price\":\"200\",\"amount\":1}]', '200', 'serkan ', '2024-06-30 08:17:39', '2024-06-30 08:19:59'),
(1169, 1312, 'Bahçe', '1', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '270', 'serkan ', '2024-06-30 08:45:34', '2024-06-30 09:09:20'),
(1170, 1313, 'Bahçe', '1', '[{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-30 08:45:55', '2024-06-30 09:09:20'),
(1171, 1315, 'Bahçe', '1', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-30 08:48:52', '2024-06-30 09:09:20'),
(1172, 1317, 'Bahçe', '1', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-30 09:01:20', '2024-06-30 09:09:20'),
(1173, 1319, 'Bahçe', '7', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '160', 'serkan ', '2024-06-30 09:07:00', '2024-06-30 09:29:29'),
(1174, 1322, 'Bahçe', '7', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '120', 'serkan ', '2024-06-30 09:26:29', '2024-06-30 09:29:29'),
(1176, 1325, 'Sahil', '18', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":3}]', '180', 'serkan ', '2024-06-30 09:52:01', '2024-06-30 10:19:13'),
(1177, 1326, 'Sahil', '18', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-30 09:53:11', '2024-06-30 10:19:13'),
(1178, 1331, 'Sahil', '18', '[{\"id\":\"71\",\"product_name\":\"miller 500cl\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-30 10:17:21', '2024-06-30 10:19:13'),
(1179, 1346, 'Bahçe', '4', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"87\",\"product_name\":\"redbull küçük\",\"product_price\":\"75\",\"amount\":1}]', '95', 'serkan ', '2024-06-30 11:15:41', '2024-06-30 11:21:15'),
(1180, 1339, 'Bahçe', '1', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":2}]', '910', 'serkan ', '2024-06-30 10:48:10', '2024-06-30 11:36:00'),
(1181, 1344, 'Bahçe', '1', '[{\"id\":\"114\",\"product_name\":\"1li̇tre li̇pton\",\"product_price\":\"75\",\"amount\":1}]', '75', 'serkan ', '2024-06-30 11:10:24', '2024-06-30 11:36:00'),
(1182, 1347, 'Sahil', '18', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":5}]', '100', 'serkan ', '2024-06-30 11:33:13', '2024-06-30 11:55:15'),
(1183, 1350, 'Bahçe', '4', '[{\"id\":\"34\",\"product_name\":\"menemen\",\"product_price\":\"200\",\"amount\":1}]', '200', 'serkan ', '2024-06-30 11:47:50', '2024-06-30 12:09:22'),
(1184, 1349, 'Bahçe', '2', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '210', 'serkan ', '2024-06-30 11:45:33', '2024-06-30 12:09:38'),
(1185, 1351, 'Bahçe', '1', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":2},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":3},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":2}]', '1240', 'serkan ', '2024-06-30 11:51:01', '2024-06-30 12:45:56'),
(1186, 1308, 'Sahil', '4', '[{\"id\":\"119\",\"product_name\":\"şemsi̇ye set\",\"product_price\":\"700\",\"amount\":1}]', '700', 'serkan ', '2024-06-30 08:26:33', '2024-06-30 12:54:36'),
(1187, 1310, 'Sahil', '4', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2}]', '120', 'serkan ', '2024-06-30 08:28:58', '2024-06-30 12:54:36'),
(1188, 1323, 'Sahil', '4', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1}]', '250', 'serkan ', '2024-06-30 09:35:01', '2024-06-30 12:54:36'),
(1189, 1332, 'Sahil', '4', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1}]', '240', 'serkan ', '2024-06-30 10:21:45', '2024-06-30 12:54:36'),
(1190, 1333, 'Sahil', '4', '[{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '25', 'serkan ', '2024-06-30 10:22:41', '2024-06-30 12:54:36'),
(1191, 1336, 'Sahil', '4', '[{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '25', 'ibrahim ', '2024-06-30 10:36:34', '2024-06-30 12:54:36'),
(1192, 1338, 'Sahil', '4', '[{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '110', 'serkan ', '2024-06-30 10:41:19', '2024-06-30 12:54:36'),
(1193, 1321, 'Sahil', '9', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1}]', '835', 'serkan ', '2024-06-30 09:19:29', '2024-06-30 13:00:51'),
(1194, 1324, 'Sahil', '9', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-30 09:41:11', '2024-06-30 13:00:51'),
(1195, 1348, 'Sahil', '9', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-30 11:37:03', '2024-06-30 13:00:51'),
(1196, 1376, 'Sahil', '18', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":3}]', '180', 'serkan ', '2024-06-30 13:26:07', '2024-06-30 13:47:50'),
(1197, 1381, 'Sahil', '18', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-30 13:36:59', '2024-06-30 13:47:50'),
(1198, 1314, 'Sahil', '40', '[{\"id\":\"113\",\"product_name\":\"bud\",\"product_price\":\"125\",\"amount\":2},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"83\",\"product_name\":\"meyveli soda\",\"product_price\":\"30\",\"amount\":3},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1}]', '495', 'serkan ', '2024-06-30 08:48:42', '2024-06-30 13:50:43'),
(1199, 1316, 'Sahil', '40', '[{\"id\":\"115\",\"product_name\":\"ci̇tos\",\"product_price\":\"50\",\"amount\":1}]', '50', 'serkan ', '2024-06-30 08:49:38', '2024-06-30 13:50:43'),
(1200, 1305, 'Sahil', '3', '[{\"id\":\"109\",\"product_name\":\"4efes malt+ patates\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-30 08:20:43', '2024-06-30 13:56:24'),
(1201, 1307, 'Sahil', '3', '[{\"id\":\"119\",\"product_name\":\"şemsi̇ye set\",\"product_price\":\"700\",\"amount\":1}]', '700', 'serkan ', '2024-06-30 08:26:20', '2024-06-30 13:56:24'),
(1202, 1330, 'Sahil', '3', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '430', 'serkan ', '2024-06-30 10:15:19', '2024-06-30 13:56:24'),
(1203, 1366, 'Sahil', '3', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'ibrahim ', '2024-06-30 12:47:42', '2024-06-30 13:56:24'),
(1204, 1380, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-30 13:33:30', '2024-06-30 14:02:16'),
(1205, 1318, 'Sahil', '2', '[{\"id\":\"116\",\"product_name\":\"corona\",\"product_price\":\"200\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '460', 'serkan ', '2024-06-30 09:05:20', '2024-06-30 14:09:24'),
(1206, 1320, 'Sahil', '2', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-30 09:16:20', '2024-06-30 14:09:24'),
(1207, 1340, 'Sahil', '2', '[{\"id\":\"75\",\"product_name\":\"li̇pton mango\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-30 10:58:55', '2024-06-30 14:09:24'),
(1208, 1354, 'Sahil', '2', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":4}]', '920', 'ibrahim ', '2024-06-30 12:11:37', '2024-06-30 14:09:24'),
(1209, 1361, 'Sahil', '2', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":3}]', '310', 'ibrahim ', '2024-06-30 12:39:57', '2024-06-30 14:09:24'),
(1210, 1389, 'Sahil', '2', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":4}]', '80', 'serkan ', '2024-06-30 14:07:35', '2024-06-30 14:09:24'),
(1211, 1372, 'Sahil', '10', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-30 13:15:35', '2024-06-30 14:10:22'),
(1212, 1388, 'Paket', '0', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":3}]', '450', 'serkan ', '2024-06-30 14:02:48', '2024-06-30 14:25:10'),
(1214, 1387, 'Bahçe', '8', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":3},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":4},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '1200', 'serkan ', '2024-06-30 13:58:35', '2024-06-30 14:47:57'),
(1215, 1328, 'Sahil', '23', '[{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":2},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '160', 'serkan ', '2024-06-30 10:04:17', '2024-06-30 14:48:29'),
(1216, 1342, 'Sahil', '23', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1}]', '620', 'serkan ', '2024-06-30 11:05:21', '2024-06-30 14:48:29'),
(1217, 1343, 'Sahil', '23', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-30 11:06:03', '2024-06-30 14:48:29'),
(1218, 1362, 'Sahil', '23', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'ibrahim ', '2024-06-30 12:40:18', '2024-06-30 14:48:29'),
(1219, 1363, 'Sahil', '23', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '80', 'ibrahim ', '2024-06-30 12:46:09', '2024-06-30 14:48:29'),
(1220, 1383, 'Sahil', '23', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-30 13:37:38', '2024-06-30 14:48:29'),
(1221, 1401, 'Sahil', '23', '[{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":1}]', '70', 'serkan ', '2024-06-30 14:47:25', '2024-06-30 14:48:29'),
(1222, 1386, 'Bahçe', '1', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"45\",\"product_name\":\"nugget 6 adet\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '460', 'serkan ', '2024-06-30 13:48:53', '2024-06-30 14:50:45'),
(1223, 1393, 'Bahçe', '1', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-30 14:11:31', '2024-06-30 14:50:45'),
(1224, 1334, 'Sahil', '16', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'ibrahim ', '2024-06-30 10:32:33', '2024-06-30 15:23:57'),
(1225, 1353, 'Sahil', '16', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":1},{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '850', 'ibrahim ', '2024-06-30 12:11:17', '2024-06-30 15:23:57'),
(1226, 1359, 'Sahil', '16', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"40\",\"amount\":1}]', '40', 'ibrahim ', '2024-06-30 12:31:14', '2024-06-30 15:23:57'),
(1227, 1406, 'Sahil', '16', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3}]', '60', 'serkan ', '2024-06-30 15:14:54', '2024-06-30 15:23:57'),
(1228, 1369, 'Sahil', '9', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '280', 'serkan ', '2024-06-30 13:05:30', '2024-06-30 15:28:22'),
(1229, 1371, 'Sahil', '9', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'mehmet ', '2024-06-30 13:08:43', '2024-06-30 15:28:22'),
(1230, 1385, 'Sahil', '9', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-30 13:45:32', '2024-06-30 15:28:22'),
(1231, 1397, 'Sahil', '9', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":4}]', '80', 'serkan ', '2024-06-30 14:26:34', '2024-06-30 15:28:22'),
(1232, 1341, 'Sahil', '6', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '140', 'serkan ', '2024-06-30 11:01:52', '2024-06-30 15:45:37'),
(1233, 1374, 'Sahil', '6', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":1}]', '330', 'mehmet ', '2024-06-30 13:21:50', '2024-06-30 15:45:37'),
(1234, 1370, 'Sahil', '4', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-30 13:06:04', '2024-06-30 15:49:55'),
(1235, 1373, 'Sahil', '4', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'mehmet ', '2024-06-30 13:19:41', '2024-06-30 15:49:55'),
(1236, 1378, 'Sahil', '4', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', '100', 'serkan ', '2024-06-30 13:31:08', '2024-06-30 15:49:55'),
(1237, 1379, 'Sahil', '4', '[{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":1}]', '150', 'serkan ', '2024-06-30 13:32:03', '2024-06-30 15:49:55'),
(1238, 1391, 'Sahil', '4', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":2},{\"id\":\"77\",\"product_name\":\"bomonti̇ fi̇ltresi̇z\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"57\",\"product_name\":\"kutu fanta\",\"product_price\":\"60\",\"amount\":1}]', '710', 'serkan ', '2024-06-30 14:10:40', '2024-06-30 15:49:55'),
(1239, 1408, 'Sahil', '4', '[{\"id\":\"139\",\"product_name\":\"semsiye\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-30 15:44:28', '2024-06-30 15:49:55'),
(1240, 1352, 'Sahil', '8', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '300', 'serkan ', '2024-06-30 12:04:45', '2024-06-30 15:50:38'),
(1241, 1356, 'Sahil', '8', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-30 12:19:03', '2024-06-30 15:50:38'),
(1242, 1358, 'Sahil', '8', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-30 12:29:48', '2024-06-30 15:50:38'),
(1243, 1360, 'Sahil', '8', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":1}]', '160', 'serkan ', '2024-06-30 12:33:41', '2024-06-30 15:50:38'),
(1244, 1395, 'Sahil', '8', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3}]', '190', 'serkan ', '2024-06-30 14:18:19', '2024-06-30 15:50:38'),
(1245, 1411, 'Sahil', '8', '[{\"id\":\"119\",\"product_name\":\"şemsi̇ye set\",\"product_price\":\"700\",\"amount\":1}]', '700', 'serkan ', '2024-06-30 15:49:16', '2024-06-30 15:50:38'),
(1246, 1335, 'Sahil', '7', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"35\",\"amount\":1}]', '35', 'serkan ', '2024-06-30 10:35:34', '2024-06-30 16:05:42');
INSERT INTO `orders_log` (`id`, `old_id`, `table_area`, `table_number`, `order_content`, `order_total`, `waiter_name`, `table_opening_time`, `order_closing_time`) VALUES
(1247, 1364, 'Sahil', '7', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '455', 'ibrahim ', '2024-06-30 12:47:18', '2024-06-30 16:05:42'),
(1248, 1368, 'Sahil', '7', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', '60', 'serkan ', '2024-06-30 13:01:50', '2024-06-30 16:05:42'),
(1249, 1382, 'Sahil', '7', '[{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"40\",\"amount\":1}]', '40', 'serkan ', '2024-06-30 13:37:21', '2024-06-30 16:05:42'),
(1250, 1367, 'Sahil', '15', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":3},{\"id\":\"58\",\"product_name\":\"kutu gazoz\",\"product_price\":\"60\",\"amount\":2}]', '180', 'ibrahim ', '2024-06-30 12:47:55', '2024-06-30 16:22:34'),
(1251, 1390, 'Sahil', '15', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":2},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":1}]', '755', 'ibrahim ', '2024-06-30 14:07:42', '2024-06-30 16:22:34'),
(1252, 1405, 'Sahil', '15', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-30 15:11:11', '2024-06-30 16:22:34'),
(1253, 1357, 'Sahil', '13', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":3},{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '1140', 'ibrahim ', '2024-06-30 12:26:30', '2024-06-30 16:33:55'),
(1254, 1365, 'Sahil', '13', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":2}]', '200', 'serkan ', '2024-06-30 12:47:33', '2024-06-30 16:33:55'),
(1255, 1377, 'Sahil', '13', '[{\"id\":\"94\",\"product_name\":\"li̇monata\",\"product_price\":\"70\",\"amount\":1}]', '70', 'serkan ', '2024-06-30 13:30:45', '2024-06-30 16:33:55'),
(1256, 1392, 'Sahil', '13', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-30 14:10:54', '2024-06-30 16:33:55'),
(1257, 1396, 'Sahil', '13', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-30 14:25:31', '2024-06-30 16:33:55'),
(1258, 1407, 'Sahil', '13', '[{\"id\":\"29\",\"product_name\":\"kahvaltı tabağı\",\"product_price\":\"250\",\"amount\":1}]', '250', 'serkan ', '2024-06-30 15:18:46', '2024-06-30 16:33:55'),
(1259, 1409, 'Sahil', '13', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-30 15:48:16', '2024-06-30 16:33:55'),
(1260, 1410, 'Sahil', '13', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-30 15:49:00', '2024-06-30 16:33:55'),
(1261, 1384, 'Bahçe', '2', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":1},{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":2},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":3}]', '615', 'serkan ', '2024-06-30 13:40:52', '2024-06-30 16:34:18'),
(1262, 1394, 'Sahil', '10', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":2}]', '390', 'serkan ', '2024-06-30 14:17:55', '2024-06-30 17:19:33'),
(1263, 1404, 'Sahil', '10', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2},{\"id\":\"50\",\"product_name\":\"efes malt\",\"product_price\":\"100\",\"amount\":2}]', '400', 'serkan ', '2024-06-30 15:10:48', '2024-06-30 17:19:33'),
(1264, 1412, 'Sahil', '10', '[{\"id\":\"139\",\"product_name\":\"semsiye\",\"product_price\":\"500\",\"amount\":1}]', '500', 'serkan ', '2024-06-30 15:51:42', '2024-06-30 17:19:33'),
(1265, 1400, 'Sahil', '22', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":2}]', '560', 'ibrahim ', '2024-06-30 14:42:58', '2024-06-30 18:06:32'),
(1266, 1402, 'Sahil', '22', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-30 15:00:20', '2024-06-30 18:06:32'),
(1267, 1413, 'Sahil', '22', '[{\"id\":\"65\",\"product_name\":\"efes extra\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":1},{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '410', 'serkan ', '2024-06-30 15:53:09', '2024-06-30 18:06:32'),
(1268, 1414, 'Sahil', '22', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2}]', '40', 'serkan ', '2024-06-30 16:07:16', '2024-06-30 18:06:32'),
(1269, 1415, 'Sahil', '22', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-06-30 16:08:12', '2024-06-30 18:06:32'),
(1270, 1416, 'Sahil', '22', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'ibrahim ', '2024-06-30 16:16:23', '2024-06-30 18:06:32'),
(1271, 1417, 'Sahil', '22', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":2},{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1}]', '685', 'ibrahim ', '2024-06-30 16:21:38', '2024-06-30 18:06:32'),
(1272, 1301, 'Sahil', '1', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":2},{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"42\",\"product_name\":\"peynir tabağı\",\"product_price\":\"200\",\"amount\":1}]', '540', 'serkan ', '2024-06-30 07:31:55', '2024-06-30 18:35:23'),
(1273, 1302, 'Sahil', '1', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":2}]', '120', 'serkan ', '2024-06-30 08:08:11', '2024-06-30 18:35:23'),
(1274, 1306, 'Sahil', '1', '[{\"id\":\"119\",\"product_name\":\"şemsi̇ye set\",\"product_price\":\"700\",\"amount\":1}]', '700', 'serkan ', '2024-06-30 08:26:01', '2024-06-30 18:35:23'),
(1275, 1309, 'Sahil', '1', '[{\"id\":\"39\",\"product_name\":\"patates(double)\",\"product_price\":\"250\",\"amount\":1}]', '250', 'ibrahim ', '2024-06-30 08:27:36', '2024-06-30 18:35:23'),
(1276, 1311, 'Sahil', '1', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":2}]', '600', 'serkan ', '2024-06-30 08:44:57', '2024-06-30 18:35:23'),
(1277, 1327, 'Sahil', '1', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-30 10:03:02', '2024-06-30 18:35:23'),
(1278, 1337, 'Sahil', '1', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-30 10:38:00', '2024-06-30 18:35:23'),
(1279, 1345, 'Sahil', '1', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-06-30 11:14:04', '2024-06-30 18:35:23'),
(1280, 1398, 'Sahil', '1', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1}]', '60', 'ibrahim ', '2024-06-30 14:38:52', '2024-06-30 18:35:23'),
(1281, 1403, 'Sahil', '1', '[{\"id\":\"30\",\"product_name\":\"sahanda yumurta\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":4}]', '180', 'serkan ', '2024-06-30 15:01:20', '2024-06-30 18:35:23'),
(1282, 1418, 'Sahil', '1', '[{\"id\":\"117\",\"product_name\":\"duble çay\",\"product_price\":\"30\",\"amount\":2}]', '60', 'serkan ', '2024-06-30 16:35:09', '2024-06-30 18:35:23'),
(1283, 1419, 'Sahil', '1', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'ibrahim ', '2024-06-30 16:42:09', '2024-06-30 18:35:23'),
(1285, 1424, 'Sahil', '11', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-07-01 11:05:11', '2024-07-01 11:06:20'),
(1286, 1425, 'Sahil', '11', '[{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":2},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '280', 'serkan ', '2024-07-01 11:06:48', '2024-07-01 14:40:28'),
(1287, 1429, 'Sahil', '11', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1},{\"id\":\"78\",\"product_name\":\"efes özel seri̇\",\"product_price\":\"130\",\"amount\":1}]', '260', 'serkan ', '2024-07-01 12:51:22', '2024-07-01 14:40:28'),
(1288, 1430, 'Sahil', '11', '[{\"id\":\"37\",\"product_name\":\"ayvalıktostu+patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"75\",\"product_name\":\"li̇pton mango\",\"product_price\":\"60\",\"amount\":1}]', '590', 'serkan ', '2024-07-01 12:55:59', '2024-07-01 14:40:28'),
(1289, 1431, 'Sahil', '11', '[{\"id\":\"137\",\"product_name\":\"carlsberg kutu\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-07-01 12:56:13', '2024-07-01 14:40:28'),
(1290, 1421, 'Sahil', '7', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":3},{\"id\":\"76\",\"product_name\":\"li̇pton kutu karpuz\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"90\",\"product_name\":\"soğuk nesscafe vanilyalı\",\"product_price\":\"75\",\"amount\":2},{\"id\":\"107\",\"product_name\":\"ayran\",\"product_price\":\"25\",\"amount\":2},{\"id\":\"108\",\"product_name\":\"şi̇şe ayran\",\"product_price\":\"30\",\"amount\":1}]', '680', 'serkan ', '2024-07-01 10:23:44', '2024-07-01 15:30:05'),
(1291, 1422, 'Sahil', '7', '[{\"id\":\"36\",\"product_name\":\"hamburger+patates\",\"product_price\":\"230\",\"amount\":4}]', '920', 'serkan ', '2024-07-01 10:24:03', '2024-07-01 15:30:05'),
(1292, 1423, 'Sahil', '7', '[{\"id\":\"136\",\"product_name\":\"1 li̇tre cola\",\"product_price\":\"75\",\"amount\":1}]', '75', 'serkan ', '2024-07-01 10:42:56', '2024-07-01 15:30:05'),
(1293, 1428, 'Sahil', '7', '[{\"id\":\"119\",\"product_name\":\"şemsi̇ye set\",\"product_price\":\"700\",\"amount\":1}]', '700', 'serkan ', '2024-07-01 12:49:54', '2024-07-01 15:30:05'),
(1294, 1432, 'Sahil', '7', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1}]', '300', 'serkan ', '2024-07-01 13:07:48', '2024-07-01 15:30:05'),
(1295, 1433, 'Sahil', '7', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":1}]', '130', 'serkan ', '2024-07-01 13:18:16', '2024-07-01 15:30:05'),
(1296, 1434, 'Sahil', '7', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":2}]', '260', 'serkan ', '2024-07-01 13:37:43', '2024-07-01 15:30:05'),
(1297, 1435, 'Sahil', '7', '[{\"id\":\"86\",\"product_name\":\"tuborg\",\"product_price\":\"130\",\"amount\":3},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"73\",\"product_name\":\"li̇pton  ice tea şeftali̇\",\"product_price\":\"60\",\"amount\":1}]', '510', 'serkan ', '2024-07-01 14:04:45', '2024-07-01 15:30:05'),
(1298, 1438, 'Sahil', '2', '[{\"id\":\"38\",\"product_name\":\"patates\",\"product_price\":\"150\",\"amount\":3},{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":2},{\"id\":\"138\",\"product_name\":\"si̇gara böreği̇\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"45\",\"product_name\":\"nugget 6 adet\",\"product_price\":\"100\",\"amount\":1}]', '1000', 'serkan ', '2024-07-01 14:42:03', '2024-07-01 15:55:03'),
(1299, 1426, 'Sahil', '15', '[{\"id\":\"40\",\"product_name\":\"bira tabağı\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"40\",\"amount\":1}]', '360', 'serkan ', '2024-07-01 11:58:33', '2024-07-01 17:04:34'),
(1300, 1436, 'Sahil', '15', '[{\"id\":\"49\",\"product_name\":\"pizza+patates\",\"product_price\":\"240\",\"amount\":2},{\"id\":\"41\",\"product_name\":\"şinitzel\",\"product_price\":\"175\",\"amount\":1}]', '655', 'serkan ', '2024-07-01 14:19:56', '2024-07-01 17:04:34'),
(1301, 1437, 'Sahil', '15', '[{\"id\":\"114\",\"product_name\":\"1li̇tre li̇pton\",\"product_price\":\"75\",\"amount\":1}]', '75', 'serkan ', '2024-07-01 14:41:36', '2024-07-01 17:04:34'),
(1302, 1439, 'Sahil', '15', '[{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1}]', '20', 'serkan ', '2024-07-01 14:46:00', '2024-07-01 17:04:34'),
(1303, 1440, 'Sahil', '15', '[{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"53\",\"product_name\":\"su 0,5\",\"product_price\":\"20\",\"amount\":1},{\"id\":\"84\",\"product_name\":\"sade soda\",\"product_price\":\"25\",\"amount\":1}]', '105', 'serkan ', '2024-07-01 16:07:45', '2024-07-01 17:04:34');

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `products`
--

CREATE TABLE `products` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(250) NOT NULL,
  `category` varchar(250) NOT NULL,
  `price` varchar(20) NOT NULL,
  `image_path` varchar(250) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Tablo döküm verisi `products`
--

INSERT INTO `products` (`id`, `name`, `category`, `price`, `image_path`, `status`) VALUES
(28, 'serpme kahvaltı(iki kişilik)', 'kahvaltı turkish breakfast', '600', 'public/images/products/kahvaltı turkish breakfast-serpme kahvaltı(iki kişilik).png', 1),
(29, 'kahvaltı tabağı', 'kahvaltı turkish breakfast', '250', 'public/images/products/kahvaltı turkish breakfast-kahvaltı tabağı.png', 1),
(30, 'sahanda yumurta', 'kahvaltı turkish breakfast', '100', 'public/images/products/kahvaltı turkish breakfast-sahanda yumurta.png', 1),
(31, 'sucuklu yumurta', 'kahvaltı turkish breakfast', '150', 'public/images/products/kahvaltı turkish breakfast-sucuklu yumurta.png', 1),
(32, 'omlet', 'kahvaltı turkish breakfast', '100', 'public/images/products/kahvaltı turkish breakfast-omlet.png', 1),
(33, 'kaşarlı omlet', 'kahvaltı turkish breakfast', '125', 'public/images/products/kahvaltı turkish breakfast-kaşarlı omlet.png', 1),
(34, 'menemen', 'kahvaltı turkish breakfast', '200', 'public/images/products/kahvaltı turkish breakfast-menemen.png', 1),
(36, 'hamburger+patates', 'aperatifler', '230', 'public/images/products/aperatifler-hamburger çıtır patates ile.png', 1),
(37, 'ayvalıktostu+patates', 'aperatifler', '150', 'public/images/products/aperatifler-ayvalık tostu çıtır patates i̇le.png', 1),
(38, 'patates', 'aperatifler', '150', 'public/images/products/aperatifler-parmak patates.png', 1),
(39, 'patates(double)', 'aperatifler', '250', 'public/images/products/aperatifler-parmak patates(double).png', 1),
(40, 'bira tabağı', 'aperatifler', '300', 'public/images/products/aperatifler-bira tabağı.png', 1),
(41, 'şinitzel', 'aperatifler', '175', 'public/images/products/aperatifler-şinitzel.png', 1),
(42, 'peynir tabağı', 'aperatifler', '200', 'public/images/products/aperatifler-peynir tabağı.png', 1),
(43, 'meyve tabağı(i̇ki kişilik)double', 'aperatifler', '250', 'public/images/products/aperatifler-meyve tabağı(i̇ki kişilik)double.png', 1),
(44, 'karışık çerez', 'aperatifler', '125', 'public/images/products/aperatifler-karışık çerez.png', 1),
(45, 'nugget 6 adet', 'aperatifler', '100', 'public/images/products/aperatifler-nugget 6 adet.png', 1),
(46, 'soğan halkası', 'aperatifler', '100', 'public/images/products/aperatifler-soğan halkası.png', 1),
(47, 'izgara köfte porsiyon', 'izgaralar', '325', 'public/images/products/izgaralar-izgara köfte.png', 0),
(48, 'tavuk şiş porsiyon', 'izgaralar', '275', 'public/images/products/izgaralar-tavuk şiş porsiyon.png', 0),
(49, 'pizza+patates', 'aperatifler', '240', 'public/images/products/aperatifler-pizza çıtır patates ile.png', 1),
(50, 'efes malt', 'alkollüler', '100', 'public/images/products/alkollüler-efes malt.png', 1),
(51, 'çay', 'sıcak i̇çecekler', '20', 'public/images/products/sıcak i̇çecekler-çay.png', 1),
(52, 'türk kahvesi', 'sıcak i̇çecekler', '60', 'public/images/products/sıcak i̇çecekler-türk kahvesi.png', 1),
(53, 'su 0,5', 'soğuk i̇çecekler', '20', 'public/images/products/soğuk i̇çecekler-su 0,5.png', 1),
(54, 'su 1,5 lt', 'soğuk i̇çecekler', '40', 'public/images/products/soğuk i̇çecekler-su 1,5 lt.png', 1),
(55, 'su 5 lt', 'soğuk i̇çecekler', '50', 'public/images/products/soğuk i̇çecekler-su 5 lt.png', 0),
(56, 'pepsi kutu cola', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-pepsi kutu cola.png', 1),
(57, 'kutu fanta', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-kutu fanta.png', 1),
(58, 'kutu gazoz', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-kutu gazoz.png', 1),
(59, 'kutu meyve suyu şeftali̇', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-kutu meyve suyu şeftali̇.png', 1),
(60, 'kutu meyve suyu vi̇şne', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-kutu meyve suyu vi̇şne.png', 1),
(61, 'kutu meyve suyu karışık', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-kutu meyve suyu karışık.png', 1),
(62, 'efes tombul şişe', 'alkollüler', '100', 'public/images/products/alkollüler-efes tombul şişe.png', 0),
(63, 'efes tombul şişe +1', 'alkollüler', '100', 'public/images/products/alkollüler-efes tombul şişe +1.png', 1),
(64, 'efes malt kutu', 'alkollüler', '100', 'public/images/products/alkollüler-efes malt kutu.png', 1),
(65, 'efes extra', 'alkollüler', '130', 'public/images/products/alkollüler-efes extra.png', 1),
(66, 'extra shot', 'alkollüler', '100', 'public/images/products/alkollüler-extra shot.png', 1),
(67, 'belfast', 'alkollüler', '110', 'public/images/products/alkollüler-belfast.png', 1),
(68, 'efes malt mavi kutu', 'alkollüler', '120', 'public/images/products/alkollüler-efes malt mavi kutu.png', 1),
(69, 'bremen yüksek alkollü', 'alkollüler', '100', 'public/images/products/alkollüler-bremen yüksek alkollü.png', 1),
(70, 'bremen kutu', 'alkollüler', '90', 'public/images/products/alkollüler-bremen kutu.png', 1),
(71, 'miller 500cl', 'alkollüler', '130', 'public/images/products/alkollüler-miller 500cl.png', 1),
(72, 'miller 330cl', 'alkollüler', '110', 'public/images/products/alkollüler-miller 330cl.png', 1),
(73, 'li̇pton  ice tea şeftali̇', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-li̇pton  kutu şeftali̇.png', 1),
(74, 'lipton kutu limon', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-li̇pton  kutu li̇mon.png', 1),
(75, 'li̇pton mango', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-li̇pton mango.png', 1),
(76, 'li̇pton kutu karpuz', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-li̇pton kutu karpuz.png', 1),
(77, 'bomonti̇ fi̇ltresi̇z', 'alkollüler', '150', 'public/images/products/alkollüler-bomonti̇ fi̇ltresi̇z.png', 1),
(78, 'efes özel seri̇', 'alkollüler', '130', 'public/images/products/alkollüler-efes özel seri̇.png', 1),
(79, 'özgür test', 'vi̇ski̇ setler', '999', 'public/images/products/viski-özgür test.png', 0),
(80, 'nnn', 'aperatifler', '555', 'public/images/products/aperatifler-nnn.png', 0),
(81, 'özgür test', 'alkollüler', '789', 'public/images/products/alkollüler-özgür test.png', 0),
(82, 'nescafe2si1arada', 'sıcak i̇çecekler', '75', 'public/images/products/sıcak i̇çecekler-nescafe2si1arada.png', 1),
(83, 'meyveli soda', 'soğuk i̇çecekler', '30', 'public/images/products/soğuk i̇çecekler-meyveli soda.png', 1),
(84, 'sade soda', 'soğuk i̇çecekler', '25', 'public/images/products/soğuk i̇çecekler-sade soda.png', 1),
(85, 'carslberg', 'alkollüler', '135', 'public/images/products/alkollüler-carslberg.png', 0),
(86, 'tuborg', 'alkollüler', '130', 'public/images/products/alkollüler-tuborg şişe.png', 1),
(87, 'redbull küçük', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-redbull küçük.png', 1),
(88, 'redbull büyük', 'soğuk i̇çecekler', '125', 'public/images/products/soğuk i̇çecekler-redbull büyük.png', 1),
(89, 'soğuk nescafe orjinal', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-soğuk nescafe orjinal.png', 1),
(90, 'soğuk nesscafe vanilyalı', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-soğuk nesscafe vanilyalı.png', 1),
(91, 'soğuk nescafe cafe latte', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-soğuk nescafe cafe latte.png', 1),
(92, 'köfte ekmek arası', 'aperatifler', '200', 'public/images/products/aperatifler-köfte ekmek arası.png', 0),
(93, 'churchill', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-churchill.png', 1),
(94, 'li̇monata', 'soğuk i̇çecekler', '70', 'public/images/products/soğuk i̇çecekler-li̇monata.png', 1),
(95, 'vi̇ski̇ tek shot', 'vi̇ski̇ setler', '300', 'public/images/products/vi̇ski̇ setler-vi̇ski̇ tek shot.png', 1),
(96, 'chivas 35cl  kova set(redbull, kola, çikolata, meyve tabağı ve çerez ikramı ile)', 'vi̇ski̇ setler', '3000', 'public/images/products/vi̇ski̇ setler-chivas 35cl  kova set(redbull,kola.çikolata,meyve tabağı,ve çerez.ikramı ile).png', 1),
(97, 'chi̇vas 50cl(redbull, kola, çikolata, meyve tabağı, çerez ikramı ile)', 'vi̇ski̇ setler', '3750', 'public/images/products/vi̇ski̇ setler-chi̇vas 50cl(redbull,kola,çikolata,meyve tabağı,çerez ikramı ile).png', 1),
(98, 'chi̇vas 70cl(redbull, kola, çikolata, meyve tabağı ve çerez ikramı ile)', 'vi̇ski̇ setler', '4500', 'public/images/products/vi̇ski̇ setler-chi̇vas 70cl(redbull,kola,çikolata,meyve tabağı çerez ikramı ile).png', 1),
(99, 'i̇stanblue 35cl (redbull, çerez ve meyve tabağı ikramı', 'vodka setler', '2500', 'public/images/products/vodka setler-i̇stanblue 35cl (redbull,çerez,ve meyve tabağı ikramı.png', 1),
(100, 'i̇stanblue 50cl(redbull, çerez ve meyve ikramı)', 'vodka setler', '2800', 'public/images/products/vodka setler-i̇stanblue50cl(redbull,çerez meyve ikramı).png', 1),
(101, 'i̇stanblue 70cl(redbull, çerez ve meyve ikramı)', 'vodka setler', '3150', 'public/images/products/vodka setler-i̇stanblue70cl(redbull,çerez,meyve ikramı).png', 1),
(102, 'istanblue(tek bardak)', 'vodka setler', '250', 'public/images/products/vodka setler-istanblue(tek bardak).png', 1),
(103, 'absolute35cl( redbull,çerez meyve ikramı)', 'vodka setler', '3000', 'public/images/products/vodka setler-absolute35cl( redbull,çerez meyve ikramı).png', 1),
(104, 'absolute 50cl(redbull, çerez ve meyve ikramı)', 'vodka setler', '3500', 'public/images/products/vodka setler-absolute50cl(redbull,çerez ve meyve ikramı).png', 1),
(105, 'absolute 70cl(redbull, çerez, meyve ikramı)', 'vodka setler', '3900', 'public/images/products/vodka setler-absolute70cl(redbull,çerez,meyve ikramı).png', 1),
(106, 'absolute 100cl(redbull, çerez meyve ikramı ile)', 'vodka setler', '4400', 'public/images/products/vodka setler-absolute100cl(redbull,çerez meyve ikramı ile).png', 1),
(107, 'ayran', 'soğuk i̇çecekler', '25', 'public/images/products/soğuk i̇çecekler-ayran.png', 1),
(108, 'şi̇şe ayran', 'soğuk i̇çecekler', '30', 'public/images/products/soğuk i̇çecekler-şi̇şe ayran.png', 1),
(109, '4efes malt+ patates', 'kampanya efes malt patates', '500', 'public/images/products/kampanyaaaaa efes malt-4 efes malt  patates.png', 1),
(110, 'amsterdam', 'alkollüler', '150', 'public/images/products/alkollüler-amsterdam.png', 1),
(111, 'beck\'s', 'alkollüler', '125', 'public/images/products/alkollüler-beck\'s.png', 1),
(112, 'voli̇m yüksek alkol', 'alkollüler', '200', 'public/images/products/alkollüler-voli̇m yüksek alkol.png', 1),
(113, 'bud', 'alkollüler', '125', 'public/images/products/alkollüler-bud.png', 1),
(114, '1li̇tre li̇pton', 'market', '75', 'public/images/products/market-1 li̇tre li̇pton.png', 1),
(115, 'ci̇tos', 'market', '50', 'public/images/products/market-ci̇tos.png', 1),
(116, 'corona', 'alkollüler', '200', 'public/images/products/alkollüler-corona.png', 1),
(117, 'duble çay', 'sıcak i̇çecekler', '30', 'public/images/products/sıcak i̇çecekler-duble çay.png', 1),
(118, 'buz kovasi', 'buz kovasi', '100', 'public/images/products/buz kovasi-buz kovasi.png', 1),
(119, 'şemsi̇ye set', 'şezlong şemsi̇ye', '700', 'public/images/products/şezlong şemsi̇ye-şemsi̇ye set.png', 1),
(120, 'li̇monata shake', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-li̇monata shake.png', 1),
(121, 'soğuk kahve ice latte', 'soğuk i̇çecekler', '100', 'public/images/products/soğuk i̇çecekler-soğuk kahve ice latte.png', 1),
(122, 'san sebasti̇an', 'tatlilar', '140', 'public/images/products/tatlilar-san sebasti̇an.png', 1),
(123, 'lotus cheescake', 'tatlilar', '140', 'public/images/products/tatlilar-lotus cheescake.png', 1),
(124, 'devil\'s pasta', 'tatlilar', '140', 'public/images/products/tatlilar-devil\'s pasta.png', 1),
(125, 'cool lime', 'soğuk i̇çecekler', '100', 'public/images/products/soğuk i̇çecekler-cool lime.png', 1),
(126, 'alkolsüz kokteyl', 'soğuk i̇çecekler', '125', 'public/images/products/soğuk i̇çecekler-alkolsüz kokteyl.png', 1),
(127, 'magnum', 'dondurma', '50', 'public/images/products/dondurma-magnum.png', 1),
(128, 'cornetto', 'dondurma', '45', 'public/images/products/dondurma-cornetto.png', 1),
(129, 'mi̇lkshake çi̇lek', 'soğuk i̇çecekler', '110', 'public/images/products/soğuk i̇çecekler-mi̇lkshake çi̇lek.png', 1),
(130, 'mi̇lkshake karamel', 'soğuk i̇çecekler', '110', 'public/images/products/soğuk i̇çecekler-mi̇lkshake karamel.png', 1),
(131, 'mi̇lkshake çi̇kolata', 'soğuk i̇çecekler', '110', 'public/images/products/soğuk i̇çecekler-mi̇lkshake çi̇kolata.png', 1),
(132, 'frappe farkli aromalarla', 'soğuk i̇çecekler', '110', 'public/images/products/soğuk i̇çecekler-frappe farkli aromalarla.png', 0),
(133, 'ülker çi̇kolatali', 'market', '60', 'public/images/products/market-ülker çi̇kolatali.png', 1),
(134, 'kova takimi', 'market', '200', 'public/images/products/market-kova takimi.png', 1),
(135, 'manti', 'aperatifler', '250', 'public/images/products/aperatifler-manti.png', 1),
(136, '1 li̇tre cola', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-1 li̇tre cola.png', 1),
(137, 'carlsberg kutu', 'alkollüler', '130', 'public/images/products/alkollüler-carlsberg kutu.png', 1),
(138, 'si̇gara böreği̇', 'aperatifler', '100', 'public/images/products/aperatifler-si̇gara böreği̇.png', 1),
(139, 'semsiye', 'şezlog şemsi̇ye 500', '500', 'public/images/products/şezlog şemsi̇ye 500-set.png', 1),
(140, 'kaşarlı menemen', 'kahvaltı turkish breakfast', '230', 'public/images/products/kahvaltı turkish breakfast-kaşarlı menemen.png', 1),
(141, 'cool berry', 'soğuk i̇çecekler', '80', 'public/images/products/soğuk i̇çecekler-cool berry.png', 1),
(142, 'cool plumberry', 'soğuk i̇çecekler', '80', 'public/images/products/soğuk i̇çecekler-cool plumberry.png', 1),
(143, 'cool tropical', 'soğuk i̇çecekler', '80', 'public/images/products/soğuk i̇çecekler-cool tropical.png', 1),
(144, 'kavun frozen', 'soğuk i̇çecekler', '80', 'public/images/products/soğuk i̇çecekler-kavun frozen.png', 1),
(145, 'çilek frozen', 'soğuk i̇çecekler', '80', 'public/images/products/soğuk i̇çecekler-çilek frozen.png', 1),
(146, 'yabanmersini frozen', 'soğuk i̇çecekler', '80', 'public/images/products/soğuk i̇çecekler-yabanmersini frozen.png', 1),
(147, 'karpuz frozen', 'soğuk i̇çecekler', '80', 'public/images/products/soğuk i̇çecekler-karpuz frozen.png', 1);

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `sub_users`
--

CREATE TABLE `sub_users` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(200) NOT NULL,
  `surname` varchar(200) NOT NULL,
  `session_name` varchar(500) NOT NULL,
  `token` varchar(250) NOT NULL,
  `image_path` varchar(500) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Tablo döküm verisi `sub_users`
--

INSERT INTO `sub_users` (`id`, `name`, `surname`, `session_name`, `token`, `image_path`, `status`) VALUES
(1, 'ibrahim', '', 'ibrahim', '2FHBQqd7tiHskTcKQI3vFvGL5TORSEgdSPf5LKuCMiyzcRkqwdv3FgJVpJzuJdREvTkxasgJoWx4ffvaxPo3hqe59qE0qOszsKBMcVftVhEc94YU2d8o1RqCyRPbKDXLpTcRgkh3uLOD2amoZQSKJ8ikXFzufVVbuWI3KzE94O1UwOVMJz7hLl8MDdGm78a2puT0LDv2', 'public/images/users/ibrahim.jpg', 1),
(3, 'serkan', '', 'serkan', 'DfMcPMkeXSbY1WQpVxqWpXH7EGrU6ewqiflKuK2OKFcJglXDqpyUxkilpDMgWraMhvJ22IdfRHqZwfyJIDz6ekMyzK1V0WyvlRLZl0L3gjt821lbssrDJF9xUvSBh6uzQFZLosygMZ2xex4zGp7DUi9W2acEYrz4yydizPGFMfeEKdqJob8cFtdiL3A9LtQBX3Z2gQj0', 'public/images/users/logo.jpg', 1),
(4, 'mehmet', '', 'mehmet', 'TFryStGOr5P5TffDCjvgxfiYy26bGlreqf7FtVCktHZSKH0le1Jj0gE0tFxbMVLh5bztGdUyjm74ekYiPIIDQuv5kMv8yC0hRdxK42z785HfiZlKMco7mU2fa3a1GbodcILfb0KaM0edk0ECDmaXs5bkm4WpD6rVeDDcmFIKKDtWb3tPTZymRm8dALzVQ7OMHCJIwlsj', 'public/images/users/logo.jpg', 1),
(5, 'selma', '', 'selma', 'hTkYOlk9fUmwZWW5ahU3Y9ll7YrJZDlW3mpRalJMjl6XXujw7eFFq9loQc1fHzrYp3TlWZlofqjfkyYGLAl94pvFXWfO0YM704x372X9aH49IIDgqwISV1YiS576xTZFeXXyx1AHaKxJqa1TG2tSpRQeHJ1WuT4r7ZDfZLsks79gwd67TjQ6ZHBxMF2alQWOmmIms7EV', 'public/images/users/logo.jpg', 1),
(6, 'admin', '', 'admin', 'jiq5GJ4s1ipDP3iWpiHwXqqAX8Bhb2x2hMBEc1PC8pElyH4qrvUG66Vs8cjrSczFmBDcOvh6gg3ePZTfv270daEYvD1xV4Or9uexGmBHbSAehi3wM7Ko3HqvfeHOdtJsQkF3fRIzOPd46gEpEhoIiaRg4XjDFGVFQVV5jVKiRujYUVVC6YKzd16kyTX7F6cBOxWksAmD', 'public/images/users/logo.jpg', 1);

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `system_users`
--

CREATE TABLE `system_users` (
  `id` int(10) UNSIGNED NOT NULL,
  `email` varchar(600) NOT NULL,
  `password` varchar(50) NOT NULL,
  `token` varchar(250) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Tablo döküm verisi `system_users`
--

INSERT INTO `system_users` (`id`, `email`, `password`, `token`) VALUES
(1, 'eldenselma13@gmail.com', 'fikri-1881-boluk', 'wT7Qkglp0UOv3Jth41XjHWxRQ4FVkafQJ6hrMTpkhaQRPFvI5SxrOiFauwcu3KZW52t3XZgaauFcA0fLWk0WkPdc6EAmmDovD4lCBJejD2KOaYmhrVkBGTD91cKeufklwqkhqrbWO47Q46MQdrBVFUUkCx62zHdJfkht0Lk0WL4u7cK2ZWP9Cjm1bujpavgIuuZSEhpT');

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `tables`
--

CREATE TABLE `tables` (
  `id` int(10) UNSIGNED NOT NULL,
  `table_area` varchar(150) NOT NULL,
  `table_area_view_name` varchar(200) NOT NULL,
  `table_number` smallint(6) NOT NULL,
  `table_status` varchar(50) NOT NULL,
  `table_amount` varchar(15) NOT NULL,
  `first_waiter` varchar(250) NOT NULL,
  `opening_time` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Tablo döküm verisi `tables`
--

INSERT INTO `tables` (`id`, `table_area`, `table_area_view_name`, `table_number`, `table_status`, `table_amount`, `first_waiter`, `opening_time`) VALUES
(1, 'Bahçe', 'Bahçe', 1, 'close', '0', '@@@', '2024-06-30 14:50:45'),
(2, 'Bahçe', 'Bahçe', 2, 'close', '0', '@@@', '2024-06-30 16:34:18'),
(3, 'Bahçe', 'Bahçe', 3, 'close', '0', '@@@', '2024-06-30 08:19:59'),
(4, 'Bahçe', 'Bahçe', 4, 'close', '0', '@@@', '2024-06-30 12:09:22'),
(5, 'Bahçe', 'Bahçe', 5, 'close', '0', '@@@', '2024-06-23 07:41:57'),
(6, 'Bahçe', 'Bahçe', 6, 'close', '0', '@@@', '2024-06-29 11:53:54'),
(7, 'Bahçe', 'Bahçe', 7, 'close', '0', '@@@', '2024-06-30 09:29:29'),
(8, 'Bahçe', 'Bahçe', 8, 'close', '0', '@@@', '2024-06-30 14:47:57'),
(9, 'Bahçe', 'Bahçe', 9, 'close', '0', '@@@', '2024-06-18 22:57:45'),
(10, 'Bahçe', 'Bahçe', 10, 'close', '0', '@@@', '2024-06-19 04:00:45'),
(14, 'Paket', 'Paket', 0, 'close', '0', '@@@', '2024-06-30 14:25:10'),
(15, 'Sahil', 'Sahil', 1, 'close', '0', '@@@', '2024-06-30 18:35:23'),
(16, 'Sahil', 'Sahil', 2, 'close', '0', '@@@', '2024-07-01 15:55:03'),
(17, 'Sahil', 'Sahil', 3, 'close', '0', '@@@', '2024-06-30 13:56:24'),
(18, 'Sahil', 'Sahil', 4, 'close', '0', '@@@', '2024-06-30 15:49:55'),
(19, 'Sahil', 'Sahil', 5, 'close', '0', '@@@', '2024-06-27 16:16:00'),
(20, 'Sahil', 'Sahil', 6, 'close', '0', '@@@', '2024-06-30 15:45:37'),
(21, 'Sahil', 'Sahil', 7, 'close', '0', '@@@', '2024-07-01 15:30:05'),
(22, 'Sahil', 'Sahil', 8, 'close', '0', '@@@', '2024-06-30 15:50:38'),
(23, 'Sahil', 'Sahil', 9, 'close', '0', '@@@', '2024-06-30 15:28:22'),
(24, 'Sahil', 'Sahil', 10, 'close', '0', '@@@', '2024-06-30 17:19:33'),
(25, 'Sahil', 'Sahil', 11, 'close', '0', '@@@', '2024-07-01 14:40:28'),
(26, 'Sahil', 'Sahil', 12, 'close', '0', '@@@', '2024-06-23 14:26:17'),
(27, 'Sahil', 'Sahil', 13, 'close', '0', '@@@', '2024-06-30 16:33:55'),
(28, 'Sahil', 'Sahil', 14, 'close', '0', '@@@', '2024-06-19 16:45:22'),
(29, 'Sahil', 'Sahil', 15, 'close', '0', '@@@', '2024-07-01 17:04:34'),
(30, 'Sahil', 'Sahil', 16, 'close', '0', '@@@', '2024-06-30 15:23:57'),
(31, 'Sahil', 'Sahil', 17, 'close', '0', '@@@', '2024-06-29 17:12:21'),
(32, 'Sahil', 'Sahil', 18, 'close', '0', '@@@', '2024-06-30 13:47:50'),
(33, 'Sahil', 'Sahil', 19, 'close', '0', '@@@', '2024-06-23 14:59:55'),
(34, 'Sahil', 'Sahil', 20, 'open', '1390', 'ibrahim ', '2024-06-30 12:16:59'),
(35, 'Sahil', 'Sahil', 21, 'close', '0', '@@@', '2024-06-21 06:19:31'),
(36, 'Sahil', 'Sahil', 22, 'close', '0', '@@@', '2024-06-30 18:06:32'),
(37, 'Sahil', 'Sahil', 23, 'close', '0', '@@@', '2024-06-30 14:48:29'),
(38, 'Sahil', 'Sahil', 24, 'close', '0', '@@@', '2024-06-23 13:52:32'),
(39, 'Sahil', 'Sahil', 25, 'close', '0', '@@@', '2024-06-21 06:19:41'),
(40, 'Sahil', 'Sahil', 26, 'close', '0', '@@@', '2024-06-22 15:03:20'),
(41, 'Sahil', 'Sahil', 27, 'close', '0', '@@@', '2024-06-29 16:01:35'),
(42, 'Sahil', 'Sahil', 28, 'close', '0', '@@@', '2024-06-26 14:11:56'),
(43, 'Sahil', 'Sahil', 29, 'close', '0', '@@@', '2024-06-23 14:20:31'),
(44, 'Sahil', 'Sahil', 30, 'close', '0', '@@@', '2024-06-28 16:46:25'),
(45, 'Sahil', 'Sahil', 31, 'close', '0', '@@@', '2024-06-21 06:19:50'),
(46, 'Sahil', 'Sahil', 32, 'close', '0', '@@@', '2024-06-15 06:58:54'),
(47, 'Sahil', 'Sahil', 33, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(48, 'Sahil', 'Sahil', 34, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(49, 'Sahil', 'Sahil', 35, 'close', '0', '@@@', '2024-06-27 08:24:32'),
(50, 'Sahil', 'Sahil', 36, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(51, 'Sahil', 'Sahil', 37, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(52, 'Sahil', 'Sahil', 38, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(53, 'Sahil', 'Sahil', 39, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(54, 'Sahil', 'Sahil', 40, 'close', '0', '@@@', '2024-06-30 13:50:43'),
(55, 'Sahil', 'Sahil', 41, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(56, 'Sahil', 'Sahil', 42, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(57, 'Sahil', 'Sahil', 43, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(58, 'Sahil', 'Sahil', 44, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(59, 'Sahil', 'Sahil', 45, 'close', '0', '@@@', '2024-06-20 16:40:32'),
(60, 'Sahil', 'Sahil', 46, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(61, 'Sahil', 'Sahil', 47, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(62, 'Sahil', 'Sahil', 48, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(63, 'Sahil', 'Sahil', 49, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(64, 'Sahil', 'Sahil', 50, 'close', '0', '@@@', '2024-06-21 16:04:41');

-- --------------------------------------------------------

--
-- Tablo için tablo yapısı `table_areas`
--

CREATE TABLE `table_areas` (
  `id` int(10) UNSIGNED NOT NULL,
  `area` varchar(100) NOT NULL,
  `image_path` varchar(600) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Tablo döküm verisi `table_areas`
--

INSERT INTO `table_areas` (`id`, `area`, `image_path`) VALUES
(1, 'Bahçe', 'public/images/users/ibrahim.jpg'),
(2, 'Sahil', 'public/images/users/ibrahim.jpg'),
(3, 'Paket', 'public/images/users/ibrahim.jpg');

--
-- Dökümü yapılmış tablolar için indeksler
--

--
-- Tablo için indeksler `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Tablo için indeksler `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`);

--
-- Tablo için indeksler `orders_log`
--
ALTER TABLE `orders_log`
  ADD PRIMARY KEY (`id`);

--
-- Tablo için indeksler `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- Tablo için indeksler `sub_users`
--
ALTER TABLE `sub_users`
  ADD PRIMARY KEY (`id`);

--
-- Tablo için indeksler `system_users`
--
ALTER TABLE `system_users`
  ADD PRIMARY KEY (`id`);

--
-- Tablo için indeksler `tables`
--
ALTER TABLE `tables`
  ADD PRIMARY KEY (`id`);

--
-- Tablo için indeksler `table_areas`
--
ALTER TABLE `table_areas`
  ADD PRIMARY KEY (`id`);

--
-- Dökümü yapılmış tablolar için AUTO_INCREMENT değeri
--

--
-- Tablo için AUTO_INCREMENT değeri `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- Tablo için AUTO_INCREMENT değeri `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1441;

--
-- Tablo için AUTO_INCREMENT değeri `orders_log`
--
ALTER TABLE `orders_log`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1304;

--
-- Tablo için AUTO_INCREMENT değeri `products`
--
ALTER TABLE `products`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=148;

--
-- Tablo için AUTO_INCREMENT değeri `sub_users`
--
ALTER TABLE `sub_users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Tablo için AUTO_INCREMENT değeri `system_users`
--
ALTER TABLE `system_users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Tablo için AUTO_INCREMENT değeri `tables`
--
ALTER TABLE `tables`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- Tablo için AUTO_INCREMENT değeri `table_areas`
--
ALTER TABLE `table_areas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

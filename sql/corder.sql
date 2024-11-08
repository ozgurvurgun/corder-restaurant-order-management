-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 08, 2024 at 03:11 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `corder`
--

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(700) NOT NULL,
  `image_path` varchar(1000) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
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
-- Table structure for table `orders`
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
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `table_area`, `table_number`, `order_content`, `order_total`, `waiter_name`, `order_note`, `order_time`, `is_table_open`, `is_printed`, `custom`) VALUES
(4214, 'Bahçe', '2', '[{\"id\":\"51\",\"product_name\":\"çay\",\"product_price\":\"20\",\"amount\":5}]', 100, 'serkan ', 'Yanlarına limon', '2024-11-08 14:01:09', 1, 0, 'x'),
(4215, 'Bahçe', '2', '[{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1},{\"id\":\"54\",\"product_name\":\"su 1,5 lt\",\"product_price\":\"40\",\"amount\":1}]', 100, 'serkan ', '', '2024-11-08 14:01:36', 1, 0, 'x'),
(4216, 'Bahçe', '2', '[{\"id\":\"30\",\"product_name\":\"sahanda yumurta\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"34\",\"product_name\":\"menemen\",\"product_price\":\"200\",\"amount\":1}]', 300, 'serkan ', 'Menemen de soğan yok!!', '2024-11-08 14:02:27', 1, 0, 'x'),
(4217, 'Paket', '0', '[{\"id\":\"47\",\"product_name\":\"izgara köfte porsiyon\",\"product_price\":\"300\",\"amount\":1},{\"id\":\"56\",\"product_name\":\"pepsi kutu cola\",\"product_price\":\"60\",\"amount\":1}]', 360, 'serkan ', '', '2024-11-08 14:04:27', 1, 0, 'x'),
(4218, 'Bahçe', '9', '[{\"id\":\"122\",\"product_name\":\"san sebasti̇an\",\"product_price\":\"110\",\"amount\":1},{\"id\":\"123\",\"product_name\":\"lotus cheescake\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"52\",\"product_name\":\"türk kahvesi\",\"product_price\":\"60\",\"amount\":2}]', 330, 'serkan ', 'Kahveler orta', '2024-11-08 14:05:02', 1, 0, 'x'),
(4219, 'Bahçe', '1', '[{\"id\":\"63\",\"product_name\":\"efes tombul şişe +1\",\"product_price\":\"100\",\"amount\":1}]', 100, 'fiko ', '', '2024-11-08 14:07:58', 1, 0, 'x');

--
-- Triggers `orders`
--
DELIMITER $$
CREATE TRIGGER `DeleteOrder` AFTER DELETE ON `orders` FOR EACH ROW INSERT INTO orders_log(old_id, table_area, table_number, order_content, order_total, waiter_name, table_opening_time) VALUES(OLD.id, OLD.table_area, OLD.table_number, OLD.order_content, OLD.order_total, OLD.waiter_name, OLD.order_time)
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `orders_log`
--

CREATE TABLE `orders_log` (
  `id` int(10) UNSIGNED NOT NULL,
  `old_id` int(10) UNSIGNED NOT NULL,
  `table_area` varchar(10) NOT NULL,
  `table_number` varchar(40) NOT NULL,
  `order_content` varchar(2500) NOT NULL,
  `order_total` varchar(40) NOT NULL,
  `waiter_name` varchar(500) NOT NULL,
  `table_opening_time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `order_closing_time` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders_log`
--

INSERT INTO `orders_log` (`id`, `old_id`, `table_area`, `table_number`, `order_content`, `order_total`, `waiter_name`, `table_opening_time`, `order_closing_time`) VALUES
(4079, 4213, 'Bahçe', '1', '[{\"id\":\"28\",\"product_name\":\"serpme kahvaltı(iki kişilik)\",\"product_price\":\"600\",\"amount\":1},{\"id\":\"30\",\"product_name\":\"sahanda yumurta\",\"product_price\":\"100\",\"amount\":1},{\"id\":\"31\",\"product_name\":\"sucuklu yumurta\",\"product_price\":\"150\",\"amount\":1}]', '850', 'serkan ', '2024-11-08 13:57:10', '2024-11-08 14:00:29');

-- --------------------------------------------------------

--
-- Table structure for table `products`
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
-- Dumping data for table `products`
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
(43, 'meyve tabağı(i̇ki kişilik)double', 'aperatifler', '200', 'public/images/products/aperatifler-meyve tabağı(i̇ki kişilik)double.png', 1),
(44, 'karışık çerez', 'aperatifler', '125', 'public/images/products/aperatifler-karışık çerez.png', 1),
(45, 'nugget 6 adet', 'aperatifler', '100', 'public/images/products/aperatifler-nugget 6 adet.png', 1),
(46, 'soğan halkası', 'aperatifler', '100', 'public/images/products/aperatifler-soğan halkası.png', 1),
(47, 'izgara köfte porsiyon', 'izgaralar', '300', 'public/images/products/izgaralar-izgara köfte.png', 1),
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
(66, 'extra shot', 'alkollüler', '100', 'public/images/products/alkollüler-extra shot.png', 0),
(67, 'belfast', 'alkollüler', '110', 'public/images/products/alkollüler-belfast.png', 1),
(68, 'efes malt mavi kutu', 'alkollüler', '120', 'public/images/products/alkollüler-efes malt mavi kutu.png', 1),
(69, 'bremen yüksek alkollü', 'alkollüler', '100', 'public/images/products/alkollüler-bremen yüksek alkollü.png', 1),
(70, 'bremen kutu', 'alkollüler', '90', 'public/images/products/alkollüler-bremen kutu.png', 1),
(71, 'miller 500cl', 'alkollüler', '130', 'public/images/products/alkollüler-miller 500cl.png', 1),
(72, 'miller 330cl', 'alkollüler', '120', 'public/images/products/alkollüler-miller 330cl.png', 1),
(73, 'lipton şeftali', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-li̇pton  kutu şeftali̇.png', 1),
(74, 'lipton kutu limon', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-li̇pton  kutu li̇mon.png', 1),
(75, 'li̇pton mango', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-li̇pton mango.png', 1),
(76, 'li̇pton kutu karpuz', 'soğuk i̇çecekler', '60', 'public/images/products/soğuk i̇çecekler-li̇pton kutu karpuz.png', 1),
(77, 'bomonti̇ fi̇ltresi̇z', 'alkollüler', '150', 'public/images/products/alkollüler-bomonti̇ fi̇ltresi̇z.png', 1),
(78, 'efes özel seri̇', 'alkollüler', '130', 'public/images/products/alkollüler-efes özel seri̇.png', 1),
(79, 'özgür test', 'vi̇ski̇ setler', '999', 'public/images/products/viski-özgür test.png', 0),
(80, 'nnn', 'aperatifler', '555', 'public/images/products/aperatifler-nnn.png', 0),
(81, 'özgür test', 'alkollüler', '1', 'public/images/products/alkollüler-özgür test.png', 0),
(82, 'nescafe2si1arada', 'sıcak i̇çecekler', '60', 'public/images/products/sıcak i̇çecekler-nescafe2si1arada.png', 1),
(83, 'meyveli soda', 'soğuk i̇çecekler', '30', 'public/images/products/soğuk i̇çecekler-meyveli soda.png', 1),
(84, 'sade soda', 'soğuk i̇çecekler', '25', 'public/images/products/soğuk i̇çecekler-sade soda.png', 1),
(85, 'carslberg', 'alkollüler', '135', 'public/images/products/alkollüler-carslberg.png', 1),
(86, 'tuborg', 'alkollüler', '130', 'public/images/products/alkollüler-tuborg.png', 1),
(87, 'redbull küçük', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-redbull küçük.png', 1),
(88, 'redbull büyük', 'soğuk i̇çecekler', '125', 'public/images/products/soğuk i̇çecekler-redbull büyük.png', 1),
(89, 'soğuk nescafe orjinal', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-soğuk nescafe orjinal.png', 1),
(90, 'soğuk nesscafe vanilyalı', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-soğuk nesscafe vanilyalı.png', 1),
(91, 'soğuk nescafe cafe latte', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-soğuk nescafe cafe latte.png', 1),
(92, 'köfte ekmek arası', 'aperatifler', '200', 'public/images/products/aperatifler-köfte ekmek arası.png', 1),
(93, 'churchill', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-churchill.png', 1),
(94, 'li̇monata', 'soğuk i̇çecekler', '70', 'public/images/products/soğuk i̇çecekler-li̇monata.png', 1),
(95, 'vi̇ski̇ tek shot', 'vi̇ski̇ setler', '300', 'public/images/products/vi̇ski̇ setler-vi̇ski̇ tek shot.png', 1),
(96, 'chivas 35cl  kova set(redbull, kola, çikolata, meyve tabağı ve çerez ikramı ile)', 'vi̇ski̇ setler', '2200', 'public/images/products/vi̇ski̇ setler-chivas 35cl  kova set(redbull,kola.çikolata,meyve tabağı,ve çerez.ikramı ile).png', 1),
(97, 'chi̇vas 50cl(redbull, kola, çikolata, meyve tabağı, çerez ikramı ile)', 'vi̇ski̇ setler', '2750', 'public/images/products/vi̇ski̇ setler-chi̇vas 50cl(redbull,kola,çikolata,meyve tabağı,çerez ikramı ile).png', 1),
(98, 'chi̇vas 70cl(redbull, kola, çikolata, meyve tabağı ve çerez ikramı ile)', 'vi̇ski̇ setler', '3250', 'public/images/products/vi̇ski̇ setler-chi̇vas 70cl(redbull,kola,çikolata,meyve tabağı çerez ikramı ile).png', 1),
(99, 'i̇stanblue 35cl (redbull, çerez ve meyve tabağı ikramı', 'vodka setler', '2000', 'public/images/products/vodka setler-i̇stanblue 35cl (redbull,çerez,ve meyve tabağı ikramı.png', 1),
(100, 'i̇stanblue 50cl(redbull, çerez ve meyve ikramı)', 'vodka setler', '2250', 'public/images/products/vodka setler-i̇stanblue50cl(redbull,çerez meyve ikramı).png', 1),
(101, 'i̇stanblue 70cl(redbull, çerez ve meyve ikramı)', 'vodka setler', '2750', 'public/images/products/vodka setler-i̇stanblue70cl(redbull,çerez,meyve ikramı).png', 1),
(102, 'istanblue(tek bardak)', 'vodka setler', '250', 'public/images/products/vodka setler-istanblue(tek bardak).png', 1),
(103, 'absolute35cl( redbull,çerez meyve ikramı)', 'vodka setler', '3000', 'public/images/products/vodka setler-absolute35cl( redbull,çerez meyve ikramı).png', 1),
(104, 'absolute 50cl(redbull, çerez ve meyve ikramı)', 'vodka setler', '3500', 'public/images/products/vodka setler-absolute50cl(redbull,çerez ve meyve ikramı).png', 1),
(105, 'absolute 70cl(redbull, çerez, meyve ikramı)', 'vodka setler', '3900', 'public/images/products/vodka setler-absolute70cl(redbull,çerez,meyve ikramı).png', 1),
(106, 'absolute 100cl(redbull, çerez meyve ikramı ile)', 'vodka setler', '4400', 'public/images/products/vodka setler-absolute100cl(redbull,çerez meyve ikramı ile).png', 1),
(107, 'ayran', 'soğuk i̇çecekler', '25', 'public/images/products/soğuk i̇çecekler-ayran.png', 1),
(108, 'şi̇şe ayran', 'soğuk i̇çecekler', '30', 'public/images/products/soğuk i̇çecekler-şi̇şe ayran.png', 1),
(109, '4efes malt patates', 'kampanya efes malt patates', '500', 'public/images/products/kampanyaaaaa efes malt-4 efes malt  patates.png', 1),
(110, 'amsterdam', 'alkollüler', '150', 'public/images/products/alkollüler-amsterdam.png', 1),
(111, 'beck\'s', 'alkollüler', '125', 'public/images/products/alkollüler-beck\'s.png', 1),
(112, 'voli̇m yüksek alkol', 'alkollüler', '200', 'public/images/products/alkollüler-voli̇m yüksek alkol.png', 0),
(113, 'bud', 'alkollüler', '125', 'public/images/products/alkollüler-bud.png', 1),
(114, '1li̇tre li̇pton', 'market', '75', 'public/images/products/market-1 li̇tre li̇pton.png', 1),
(115, 'ci̇tos', 'market', '50', 'public/images/products/market-ci̇tos.png', 1),
(116, 'corona', 'alkollüler', '200', 'public/images/products/alkollüler-corona.png', 1),
(117, 'duble çay', 'sıcak i̇çecekler', '30', 'public/images/products/sıcak i̇çecekler-duble çay.png', 1),
(118, 'buz kovasi', 'buz kovasi', '100', 'public/images/products/buz kovasi-buz kovasi.png', 1),
(119, 'şemsi̇ye set', 'şezlong şemsi̇ye', '700', 'public/images/products/şezlong şemsi̇ye-şemsi̇ye set.png', 1),
(120, 'li̇monata shake', 'soğuk i̇çecekler', '75', 'public/images/products/soğuk i̇çecekler-li̇monata shake.png', 1),
(121, 'soğuk kahve ice latte', 'soğuk i̇çecekler', '100', 'public/images/products/soğuk i̇çecekler-soğuk kahve ice latte.png', 1),
(122, 'san sebasti̇an', 'tatlilar', '110', 'public/images/products/tatlilar-san sebasti̇an.png', 1),
(123, 'lotus cheescake', 'tatlilar', '100', 'public/images/products/tatlilar-lotus cheescake.png', 1),
(124, 'devil\'s pasta', 'tatlilar', '100', 'public/images/products/tatlilar-devil\'s pasta.png', 1),
(125, 'cool lime', 'soğuk i̇çecekler', '100', 'public/images/products/soğuk i̇çecekler-cool lime.png', 1),
(126, 'alkolsüz kokteyl', 'soğuk i̇çecekler', '125', 'public/images/products/soğuk i̇çecekler-alkolsüz kokteyl.png', 1),
(127, 'magnum', 'dondurma', '50', 'public/images/products/dondurma-magnum.png', 1),
(128, 'cornetto', 'dondurma', '45', 'public/images/products/dondurma-cornetto.png', 1),
(129, 'mi̇lkshake çi̇lek', 'soğuk i̇çecekler', '110', 'public/images/products/soğuk i̇çecekler-mi̇lkshake çi̇lek.png', 1),
(130, 'mi̇lkshake karamel', 'soğuk i̇çecekler', '110', 'public/images/products/soğuk i̇çecekler-mi̇lkshake karamel.png', 1),
(131, 'mi̇lkshake çi̇kolata', 'soğuk i̇çecekler', '110', 'public/images/products/soğuk i̇çecekler-mi̇lkshake çi̇kolata.png', 1),
(132, 'frappe farkli aromalarla', 'soğuk i̇çecekler', '110', 'public/images/products/soğuk i̇çecekler-frappe farkli aromalarla.png', 0),
(133, 'ülker çi̇kolatali', 'market', '60', 'public/images/products/market-ülker çi̇kolatali.png', 0),
(134, 'kova takimi', 'market', '150', 'public/images/products/market-kova takimi.png', 1),
(135, 'manti', 'aperatifler', '200', 'public/images/products/aperatifler-manti.png', 1),
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
(147, 'karpuz frozen', 'soğuk i̇çecekler', '80', 'public/images/products/soğuk i̇çecekler-karpuz frozen.png', 1),
(148, 'cheesburger hamburger', 'aperatifler', '240', 'public/images/products/aperatifler-cheesburger hamburger.png', 1),
(149, 'market ürünü', 'market', '100', 'public/images/products/market-market ürünü.png', 1),
(150, 'market', 'market', '100', 'public/images/products/market-market.png', 1),
(151, '1 litre cola', 'market', '75', 'public/images/products/market-1 litre cola.png', 1),
(152, 'blanc', 'alkollüler', '130', 'public/images/products/alkollüler-blanc.png', 1),
(153, 'bileklik', 'şezlong şemsi̇ye', '20', 'public/images/products/şezlong şemsi̇ye-bileklik.png', 1),
(154, 'bileklik', 'şezlog şemsi̇ye 500', '20', 'public/images/products/şezlog şemsi̇ye 500-bileklik.png', 1),
(155, 'sütlü nescafe', 'sıcak i̇çecekler', '75', 'public/images/products/sıcak i̇çecekler-sütlü nescafe.png', 1);

-- --------------------------------------------------------

--
-- Table structure for table `sub_users`
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
-- Dumping data for table `sub_users`
--

INSERT INTO `sub_users` (`id`, `name`, `surname`, `session_name`, `token`, `image_path`, `status`) VALUES
(3, 'serkan', '', 'serkan', 'DfMcPMkeXSbY1WQpVxqWpXH7EGrU6ewqiflKuK2OKFcJglXDqpyUxkilpDMgWraMhvJ22IdfRHqZwfyJIDz6ekMyzK1V0WyvlRLZl0L3gjt821lbssrDJF9xUvSBh6uzQFZLosygMZ2xex4zGp7DUi9W2acEYrz4yydizPGFMfeEKdqJob8cFtdiL3A9LtQBX3Z2gQj0', 'public/images/users/logo.jpg', 1),
(4, 'selma', '', 'selma', 'TFryStGOr5P5TffDCjvgxfiYy26bGlreqf7FtVCktHZSKH0le1Jj0gE0tFxbMVLh5bztGdUyjm74ekYiPIIDQuv5kMv8yC0hRdxK42z785HfiZlKMco7mU2fa3a1GbodcILfb0KaM0edk0ECDmaXs5bkm4WpD6rVeDDcmFIKKDtWb3tPTZymRm8dALzVQ7OMHCJIwlsj', 'public/images/users/logo.jpg', 1),
(5, 'fiko', '', 'fiko', 'hTkYOlk9fUmwZWW5ahU3Y9ll7YrJZDlW3mpRalJMjl6XXujw7eFFq9loQc1fHzrYp3TlWZlofqjfkyYGLAl94pvFXWfO0YM704x372X9aH49IIDgqwISV1YiS576xTZFeXXyx1AHaKxJqa1TG2tSpRQeHJ1WuT4r7ZDfZLsks79gwd67TjQ6ZHBxMF2alQWOmmIms7EV', 'public/images/users/logo.jpg', 1),
(6, 'ismail', '', 'ismail', 'jiq5GJ4s1ipDP3iWpiHwXqqAX8Bhb2x2hMBEc1PC8pElyH4qrvUG66Vs8cjrSczFmBDcOvh6gg3ePZTfv270daEYvD1xV4Or9uexGmBHbSAehi3wM7Ko3HqvfeHOdtJsQkF3fRIzOPd46gEpEhoIiaRg4XjDFGVFQVV5jVKiRujYUVVC6YKzd16kyTX7F6cBOxWksAmD', 'public/images/users/logo.jpg', 1);

-- --------------------------------------------------------

--
-- Table structure for table `system_users`
--

CREATE TABLE `system_users` (
  `id` int(10) UNSIGNED NOT NULL,
  `email` varchar(600) NOT NULL,
  `password` varchar(50) NOT NULL,
  `token` varchar(250) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `system_users`
--

INSERT INTO `system_users` (`id`, `email`, `password`, `token`) VALUES
(1, 'admin@admin.com', '1234', 'wT7Qkglp0UOv3Jth41XjHWxRQ4FVkafQJ6hrMTpkhaQRPFvI5SxrOiFauwcu3KZW52t3XZgaauFcA0fLWk0WkPdc6EAmmDovD4lCBJejD2KOaYmhrVkBGTD91cKeufklwqkhqrbWO47Q46MQdrBVFUUkCx62zHdJfkht0Lk0WL4u7cK2ZWP9Cjm1bujpavgIuuZSEhpT');

-- --------------------------------------------------------

--
-- Table structure for table `tables`
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
-- Dumping data for table `tables`
--

INSERT INTO `tables` (`id`, `table_area`, `table_area_view_name`, `table_number`, `table_status`, `table_amount`, `first_waiter`, `opening_time`) VALUES
(1, 'Bahçe', 'Bahçe', 1, 'open', '100', 'fiko ', '2024-11-08 14:07:58'),
(2, 'Bahçe', 'Bahçe', 2, 'open', '500', 'serkan ', '2024-11-08 14:01:09'),
(3, 'Bahçe', 'Bahçe', 3, 'close', '0', '@@@', '2024-11-08 13:55:17'),
(4, 'Bahçe', 'Bahçe', 4, 'close', '0', '@@@', '2024-09-08 13:42:23'),
(5, 'Bahçe', 'Bahçe', 5, 'close', '0', '@@@', '2024-09-01 11:34:06'),
(6, 'Bahçe', 'Bahçe', 6, 'close', '0', '@@@', '2024-09-01 14:36:17'),
(7, 'Bahçe', 'Bahçe', 7, 'close', '0', '@@@', '2024-09-06 12:00:53'),
(8, 'Bahçe', 'Bahçe', 8, 'close', '0', '@@@', '2024-07-28 13:17:38'),
(9, 'Bahçe', 'Bahçe', 9, 'open', '330', 'serkan ', '2024-11-08 14:05:02'),
(10, 'Bahçe', 'Bahçe', 10, 'close', '0', '@@@', '2024-07-16 01:26:11'),
(14, 'Paket', 'Paket', 0, 'open', '360', 'serkan ', '2024-11-08 14:04:27'),
(15, 'Sahil', 'Sahil', 1, 'close', '0', '@@@', '2024-11-08 13:55:24'),
(16, 'Sahil', 'Sahil', 2, 'close', '0', '@@@', '2024-11-08 13:55:30'),
(17, 'Sahil', 'Sahil', 3, 'close', '0', '@@@', '2024-09-08 15:22:52'),
(18, 'Sahil', 'Sahil', 4, 'close', '0', '@@@', '2024-09-05 16:17:01'),
(19, 'Sahil', 'Sahil', 5, 'close', '0', '@@@', '2024-11-08 13:55:37'),
(20, 'Sahil', 'Sahil', 6, 'close', '0', '@@@', '2024-09-07 13:21:48'),
(21, 'Sahil', 'Sahil', 7, 'close', '0', '@@@', '2024-09-08 14:25:45'),
(22, 'Sahil', 'Sahil', 8, 'close', '0', '@@@', '2024-09-01 15:38:38'),
(23, 'Sahil', 'Sahil', 9, 'close', '0', '@@@', '2024-09-07 15:34:39'),
(24, 'Sahil', 'Sahil', 10, 'close', '0', '@@@', '2024-09-03 11:36:34'),
(25, 'Sahil', 'Sahil', 11, 'close', '0', '@@@', '2024-09-07 16:15:23'),
(26, 'Sahil', 'Sahil', 12, 'close', '0', '@@@', '2024-09-07 17:09:56'),
(27, 'Sahil', 'Sahil', 13, 'close', '0', '@@@', '2024-09-02 12:41:14'),
(28, 'Sahil', 'Sahil', 14, 'close', '0', '@@@', '2024-09-07 13:55:06'),
(29, 'Sahil', 'Sahil', 15, 'close', '0', '@@@', '2024-08-18 17:25:44'),
(30, 'Sahil', 'Sahil', 16, 'close', '0', '@@@', '2024-09-01 14:36:07'),
(31, 'Sahil', 'Sahil', 17, 'close', '0', '@@@', '2024-09-07 14:46:42'),
(32, 'Sahil', 'Sahil', 18, 'close', '0', '@@@', '2024-09-07 13:49:23'),
(33, 'Sahil', 'Sahil', 19, 'close', '0', '@@@', '2024-09-07 15:04:48'),
(34, 'Sahil', 'Sahil', 20, 'close', '0', '@@@', '2024-08-30 13:45:21'),
(35, 'Sahil', 'Sahil', 21, 'close', '0', '@@@', '2024-08-30 17:38:40'),
(36, 'Sahil', 'Sahil', 22, 'close', '0', '@@@', '2024-09-01 12:13:44'),
(37, 'Sahil', 'Sahil', 23, 'close', '0', '@@@', '2024-09-01 12:00:20'),
(38, 'Sahil', 'Sahil', 24, 'close', '0', '@@@', '2024-08-25 15:03:58'),
(39, 'Sahil', 'Sahil', 25, 'close', '0', '@@@', '2024-08-18 14:30:49'),
(40, 'Sahil', 'Sahil', 26, 'close', '0', '@@@', '2024-08-31 16:26:31'),
(41, 'Sahil', 'Sahil', 27, 'close', '0', '@@@', '2024-07-13 14:09:56'),
(42, 'Sahil', 'Sahil', 28, 'close', '0', '@@@', '2024-08-31 16:26:42'),
(43, 'Sahil', 'Sahil', 29, 'close', '0', '@@@', '2024-08-23 18:54:07'),
(44, 'Sahil', 'Sahil', 30, 'close', '0', '@@@', '2024-07-25 14:48:38'),
(45, 'Sahil', 'Sahil', 31, 'close', '0', '@@@', '2024-08-18 16:54:03'),
(46, 'Sahil', 'Sahil', 32, 'close', '0', '@@@', '2024-06-15 06:58:54'),
(47, 'Sahil', 'Sahil', 33, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(48, 'Sahil', 'Sahil', 34, 'close', '0', '@@@', '2024-08-14 08:32:20'),
(49, 'Sahil', 'Sahil', 35, 'close', '0', '@@@', '2024-09-08 13:42:10'),
(50, 'Sahil', 'Sahil', 36, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(51, 'Sahil', 'Sahil', 37, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(52, 'Sahil', 'Sahil', 38, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(53, 'Sahil', 'Sahil', 39, 'close', '0', '@@@', '2024-06-15 06:59:12'),
(54, 'Sahil', 'Sahil', 40, 'close', '0', '@@@', '2024-08-25 15:02:46'),
(55, 'Sahil', 'Sahil', 41, 'close', '0', '@@@', '2024-08-18 17:34:01'),
(56, 'Sahil', 'Sahil', 42, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(57, 'Sahil', 'Sahil', 43, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(58, 'Sahil', 'Sahil', 44, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(59, 'Sahil', 'Sahil', 45, 'close', '0', '@@@', '2024-07-28 14:00:03'),
(60, 'Sahil', 'Sahil', 46, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(61, 'Sahil', 'Sahil', 47, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(62, 'Sahil', 'Sahil', 48, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(63, 'Sahil', 'Sahil', 49, 'close', '0', '@@@', '2024-06-15 07:00:07'),
(64, 'Sahil', 'Sahil', 50, 'close', '0', '@@@', '2024-07-28 11:56:30');

-- --------------------------------------------------------

--
-- Table structure for table `table_areas`
--

CREATE TABLE `table_areas` (
  `id` int(10) UNSIGNED NOT NULL,
  `area` varchar(100) NOT NULL,
  `image_path` varchar(600) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `table_areas`
--

INSERT INTO `table_areas` (`id`, `area`, `image_path`) VALUES
(1, 'Bahçe', 'public/images/users/ibrahim.jpg'),
(2, 'Sahil', 'public/images/users/ibrahim.jpg'),
(3, 'Paket', 'public/images/users/ibrahim.jpg');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `orders_log`
--
ALTER TABLE `orders_log`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sub_users`
--
ALTER TABLE `sub_users`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `system_users`
--
ALTER TABLE `system_users`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tables`
--
ALTER TABLE `tables`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `table_areas`
--
ALTER TABLE `table_areas`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4220;

--
-- AUTO_INCREMENT for table `orders_log`
--
ALTER TABLE `orders_log`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4080;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=156;

--
-- AUTO_INCREMENT for table `sub_users`
--
ALTER TABLE `sub_users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `system_users`
--
ALTER TABLE `system_users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `tables`
--
ALTER TABLE `tables`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `table_areas`
--
ALTER TABLE `table_areas`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

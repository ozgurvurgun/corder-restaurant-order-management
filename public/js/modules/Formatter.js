export default class Formatter {
  moneyFormatter(number, currency) {
    const formatter = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    });
    const formattedNumber = formatter.format(number);

    return formattedNumber;
  }
}

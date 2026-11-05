/// Price as shown and edited in the app: "60" rather than "60.0".
/// Menu prices are entered as whole rupees; anything else keeps 2 decimals.
String formatPrice(num price) =>
    price == price.roundToDouble() ? price.round().toString() : price.toStringAsFixed(2);

class OrderItemModel {
  final String menuItemId;
  final String name;       
  final double price;      
  final int quantity;

  OrderItemModel({
    required this.menuItemId,
    required this.name,
    required this.price,
    required this.quantity,
  });

  double get total => price * quantity;

  factory OrderItemModel.fromJson(Map<String, dynamic> json) {
    return OrderItemModel(
      menuItemId: json["menuItemId"] ?? "",
      name: json["name"] ?? "",
      price: (json["price"] as num).toDouble(),
      quantity: json["quantity"] ?? 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      "menuItemId": menuItemId,
      "name": name,
      "price": price,
      "quantity": quantity,
    };
  }
}
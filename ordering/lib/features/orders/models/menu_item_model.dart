import 'package:ordering/core/utils/local_name.dart';

class MenuItemModel {
  String id;
  String name;
  double price;
  bool isVeg;
  bool isInStock;
  String cartId;
  String imageUrl;
  Map<String, String> names;

  /// The name in the app's language, else English.
  String get displayName => localName(name, names);

  /// Search matches the English or the local name.
  bool matches(String query) {
    final q = query.trim().toLowerCase();
    return name.toLowerCase().contains(q) ||
        displayName.toLowerCase().contains(q);
  }

  MenuItemModel({
    required this.id,
    required this.name,
    required this.price,
    required this.isVeg,
    required this.isInStock,
    required this.cartId,
    required this.imageUrl,
    this.names = const {},
  });

  Map<String, dynamic> toJson() {
    return {
      "id": id,
      "name": name,
      "price": price,
      "isVeg": isVeg,
      "isInStock": isInStock,
      "cartId": cartId,
      "imageUrl": imageUrl,
      "names": names,
    };
  }

  MenuItemModel copyWith({
    String? id,
    String? name,
    double? price,
    bool? isVeg,
    bool? isInStock,
    String? cartId,
    String? imageUrl,
    Map<String, String>? names,
  }) {
    return MenuItemModel(
      id: id ?? this.id,
      name: name ?? this.name,
      price: price ?? this.price,
      isVeg: isVeg ?? this.isVeg,
      isInStock: isInStock ?? this.isInStock,
      cartId: cartId ?? this.cartId,
      imageUrl: imageUrl ?? this.imageUrl,
      names: names ?? this.names,
    );
  }

  factory MenuItemModel.fromJson(Map<String, dynamic> json) {
    return MenuItemModel(
      id: json["id"] ?? json["_id"] ?? "",
      name: json["name"] ?? "",
      price: (json["price"] as num).toDouble(),
      isVeg: json["isVeg"] ?? false,
      isInStock: json["isInStock"] ?? false,
      cartId: json["cartId"] ?? "",
      imageUrl: json["imageUrl"] ?? "",
      names: namesFromJson(json["names"]),
    );
  }
}

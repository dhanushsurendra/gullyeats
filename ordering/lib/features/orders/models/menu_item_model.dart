class MenuItemModel {
  String id;
  String name;
  double price;
  bool isVeg;
  bool isInStock;
  String cartId;
  String imageUrl;  

  MenuItemModel({
    required this.id,
    required this.name,
    required this.price,
    required this.isVeg,
    required this.isInStock,
    required this.cartId,
    required this.imageUrl,
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
    };
  }

  MenuItemModel copyWith({
    String? id,
    String? name,
    double? price,
    bool? isVeg,
    bool? isInStock,
    String? cartId,
    String? imageUrl
  }) {
    return MenuItemModel(
      id: id ?? this.id,
      name: name ?? this.name,
      price: price ?? this.price,
      isVeg: isVeg ?? this.isVeg,
      isInStock: isInStock ?? this.isInStock,
      cartId: cartId ?? this.cartId,
      imageUrl: imageUrl ?? this.imageUrl
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
    );
  }
}

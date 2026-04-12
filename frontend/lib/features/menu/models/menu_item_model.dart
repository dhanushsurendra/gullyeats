class MenuItemModel {
  String name;
  double price;
  bool isVeg;

  MenuItemModel({this.name = '', this.price = 0, this.isVeg = true});

  Map<String, dynamic> toJson() {
    return {
      "name": name,
      "price": price,
      "isVeg": isVeg,
    };
  }
}
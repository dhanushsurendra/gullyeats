class CartModel {
  final String id;
  final String cartName;
  final String cartCity;
  final String cartId;
  final String address;
  final String cartImageUrl;
  final String qrImageUrl;
  final bool isActive;
  final bool isOpen;
  final String userId;
  final CartLocation location;

  CartModel({
    required this.id,
    required this.cartName,
    required this.cartCity,
    required this.cartId,
    required this.address,
    required this.cartImageUrl,
    required this.qrImageUrl,
    this.isOpen = false,
    this.isActive = false,
    required this.userId,
    required this.location,
  });

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'cartName': cartName,
      'cartCity': cartCity,
      'cartId': cartId,
      'address': address,
      'cartImageUrl': cartImageUrl,
      'qrImageUrl': qrImageUrl,
      'isActive': isActive,
      'isOpen': isOpen,
      'userId': userId,
      'location': location.toJson(), 
    };
  }

  factory CartModel.fromJson(Map<String, dynamic> json) {
    return CartModel(
      id: json['_id'] ?? '',
      cartName: json['cartName'] ?? '',
      cartCity: json['cartCity'] ?? '',
      cartId: json['cartId'] ?? '',
      address: json['address'] ?? '',
      cartImageUrl: json['cartImageUrl'] ?? '',
      qrImageUrl: json['qrImageUrl'] ?? '',
      isActive: json['isActive'] ?? false,
      isOpen: json['isOpen'] ?? false,
      userId: json['userId'] ?? '',
      location: json['location'] != null
          ? CartLocation.fromJson(json['location'])
          : CartLocation.empty(),
    );
  }
}

class CartLocation {
  final String type;
  final double longitude;
  final double latitude;

  CartLocation({
    required this.type,
    required this.longitude,
    required this.latitude,
  });

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'coordinates': [longitude, latitude], 
    };
  }

  factory CartLocation.fromJson(Map<String, dynamic> json) {
    List<dynamic> coords = json['coordinates'] ?? [0.0, 0.0];
    return CartLocation(
      type: json['type'] ?? 'Point',
      longitude: (coords[0] as num).toDouble(),
      latitude: (coords[1] as num).toDouble(),
    );
  }

  factory CartLocation.empty() {
    return CartLocation(type: 'Point', longitude: 0.0, latitude: 0.0);
  }
}
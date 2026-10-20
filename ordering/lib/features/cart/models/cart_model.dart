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
  final int parcelCharge;
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
    required this.parcelCharge,
    this.isOpen = false,
    this.isActive = false,
    required this.userId,
    required this.location,
  });

  CartModel copyWith({
    String? id,
    String? cartName,
    String? cartCity,
    String? cartId,
    String? address,
    String? cartImageUrl,
    String? qrImageUrl,
    bool? isActive,
    bool? isOpen,
    int? parcelCharge,
    String? userId,
    CartLocation? location,
  }) {
    return CartModel(
      id: id ?? this.id,
      cartName: cartName ?? this.cartName,
      cartCity: cartCity ?? this.cartCity,
      cartId: cartId ?? this.cartId,
      address: address ?? this.address,
      cartImageUrl: cartImageUrl ?? this.cartImageUrl,
      qrImageUrl: qrImageUrl ?? this.qrImageUrl,
      isActive: isActive ?? this.isActive,
      isOpen: isOpen ?? this.isOpen,
      parcelCharge: parcelCharge ?? this.parcelCharge,
      userId: userId ?? this.userId,
      location: location ?? this.location,
    );
  }

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
      'parcelCharge': parcelCharge,
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
      parcelCharge: json['parcelCharge'] ?? 0,
      userId: json['userId'] ?? '',
      location: json['location'] != null
          ? CartLocation.fromJson(json['location'])
          : CartLocation.empty(),
    );
  }
}

class CartLocation {
  final String type;
  final double latitude;
  final double longitude;

  CartLocation({
    required this.type,
    required this.longitude,
    required this.latitude,
  });

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'coordinates': [latitude, longitude], 
    };
  }

  factory CartLocation.fromJson(Map<String, dynamic> json) {
    List<dynamic> coords = json['coordinates'] ?? [0.0, 0.0];
    return CartLocation(
      type: json['type'] ?? 'Point',
      latitude: (coords[0] as num).toDouble(),
      longitude: (coords[1] as num).toDouble(),
    );
  }

  factory CartLocation.empty() {
    return CartLocation(type: 'Point', latitude: 0.0, longitude: 0.0);
  }
}
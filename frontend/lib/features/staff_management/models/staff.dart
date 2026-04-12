class StaffModel {
  final String id;
  final String userId;
  final String name;
  final String phoneNumber;
  final String role;
  final String cartId;
  final String? pinHash;

  StaffModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.phoneNumber,
    required this.role,
    required this.cartId,
    this.pinHash,
  });

  factory StaffModel.fromJson(Map<String, dynamic> json) {
    return StaffModel(
      id: json['id'] ?? '',
      userId: json['userId'] ?? '',
      name: json['name'] ?? '',
      phoneNumber: json['phoneNumber'] ?? '',
      role: json['role'] ?? '',
      cartId: json['cartId'] ?? '',
      pinHash: json['pinHash'], 
    );
  }
}
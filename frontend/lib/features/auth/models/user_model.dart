class UserModel {
  final String id; 
  final String? userId; 
  final String? vendorId; 
  final String phoneNumber;
  final String? name;
  final String role; 
  final bool isVerified;
  final DateTime? createdAt;

  UserModel({
    required this.id,
    this.userId,
    this.vendorId,
    required this.phoneNumber,
    this.name,
    required this.role,
    this.isVerified = false,
    this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] ?? '',
      userId: json['userId'],
      vendorId: json['vendorId'],
      phoneNumber: json['phoneNumber'] ?? '',
      name: json['name'],
      role: json['role'] ?? 'vendor',
      isVerified: json['isVerified'] ?? false,
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': userId,
      'vendorId': vendorId,
      'phoneNumber': phoneNumber,
      'name': name,
      'role': role,
      'isVerified': isVerified,
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  UserModel copyWith({
    String? name,
    bool? isVerified,
    String? vendorId,
  }) {
    return UserModel(
      id: id,
      userId: userId,
      phoneNumber: phoneNumber,
      role: role,
      createdAt: createdAt,
      name: name ?? this.name,
      isVerified: isVerified ?? this.isVerified,
      vendorId: vendorId ?? this.vendorId,
    );
  }
}
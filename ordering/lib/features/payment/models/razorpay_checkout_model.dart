class RazorpayCheckoutModel {
  final String keyId;
  final String razorpayOrderId;
  final num amount;
  final String currency;
  final String name;
  final String description;

  const RazorpayCheckoutModel({
    required this.keyId,
    required this.razorpayOrderId,
    required this.amount,
    required this.currency,
    required this.name,
    required this.description,
  });

  factory RazorpayCheckoutModel.fromJson(Map<String, dynamic> json) {
    return RazorpayCheckoutModel(
      keyId: (json['keyId'] ?? '').toString(),
      razorpayOrderId: (json['razorpayOrderId'] ?? '').toString(),
      amount: (json['amount'] as num?) ?? 0,
      currency: (json['currency'] ?? 'INR').toString(),
      name: (json['name'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
    );
  }
}
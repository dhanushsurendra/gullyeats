import 'package:ordering/core/utils/local_name.dart';

/// A common item name from the server's list, suggested while adding an item.
class FoodNameModel {
  final String name;
  final Map<String, String> names;

  const FoodNameModel({required this.name, this.names = const {}});

  /// The name in the app's language, else English.
  String get displayName => localName(name, names);

  factory FoodNameModel.fromJson(Map<String, dynamic> json) => FoodNameModel(
    name: json['name'] ?? '',
    names: namesFromJson({'hi': json['hi'], 'kn': json['kn'], 'ta': json['ta']}),
  );
}

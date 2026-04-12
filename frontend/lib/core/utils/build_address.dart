import 'package:geocoding/geocoding.dart';

String buildAddress(Placemark p) {
  final parts = [
    p.name,
    p.street,
    p.subLocality,
    p.locality,
    p.subAdministrativeArea,
    p.administrativeArea,
    p.postalCode,
    p.country,
  ];

  return parts
      .where((part) => part != null && part.trim().isNotEmpty)
      .join(', ');
}
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

/// Joins the non-empty [parts] with [separator], skipping nulls, so a
/// partial (or failed) geocoding result never prints "null".
String joinAddressParts(List<String?> parts, {String separator = ', '}) =>
    parts.where((part) => part != null && part.trim().isNotEmpty).join(separator);

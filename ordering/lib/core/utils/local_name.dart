import 'package:ordering/features/profile/providers/language_provider.dart';

/// [names] is an item's English name written in each script, keyed by
/// language code. Returns the one for the app's language, else [name].
String localName(String name, Map<String, String> names) {
  final local = names[LanguageProvider.current.languageCode];
  return local == null || local.isEmpty ? name : local;
}

Map<String, String> namesFromJson(Object? json) => {
  if (json is Map)
    for (final e in json.entries)
      if (e.value is String) e.key.toString(): e.value as String,
};

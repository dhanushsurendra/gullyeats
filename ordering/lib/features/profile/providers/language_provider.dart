import 'package:flutter/material.dart';
import 'package:ordering/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The app's chosen language, saved on the device.
class LanguageProvider extends ChangeNotifier {
  static const _key = 'languageCode';

  /// Language code → name in its own script, in the order shown to the user.
  static const languages = {
    'en': 'English',
    'kn': 'ಕನ್ನಡ',
    'hi': 'हिन्दी',
    'ta': 'தமிழ்',
  };

  /// For code that has no BuildContext (the error handler).
  static Locale current = const Locale('en');
  static AppLocalizations get strings => lookupAppLocalizations(current);

  Locale get locale => current;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_key);
    if (code != null && languages.containsKey(code)) current = Locale(code);
  }

  Future<void> setLanguage(String code) async {
    current = Locale(code);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, code);
  }
}

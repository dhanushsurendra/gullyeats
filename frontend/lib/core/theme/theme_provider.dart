import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_colors.dart';

/// Light or dark theme, saved on the device. The first time, it follows the
/// phone's own setting.
class ThemeProvider extends ChangeNotifier {
  static const _key = 'darkTheme';

  bool get dark => AppColors.dark;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    AppColors.dark = prefs.getBool(_key) ??
        PlatformDispatcher.instance.platformBrightness == Brightness.dark;
  }

  Future<void> setDark(bool value) async {
    AppColors.dark = value;
    notifyListeners();
    // Screens read AppColors directly (many through const widgets), so a
    // theme change alone would not repaint them: rebuild every element.
    void rebuild(Element e) {
      e.markNeedsBuild();
      e.visitChildren(rebuild);
    }

    WidgetsBinding.instance.rootElement?.visitChildren(rebuild);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, value);
  }
}

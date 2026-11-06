import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/core/error/app_exceptions.dart';
import 'package:ordering/features/profile/presentation/language_preferences_screen.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> pumpApp(WidgetTester tester, LanguageProvider language) {
  return tester.pumpWidget(
    ChangeNotifierProvider.value(
      value: language,
      child: Consumer<LanguageProvider>(
        builder: (_, lang, _) => MaterialApp(
          locale: lang.locale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: Builder(
            builder: (context) => Scaffold(
              body: Column(
                children: [
                  Text(context.l10n.login),
                  TextButton(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const LanguagePreferencesScreen(),
                      ),
                    ),
                    child: const Text('open'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

void main() {
  tearDown(() => LanguageProvider.current = const Locale('en'));

  testWidgets('saving Hindi switches the app and remembers it', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await pumpApp(tester, LanguageProvider());
    expect(find.text('Login'), findsOneWidget);

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('हिन्दी'), 100, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('हिन्दी'));
    await tester.pump();
    await tester.tap(find.text('SAVE LANGUAGE'));
    await tester.pumpAndSettle();

    expect(find.text('लॉगिन'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('languageCode'), 'hi');
    // Code without a BuildContext follows the same language.
    expect(AppExceptionHandler.getMessage(Exception()), contains('कोशिश'));
  });

  for (final (code, login) in [('kn', 'ಲಾಗಿನ್'), ('ta', 'உள்நுழை')]) {
    testWidgets('a saved language ($code) is used on the next launch', (tester) async {
      SharedPreferences.setMockInitialValues({'languageCode': code});
      final language = LanguageProvider();
      await language.load();
      await pumpApp(tester, language);

      expect(find.text(login), findsOneWidget);
    });
  }

  test('every language on the picker has translations', () {
    for (final code in LanguageProvider.languages.keys) {
      expect(AppLocalizations.supportedLocales, contains(Locale(code)));
    }
  });
}

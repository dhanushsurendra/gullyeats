// FLT-VEN-125..127 device test: the QR poster (Profile > VIEW QR) without a connection.
// SHARE QR used to share a poster with a grey placeholder and nothing to scan.
// Run through integration_test/watch.sh (NET-OFF/ON, RADIO-OFF/ON, KEY-BACK):
//   bash integration_test/watch.sh flutter test integration_test/vendor_qr_network_test.dart -d <device> \
//     --dart-define=API_BASE_URL=http://localhost:5050/api
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ordering/l10n/app_localizations.dart';

import 'qa.dart';

final en = lookupAppLocalizations(const Locale('en'));

Future<void> _nav(WidgetTester tester, String tab) async {
  await noSnackBar(tester);
  await waitFor(tester, find.text(tab), seconds: 30);
  await tester.tap(find.text(tab).last);
  await idle(tester);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN QR poster offline: no share without the QR, then share works', (tester) async {
    final v = await onboard();
    await api('POST', '/carts/generate-cart-qr/${v['cartId']}', token: v['token'] as String);
    await login(tester, v);
    await _nav(tester, en.profile);

    // FLT-VEN-125: server unreachable when the poster opens: no QR, SHARE QR refuses.
    await netOff(tester);
    await tapText(tester, en.viewQrCaps);
    await waitFor(tester, find.text(en.qrCodePoster), seconds: 30);
    await idle(tester, ms: 5000);
    await noSnackBar(tester);
    await tapText(tester, en.shareQrCaps);
    await waitFor(tester, find.text(en.checkInternet), seconds: 40);
    expect(tester.binding.lifecycleState, AppLifecycleState.resumed, reason: 'no share sheet opened');
    say('STEP 125 QR offline: share refused');

    // FLT-VEN-126: server back but no internet (the QR image is on S3): still refused.
    await netOn(tester);
    say('RADIO-OFF');
    await idle(tester, ms: 8000);
    await noSnackBar(tester);
    await tapText(tester, en.shareQrCaps);
    await waitFor(tester, find.text(en.checkInternet), seconds: 60);
    expect(tester.binding.lifecycleState, AppLifecycleState.resumed, reason: 'no share sheet opened');
    say('STEP 126 QR image offline: share refused');

    // FLT-VEN-127: all back: the QR loads and the share sheet opens.
    say('RADIO-ON');
    await idle(tester, ms: 10000);
    await noSnackBar(tester);
    await tapText(tester, en.shareQrCaps);
    final end = DateTime.now().add(const Duration(seconds: 60));
    while (tester.binding.lifecycleState == AppLifecycleState.resumed && DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 300));
    }
    expect(tester.binding.lifecycleState, isNot(AppLifecycleState.resumed), reason: 'the share sheet opened');
    say('STEP 127 share sheet opened');
    say('KEY-BACK');
    await Future<void>.delayed(const Duration(seconds: 4));
    await idle(tester, ms: 2000);
  });
}

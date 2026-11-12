// FLT-VEN device tests, part 9: parcel charge refused by the server, the
// Live / Reconnecting indicator, resuming while offline, and the app going
// idle after an order alert (BUG-007). Needs watch.sh (NET-OFF / NET-ON, RADIO-OFF / RADIO-ON).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ordering/l10n/app_localizations.dart';

import 'qa.dart';

final en = lookupAppLocalizations(const Locale('en'));

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('FLT-VEN parcel charge, live / reconnecting, offline resume, idle after an alert', (tester) async {
    final v = await onboard();
    final token = v['token'] as String;

    // FLT-VEN-036: the server refuses a negative or non-numeric parcel charge (the app's field takes digits only).
    for (final bad in [-5, 'abc']) {
      final r = await api('PUT', '/carts/update-cart/${v['cartId']}', token: token, body: {'parcelCharge': bad});
      expect(r['status'], 400, reason: 'parcelCharge $bad: ${r['message']}');
    }

    await login(tester, v);

    // FLT-VEN-051: Live while connected; Reconnecting when the backend goes; Live again after.
    await waitFor(tester, find.text(en.liveStatus), seconds: 30);
    // The phone loses its network (RADIO-OFF) and the backend (NET-OFF): the app hears
    // about the first from Android, which is what flips the indicator at once.
    say('RADIO-OFF');
    await netOff(tester);
    await waitFor(tester, find.text(en.reconnecting), seconds: 60);
    // FLT-VEN-050 (variant): resuming while offline keeps the list and doesn't crash.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await Future<void>.delayed(const Duration(seconds: 2));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await idle(tester, ms: 5000);
    expect(tester.takeException(), isNull);
    expect(find.byIcon(Icons.add), findsOneWidget, reason: 'still on Orders: ${onScreen()}');
    debugPrint('STEP offline resume screen: ${onScreen()}');
    say('RADIO-ON');
    await netOn(tester);
    await waitFor(tester, find.text(en.liveStatus), seconds: 60);

    // An order placed right after reconnecting arrives live.
    final o = await customerOrder(v);
    await waitFor(tester, find.text('#${o['orderNumber']}'), seconds: 30);

    // FLT-VEN-123: after the alert, nothing keeps drawing frames.
    await idle(tester, ms: 8000);
    var busy = 0;
    for (var i = 0; i < 10; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 500));
      if (tester.binding.hasScheduledFrame) busy++;
      await tester.pump();
    }
    expect(busy, lessThan(3), reason: 'frames kept being scheduled while idle ($busy/10)');
  });
}

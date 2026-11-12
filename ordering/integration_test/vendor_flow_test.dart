// FLT-VEN device tests: the real app on a phone against the QA test backend.
//
//   adb reverse tcp:5050 tcp:5050
//   flutter test integration_test -d <device> \
//     --dart-define=API_BASE_URL=http://localhost:5050/api \
//     --dart-define=QA_ADMIN_EMAIL=... --dart-define=QA_ADMIN_PASSWORD=...
//
// Run customer-app's backend (see customer-app/playwright.config.js) or
// `PORT=5050 node server.js` in backend/ first, and `node scripts/qa.js
// cleanup` after. QA vendors use phones starting 00999.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'qa.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // One app start for the whole flow: restarting main() inside one test run
  // leaves the first run's socket and navigator behind.
  testWidgets('FLT-VEN device flow: login, live order, paid, serve, background, disabled', (tester) async {
    if (adminPassword.isEmpty) fail('Pass --dart-define=QA_ADMIN_EMAIL/QA_ADMIN_PASSWORD');
    final v = await onboard();

    // FLT-VEN-001: owner logs in with phone + PIN and lands on Orders.
    await login(tester, v);

    // FLT-VEN-006: a customer QR order arrives over the socket, no refresh.
    final first = await customerOrder(v);
    await waitFor(tester, find.text('#${first['orderNumber']}'));

    // FLT-VEN-009/010: mark paid, then serve, and the server agrees.
    await tester.tap(find.byKey(const ValueKey('paid')));
    await waitFor(tester, find.byKey(const ValueKey('serve')));
    expect(await orderStatus(v, first['_id'] as String), 'PAID');
    await tester.tap(find.byKey(const ValueKey('serve')));
    for (var i = 0; i < 40 && await orderStatus(v, first['_id'] as String) != 'SERVED'; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    expect(await orderStatus(v, first['_id'] as String), 'SERVED');
    await idle(tester, ms: 3000);

    // FLT-VEN-035: an order placed while the app is in the background shows on resume.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    // No pumping while paused: no frames are drawn, so a pump would wait forever.
    await Future<void>.delayed(const Duration(seconds: 2));
    final second = await customerOrder(v);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await waitFor(tester, find.text('#${second['orderNumber']}'));
    await idle(tester, ms: 3000);

    // FLT-VEN-005: an admin disables the vendor; the next action signs the app out.
    final admin = await adminToken();
    expect((await api('POST', '/admin/owners/${v['userId']}/disable', token: admin))['status'], 200);
    try {
      await tester.tap(find.byKey(const ValueKey('paid')));
      await waitFor(tester, find.text('LOGIN'));
      expect(find.text(v['cartName'] as String), findsNothing);
    } finally {
      await api('POST', '/admin/owners/${v['userId']}/enable', token: admin);
    }
    await idle(tester, ms: 3000);
  });
}

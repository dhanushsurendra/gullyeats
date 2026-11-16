import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/orders/voice/voice_confirm_sheet.dart';
import 'package:ordering/features/orders/voice/voice_parser.dart';
import 'package:ordering/features/orders/voice/voice_session.dart';
import 'package:ordering/l10n/l10n.dart';

import 'voice_parser_test.dart' show menu, active;

/// Opens the sheet for [heard] and returns what CONFIRM hands back.
Future<VoiceDecision?> confirm(
  WidgetTester tester,
  String heard, {
  Future<void> Function()? before,
  bool tapConfirm = true,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  VoiceDecision? result;
  await tester.pumpWidget(
    MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) => TextButton(
          onPressed: () async {
            result = await showVoiceConfirmSheet(
              context,
              key: GlobalKey(),
              command: parseVoiceCommand(heard, menu, active),
              heard: heard,
              // No speech plugin in tests: read-back and "yes" quietly do nothing.
              session: VoiceSession(),
              parcelCharge: 10,
              platformFee: 2,
            );
          },
          child: const Text('open'),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  await before?.call();
  if (tapConfirm) {
    await tester.tap(find.text('CONFIRM'));
    await tester.pumpAndSettle();
  }
  return result;
}

void main() {
  testWidgets('a new order: lines, total, and the decision on CONFIRM', (tester) async {
    final d = await confirm(
      tester,
      '2 masala dosa 1 filter coffee paid',
      before: () async {
        expect(find.text('Masala Dosa'), findsOneWidget);
        expect(find.text('Filter Coffee'), findsOneWidget);
        // 2 × 60 + 25 + fee 2.
        expect(find.text('₹147'), findsOneWidget);
      },
    );
    expect(d!.lines, {'d1': 2, 'd4': 1});
    expect((d.paid, d.parcel), (true, false));
  });

  testWidgets('steppers and the parcel toggle change the order and total', (tester) async {
    final d = await confirm(
      tester,
      '1 dosa',
      before: () async {
        await tester.tap(find.byIcon(Icons.add_circle_outline));
        await tester.tap(find.text('Parcel'));
        await tester.pumpAndSettle();
        // 2 × 40 + parcel 10 + fee 2.
        expect(find.text('₹92'), findsOneWidget);
      },
    );
    expect(d!.lines, {'d2': 2});
    expect(d.parcel, isTrue);
  });

  testWidgets('words it could not match are shown', (tester) async {
    await confirm(
      tester,
      '2 masala dosa pizza',
      tapConfirm: false,
      before: () async => expect(find.text("Didn't catch: pizza"), findsOneWidget),
    );
  });

  testWidgets('mark paid asks about the right order', (tester) async {
    final d = await confirm(
      tester,
      'number 6 paid',
      before: () async => expect(find.text('Mark #6 paid?'), findsOneWidget),
    );
    expect(d, isNotNull);
  });

  testWidgets('CANCEL gives nothing back', (tester) async {
    final d = await confirm(
      tester,
      'number 7 served',
      tapConfirm: false,
      before: () async {
        expect(find.text('Serve #7?'), findsOneWidget);
        await tester.tap(find.text('CANCEL'));
        await tester.pumpAndSettle();
      },
    );
    expect(d, isNull);
  });
}

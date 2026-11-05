import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gullyeats/features/auth/screens/signup_screen.dart';

import 'responsive/harness.dart';

void main() {
  Future<void> pumpSignup(WidgetTester tester) =>
      tester.pumpWidget(buildApp(TestProviders(), const SignupScreen()));

  bool isLoading(WidgetTester tester) =>
      find.byType(CircularProgressIndicator).evaluate().isNotEmpty;

  testWidgets('an invalid number shows an error and keeps the button usable',
      (tester) async {
    await pumpSignup(tester);

    await tester.enterText(find.byType(TextFormField), '12345');
    await tester.tap(find.text('SEND OTP'));
    await tester.pump();

    expect(find.text('Please enter a valid 10-digit mobile number'), findsOneWidget);
    expect(isLoading(tester), isFalse);
    expect(find.text('SEND OTP'), findsOneWidget);
  });

  testWidgets('a failed request stops the spinner', (tester) async {
    await pumpSignup(tester);

    // Test HTTP requests always fail (status 400), like a server error.
    await tester.enterText(find.byType(TextFormField), '9876543210');
    await tester.tap(find.text('SEND OTP'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(isLoading(tester), isFalse);
    expect(find.text('SEND OTP'), findsOneWidget);
  });
}

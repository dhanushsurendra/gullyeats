import 'package:url_launcher/url_launcher.dart';

/// Launches a UPI deep link (e.g. "upi://pay?...") in whichever UPI app the
/// user has installed. Returns false if no UPI app could handle the intent.
///
/// This says nothing about payment success or failure — that only ever
/// comes from the backend's payment-status response.
Future<bool> launchUpiIntent(String upiIntentUri) async {
  final uri = Uri.parse(upiIntentUri);
  try {
    return await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}
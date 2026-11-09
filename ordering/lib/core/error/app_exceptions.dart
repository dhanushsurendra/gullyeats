import 'package:ordering/core/error/api_exception.dart';
import 'package:ordering/core/utils/session.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';

class AppExceptionHandler {
  static String getMessage(Object error) {
    final message = error.toString();

    if (error is ApiException) {
      // Every screen reports errors through here, so this is the one place
      // that notices an expired login.
      if (error.statusCode == 401) {
        return handleUnauthorized()
            ? LanguageProvider.strings.sessionExpired
            : LanguageProvider.strings.wrongIdOrPin;
      }
      return error.message;
    }

    if (message.contains("SocketException")) {
      return LanguageProvider.strings.checkInternet;
    }

    if (message.contains("TimeoutException")) {
      return LanguageProvider.strings.requestTimedOut;
    }

    return LanguageProvider.strings.somethingWentWrong;
  }
}

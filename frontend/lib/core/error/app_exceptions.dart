import 'package:gullyeats/core/error/api_exception.dart';
import 'package:gullyeats/core/utils/session.dart';

class AppExceptionHandler {
  static String getMessage(Object error) {
    final message = error.toString();

    if (error is ApiException) {
      // Every screen reports errors through here, so this is the one place
      // that notices an expired login.
      if (error.statusCode == 401 && handleUnauthorized()) {
        return "Your login has expired. Please log in again.";
      }
      return error.message;
    }

    if (message.contains("SocketException")) {
      return "Check your internet connection";
    }

    if (message.contains("TimeoutException")) {
      return "Request timed out. Try again";
    }

    return "Something went wrong. Please try again.";
  }
}

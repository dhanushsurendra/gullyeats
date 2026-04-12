import 'package:gullyeats/core/error/api_exception.dart';

class AppExceptionHandler {
  static String getMessage(Object error) {
    final message = error.toString();

     if (error is ApiException) {
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

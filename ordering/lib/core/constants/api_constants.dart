class ApiConstants {
  // static const String baseUrl = "https://gullyeats.onrender.com/api";
  // Override for tests: --dart-define=API_BASE_URL=http://localhost:5050/api
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: "https://gullyeats.onrender.com/api",
  );
  
  static const String orders = "$baseUrl/orders";
  static const String vendors = "$baseUrl/vendors";
  static const String carts = "$baseUrl/carts";
  static const String payments = "$baseUrl/payments";

  // Socket.IO runs on the same server, without the /api path.
  static final String socketUrl = Uri.parse(baseUrl).origin;
}
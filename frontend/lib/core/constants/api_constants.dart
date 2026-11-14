class ApiConstants {
  // static const String baseUrl = "https://api.gullyeats.in/api";
  // Override for tests: --dart-define=API_BASE_URL=http://localhost:5050/api
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: "https://api.gullyeats.in/api",
  );
  
  static const String carts = "$baseUrl/carts";
  static const String vendors = "$baseUrl/vendors";
}
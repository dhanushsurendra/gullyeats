class ApiConstants {
  // static const String baseUrl = "https://gullyeats.onrender.com/api";
  static const String baseUrl = "http://192.168.0.158:5001/api";
  
  static const String orders = "$baseUrl/orders";
  static const String vendors = "$baseUrl/vendors";
  static const String carts = "$baseUrl/carts";
  static const String payments = "$baseUrl/payments";

  // Socket.IO runs on the same server, without the /api path.
  static final String socketUrl = Uri.parse(baseUrl).origin;
}
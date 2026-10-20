import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/models/order_model.dart';
import 'package:ordering/features/orders/services/menu_service.dart';
import 'package:ordering/features/orders/services/orders_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;

class OrderProvider with ChangeNotifier {
  final OrderService _orderService = OrderService();

  // ---------------------------------------------------------------------------
  // ORDERS
  // ---------------------------------------------------------------------------

  /// Master list of orders.
  ///
  /// This list contains ALL orders returned by the backend for the current
  /// order list.
  ///
  /// The UI decides whether an order is Active, All, QR, Manual, etc.
  List<OrderModel> _orders = [];

  List<OrderModel> _ordersOverview = [];

  List<OrderModel> get orders => _orders;

  List<OrderModel> get ordersOverview => _ordersOverview;

  // Used only for DELETE -> UNDO.
  int? _lastRemovedIndex;

  bool _isLoading = false;

  bool get isLoading => _isLoading;

  // ---------------------------------------------------------------------------
  // MENU
  // ---------------------------------------------------------------------------

  final MenuService _service = MenuService();

  List<MenuItemModel> _menu = [];

  final Map<String, int> _cart = {};

  List<MenuItemModel> get menu => _menu;

  // ---------------------------------------------------------------------------
  // PARCEL / CART
  // ---------------------------------------------------------------------------

  double _parcelPrice = 0;

  double get parcelPrice => _parcelPrice;

  double get platformFee {
    final hasItems = _cart.values.any((count) => count > 0);

    return hasItems ? 2.0 : 0.0;
  }

  // ---------------------------------------------------------------------------
  // SOCKET
  // ---------------------------------------------------------------------------

  socket_io.Socket? _socket;

  // ---------------------------------------------------------------------------
  // CREATE ORDER
  // ---------------------------------------------------------------------------

  Future<OrderModel?> createOrder(
    String? token,
    Map<String, dynamic> orderData,
  ) async {
    try {
      final order = await _orderService.createOrder(token, orderData);

      final prefs = await SharedPreferences.getInstance();

      await prefs.setString("last_order", json.encode(order.toJson()));

      return order;
    } finally {
      notifyListeners();
    }
  }

  void _addOrUpdateOrder(dynamic data) {
    final updatedOrder = OrderModel.fromJson(data);

    final existingIndex = _orders.indexWhere(
      (order) => order.id == updatedOrder.id,
    );

    if (existingIndex == -1) {
      // Order doesn't exist yet → add it.
      _orders.add(updatedOrder);
    } else {
      // Order already exists → update it.
      _orders[existingIndex] = updatedOrder;
    }

    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // SOCKET
  // ---------------------------------------------------------------------------

  void initSocket(String cartId) {
    _socket?.dispose();

    _socket = socket_io.io(
      'http://192.168.0.241:5000/',
      socket_io.OptionBuilder()
          .setTransports(['websocket'])
          .setQuery({'cartId': cartId})
          .disableAutoConnect()
          .build(),
    );

    _socket!.connect();

    _socket!.onConnect((_) {
      debugPrint('Connected to Socket.io');

      _socket!.emit('join_vendor', cartId);
    });

    // New order
    _socket!.on('new_order_received', (data) {
      _addOrUpdateOrder(data);
    });

    // Existing order updated
    _socket!.on('order_updated', (data) {
      _addOrUpdateOrder(data);
    });

    _socket!.onDisconnect(
      (_) => debugPrint('Disconnected from Socket.io'),
    );
  }

  // ---------------------------------------------------------------------------
  // LOAD TODAY'S ORDERS
  // ---------------------------------------------------------------------------

  Future<List<OrderModel>> loadOrders(String token, String cartId) async {
    _isLoading = true;

    try {
      final fetchedOrders = await _orderService.fetchOrders(token, cartId);

      // This is the MASTER list.
      //
      // Do NOT filter PENDING/PAID here.
      // The screen handles Active filtering.
      _orders = fetchedOrders;

      initSocket(cartId);

      return _orders;
    } finally {
      _isLoading = false;

      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // LOAD ALL ORDERS / OVERVIEW
  // ---------------------------------------------------------------------------

  Future<List<OrderModel>> loadAllOrders(
    String token,
    String cartId,
    String startDate,
    String endDate,
  ) async {
    _isLoading = true;

    try {
      _ordersOverview = await _orderService.fetchAllOrders(
        token,
        cartId,
        startDate,
        endDate,
      );

      return _ordersOverview;
    } finally {
      _isLoading = false;

      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // MARK ORDER PAID
  // ---------------------------------------------------------------------------

  Future<OrderModel?> markOrderPaid(String? token, String orderId) async {
    try {
      final updatedOrder = await _orderService.markPaid(token, orderId);

      final index = _orders.indexWhere((order) => order.id == orderId);

      if (index != -1) {
        // Update the master list.
        //
        // PENDING -> PAID
        //
        // Both are Active, so it remains in Active.
        //
        // It also remains in All.
        _orders[index] = updatedOrder;
      }

      return updatedOrder;
    } finally {
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // MARK ORDER UNPAID
  // ---------------------------------------------------------------------------

  Future<OrderModel?> markOrderUnpaid(String? token, String orderId) async {
    try {
      final updatedOrder = await _orderService.markUnpaid(token, orderId);

      final index = _orders.indexWhere((order) => order.id == orderId);

      if (index != -1) {
        _orders[index] = updatedOrder;
      }

      return updatedOrder;
    } finally {
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // UPDATE ORDER
  // ---------------------------------------------------------------------------

  Future<OrderModel?> updateOrder(
    String? token,
    String orderId,
    Map<String, dynamic> orderData,
  ) async {
    try {
      final result = await _orderService.updateOrder(token, orderId, orderData);

      final index = _orders.indexWhere((order) => order.id == orderId);

      if (index != -1) {
        _orders[index] = result.order.copyWith(
          paymentAdjustment: result.paymentAdjustment,
        );
      }

      return result.order;
    } finally {
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // SERVE ORDER
  // ---------------------------------------------------------------------------

  Future<OrderModel> serveOrder(String? token, String orderId) async {
    try {
      final updatedOrder = await _orderService.serveOrder(token, orderId);

      final index = _orders.indexWhere((order) => order.id == orderId);

      if (index != -1) {
        // IMPORTANT:
        //
        // DO NOT remove the order from _orders.
        //
        // Change:
        //
        // PAID -> SERVED
        //
        // The Active tab will automatically stop showing it because
        // Active only contains PENDING and PAID.
        //
        // The All tab will still show it because it remains in _orders.
        _orders[index] = updatedOrder;
      }

      return updatedOrder;
    } finally {
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // SERVE ORDER UNDO
  // ---------------------------------------------------------------------------

  Future<OrderModel?> serveOrderUndo(String? token, String orderId) async {
    try {
      final updatedOrder = await _orderService.serveOrderUndo(token, orderId);

      final index = _orders.indexWhere((order) => order.id == orderId);

      if (index != -1) {
        // The server should return the order with its restored status.
        //
        // For example:
        //
        // SERVED -> PAID
        //
        // Since Active filters PENDING/PAID, it will automatically
        // appear in Active again.
        _orders[index] = updatedOrder;
      } else {
        // Safety fallback.
        //
        // If somehow the order is not in the master list, add the
        // server version back.
        _orders.add(updatedOrder);
      }

      return updatedOrder;
    } finally {
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE ORDER
  // ---------------------------------------------------------------------------

  Future<OrderModel?> deleteOrder(String? token, String orderId) async {
    try {
      final result = await _orderService.deleteOrder(token, orderId);

      final index = _orders.indexWhere((order) => order.id == orderId);

      if (index != -1) {
        // Keep the order in the master list.
        // Replace it with the CANCELLED order returned by backend.
        _orders[index] = result.order.copyWith(
          paymentAdjustment: result.paymentAdjustment,
        );
      }

      return result.order;
    } finally {
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE ORDER UNDO
  // ---------------------------------------------------------------------------

  Future<OrderModel?> deleteOrderUndo(String? token, String orderId) async {
    try {
      final updatedOrder = await _orderService.deleteOrderUndo(token, orderId);

      // Make sure we don't add a duplicate.
      final existingIndex = _orders.indexWhere((order) => order.id == orderId);

      if (existingIndex == -1) {
        final insertIndex = _lastRemovedIndex ?? _orders.length;

        final safeIndex = insertIndex.clamp(0, _orders.length);

        // IMPORTANT:
        // Use the SERVER response instead of _lastRemovedOrder.
        //
        // This guarantees the restored order has the current
        // server-side status/data.
        _orders.insert(safeIndex, updatedOrder);
      } else {
        _orders[existingIndex] = updatedOrder;
      }

      return updatedOrder;
    } finally {
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE/UNDO STATE CLEANUP
  // ---------------------------------------------------------------------------

  void clearLastRemovedOrder() {
    _lastRemovedIndex = null;
  }

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  List<OrderModel> searchOrders(String query) {
    if (query.isEmpty) {
      return orders;
    }

    final q = query.toLowerCase();

    return orders.where((order) {
      final items = order.orderItems
          .map((item) => item.name.toLowerCase())
          .join(" ");

      final orderNumber = order.orderNumber.toLowerCase();

      return items.contains(q) || orderNumber.contains(q);
    }).toList();
  }

  // ---------------------------------------------------------------------------
  // MENU
  // ---------------------------------------------------------------------------

  Future<void> loadMenu(String token, String cartId) async {
    try {
      _isLoading = true;

      notifyListeners();

      _menu = await _service.fetchMenu(token, cartId);
    } finally {
      _isLoading = false;

      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // CART ITEMS
  // ---------------------------------------------------------------------------

  void addItem(MenuItemModel item) {
    _cart[item.id] = (_cart[item.id] ?? 0) + 1;

    notifyListeners();
  }

  void removeItem(MenuItemModel item) {
    if ((_cart[item.id] ?? 0) > 0) {
      _cart[item.id] = _cart[item.id]! - 1;

      final hasItems = _cart.values.any((count) => count > 0);

      if (!hasItems) {
        _parcelPrice = 0;
      }

      notifyListeners();
    }
  }

  int getCount(MenuItemModel item) {
    return _cart[item.id] ?? 0;
  }

  double get subtotal {
    double total = 0;

    for (final item in _menu) {
      total += item.price * (_cart[item.id] ?? 0);
    }

    return total;
  }

  double get total {
    return subtotal + parcelPrice + platformFee;
  }

  List<Map<String, dynamic>> get orderItems {
    return _menu
        .where((item) => (_cart[item.id] ?? 0) > 0)
        .map(
          (item) => {
            "menuItemId": item.id,
            "name": item.name,
            "price": item.price,
            "quantity": _cart[item.id],
          },
        )
        .toList();
  }

  void clearOrder() {
    _cart.clear();

    _parcelPrice = 0;

    notifyListeners();
  }

  void setParcelPrice(double value) {
    final hasItems = _cart.values.any((count) => count > 0);

    _parcelPrice = hasItems ? value : 0;

    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // MENU SORTING
  // ---------------------------------------------------------------------------

  List<MenuItemModel> getMenuWithSelectedItemsOnTop() {
    final selected = <MenuItemModel>[];
    final unselected = <MenuItemModel>[];

    for (final item in _menu) {
      if ((_cart[item.id] ?? 0) > 0) {
        selected.add(item);
      } else {
        unselected.add(item);
      }
    }

    return [...selected, ...unselected];
  }

  // ---------------------------------------------------------------------------
  // CLEAR ALL STATE
  // ---------------------------------------------------------------------------

  void clear() {
    // Orders
    _orders = [];
    _ordersOverview = [];

    // Undo state
    _lastRemovedIndex = null;

    // Loading state
    _isLoading = false;

    // Menu
    _menu = [];

    // Cart / order items
    _cart.clear();
    _parcelPrice = 0;

    // Socket
    _socket?.dispose();
    _socket = null;

    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // DISPOSE
  // ---------------------------------------------------------------------------

  @override
  void dispose() {
    _socket?.dispose();

    super.dispose();
  }
}

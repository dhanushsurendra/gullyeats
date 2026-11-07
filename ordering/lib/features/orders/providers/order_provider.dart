import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/models/order_item_model.dart';
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

  // Separate flags so loading the menu or the overview doesn't show a
  // spinner on the Orders tab.
  bool _isOrdersLoading = false;
  bool _isMenuLoading = false;
  bool _isOverviewLoading = false;

  bool get isOrdersLoading => _isOrdersLoading;
  bool get isMenuLoading => _isMenuLoading;
  bool get isOverviewLoading => _isOverviewLoading;

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

  bool get _hasItems => _cart.values.any((count) => count > 0);

  /// The typed parcel charge, applied only once the order has items.
  double get parcelPrice => _hasItems ? _parcelPrice : 0;

  double get platformFee => _hasItems ? 2.0 : 0.0;

  // ---------------------------------------------------------------------------
  // SOCKET
  // ---------------------------------------------------------------------------

  socket_io.Socket? _socket;

  StreamSubscription<List<ConnectivityResult>>? _network;

  bool _isLive = false;

  /// True while the live-order connection is up.
  bool get isLive => _isLive;

  /// The latest order that arrived live, for the screen's alert.
  final ValueNotifier<OrderModel?> incomingOrder = ValueNotifier(null);

  // Orders that just arrived; their cards glow for a few seconds.
  final Set<String> _freshIds = {};

  bool isFresh(String orderId) => _freshIds.contains(orderId);

  void _setLive(bool value) {
    if (_isLive == value) return;
    _isLive = value;
    notifyListeners();
  }

  /// Off in widget tests, which have no server to connect to.
  @visibleForTesting
  static bool liveUpdates = true;

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

  void _addOrUpdateOrder(dynamic data, {bool isNew = false}) {
    final updatedOrder = OrderModel.fromJson(data);

    final existingIndex = _orders.indexWhere(
      (order) => order.id == updatedOrder.id,
    );

    if (existingIndex == -1) {
      // New order → top of the newest-first list.
      _orders.insert(0, updatedOrder);

      if (isNew) {
        _freshIds.add(updatedOrder.id);
        incomingOrder.value = updatedOrder;
        Future.delayed(const Duration(seconds: 6), () {
          if (_freshIds.remove(updatedOrder.id)) notifyListeners();
        });
      }
    } else {
      // Order already exists → update it.
      _orders[existingIndex] = updatedOrder;
    }

    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // SOCKET
  // ---------------------------------------------------------------------------

  /// Joins the cart's live-order room. The server only lets someone who
  /// manages the cart in, so the login token goes with the connection.
  void initSocket(String cartId, String token) {
    _socket?.dispose();

    _socket = socket_io.io(
      ApiConstants.socketUrl,
      socket_io.OptionBuilder()
          .setTransports(['websocket'])
          .setQuery({'cartId': cartId})
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );

    final socket = _socket!;
    var connectedBefore = false;

    socket.connect();

    socket.onConnect((_) {
      debugPrint('Connected to Socket.io');

      socket.emit('join_vendor', cartId);
      _setLive(true);

      // Orders placed while the connection was down never reached us.
      if (connectedBefore) {
        reloadAfterReconnect(token, cartId, isCurrent: () => _socket == socket);
      }
      connectedBefore = true;
    });

    // The socket only notices a dead connection after a missed heartbeat
    // (up to ~45s), so a short outage can pass unseen and its orders are
    // lost. Reconnect as soon as the phone is back online instead.
    var wentOffline = false;
    _network?.cancel();
    _network = Connectivity().onConnectivityChanged.listen((results) {
      if (results.contains(ConnectivityResult.none)) {
        wentOffline = true;
        _setLive(false);
      } else if (wentOffline) {
        wentOffline = false;
        socket
          ..disconnect()
          ..connect();
      }
    }, onError: (Object e) {
      // Without network events the socket's own heartbeat still reconnects.
      debugPrint('Network watch unavailable: $e');
    });

    _socket!.onConnectError((_) => _setLive(false));

    // New order
    _socket!.on('new_order_received', (data) {
      _addOrUpdateOrder(data, isNew: true);
    });

    // Existing order updated
    _socket!.on('order_updated', (data) {
      _addOrUpdateOrder(data);
    });

    // Customer (or another device) cancelled an order
    _socket!.on('order_cancelled', (data) {
      _addOrUpdateOrder(data);
    });

    _socket!.onDisconnect((_) {
      debugPrint('Disconnected from Socket.io');
      _setLive(false);
    });
  }

  /// Re-fetches today's orders after the live connection comes back. Orders
  /// that arrived meanwhile glow, and the newest one raises the alert.
  /// [isCurrent] is false once the vendor switched carts mid-request.
  @visibleForTesting
  Future<void> reloadAfterReconnect(
    String token,
    String cartId, {
    bool Function()? isCurrent,
  }) async {
    final List<OrderModel> fetched;
    try {
      fetched = await _orderService.fetchOrders(token, cartId);
    } catch (e) {
      // The list stays as it was; pull-to-refresh still works.
      debugPrint('Reload after reconnect failed: $e');
      return;
    }
    if (isCurrent != null && !isCurrent()) return;

    final known = {for (final order in _orders) order.id};
    final missed = fetched.where((order) => !known.contains(order.id)).toList();
    _orders = fetched;

    for (final order in missed) {
      _freshIds.add(order.id);
      Future.delayed(const Duration(seconds: 6), () {
        if (_freshIds.remove(order.id)) notifyListeners();
      });
    }
    // The list is newest first.
    if (missed.isNotEmpty) incomingOrder.value = missed.first;

    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // LOAD TODAY'S ORDERS
  // ---------------------------------------------------------------------------

  Future<List<OrderModel>> loadOrders(String token, String cartId) async {
    _isOrdersLoading = true;

    try {
      final fetchedOrders = await _orderService.fetchOrders(token, cartId);

      // This is the MASTER list.
      //
      // Do NOT filter PENDING/PAID here.
      // The screen handles Active filtering.
      _orders = fetchedOrders;

      if (liveUpdates) initSocket(cartId, token);

      return _orders;
    } finally {
      _isOrdersLoading = false;

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
    _isOverviewLoading = true;
    notifyListeners();

    try {
      _ordersOverview = await _orderService.fetchAllOrders(
        token,
        cartId,
        startDate,
        endDate,
      );

      return _ordersOverview;
    } finally {
      _isOverviewLoading = false;

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
          .map((item) => '${item.name} ${item.displayName}'.toLowerCase())
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
      _isMenuLoading = true;

      notifyListeners();

      _menu = await _service.fetchMenu(token, cartId);
    } finally {
      _isMenuLoading = false;

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

      notifyListeners();
    }
  }

  /// Loads an existing order for editing. Its lines keep the price they
  /// were ordered at, and lines whose item has left the menu stay editable,
  /// matching how the server re-prices an edit.
  void startEditing(OrderModel order) {
    _cart.clear();

    final lines = {for (final line in order.orderItems) line.menuItemId: line};

    _menu = [
      for (final item in _menu)
        lines.containsKey(item.id)
            ? item.copyWith(price: lines[item.id]!.price)
            : item,
      for (final line in lines.values)
        if (!_menu.any((item) => item.id == line.menuItemId)) _lineAsItem(line),
    ];

    for (final line in lines.values) {
      _cart[line.menuItemId] = line.quantity;
    }

    _parcelPrice = order.parcelCharge;

    notifyListeners();
  }

  MenuItemModel _lineAsItem(OrderItemModel line) => MenuItemModel(
    id: line.menuItemId,
    name: line.name,
    names: line.names,
    price: line.price,
    isVeg: true,
    isInStock: true,
    cartId: '',
    imageUrl: '',
  );

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
    _parcelPrice = value < 0 ? 0 : value;

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
    _isOrdersLoading = false;
    _isMenuLoading = false;
    _isOverviewLoading = false;

    // Menu
    _menu = [];

    // Cart / order items
    _cart.clear();
    _parcelPrice = 0;

    // Socket
    _socket?.dispose();
    _socket = null;
    _network?.cancel();
    _network = null;
    _isLive = false;
    _freshIds.clear();
    incomingOrder.value = null;

    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // DISPOSE
  // ---------------------------------------------------------------------------

  @override
  void dispose() {
    _socket?.dispose();
    _network?.cancel();
    incomingOrder.dispose();

    super.dispose();
  }
}

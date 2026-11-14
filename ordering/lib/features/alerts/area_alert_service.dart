import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:ordering/core/constants/api_constants.dart';
import 'package:ordering/core/error/api_exception.dart';

/// What a nearby vendor reported (backend controllers/areaAlertController.js).
/// The sending cart is never named.
class AreaAlert {
  final String id;

  /// EVICTION, ROAD_BLOCKED, RAIN or CROWD.
  final String reason;
  final int distanceM;
  final DateTime createdAt;
  final int confirmations;

  /// Vendors behind it: the reporter plus each "I see it too" (for a group
  /// from [groupAreaAlerts], every report and confirmation in it).
  final int vendors;
  final bool confirmedByMe;

  /// Sent from this cart.
  final bool mine;

  const AreaAlert({
    required this.id,
    required this.reason,
    required this.distanceM,
    required this.createdAt,
    required this.confirmations,
    required this.vendors,
    required this.confirmedByMe,
    required this.mine,
  });

  factory AreaAlert.fromJson(Map<String, dynamic> j) => AreaAlert(
    id: j['_id'].toString(),
    reason: j['reason'] as String,
    distanceM: (j['distanceM'] as num).toInt(),
    createdAt: DateTime.parse(j['createdAt'] as String),
    confirmations: (j['confirmations'] as num?)?.toInt() ?? 0,
    vendors: 1 + ((j['confirmations'] as num?)?.toInt() ?? 0),
    confirmedByMe: j['confirmedByMe'] == true,
    mine: j['mine'] == true,
  );
}

/// One alert per reason (so at most 4), however many vendors reported it.
/// [AreaAlert.vendors] adds up every report and "I see it too" in it; the
/// distance is the nearest report from another cart, the time the newest.
/// "I see it too" goes to the newest report from another cart, and is hidden
/// once this cart has reported or confirmed any of them.
List<AreaAlert> groupAreaAlerts(List<AreaAlert> alerts) {
  final byReason = <String, List<AreaAlert>>{};
  for (final a in alerts) {
    (byReason[a.reason] ??= []).add(a);
  }
  final groups = [
    for (final list in byReason.values)
      () {
        list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        final others = list.where((a) => !a.mine).toList();
        final target = others.isEmpty ? list.first : others.first;
        return AreaAlert(
          id: target.id,
          reason: target.reason,
          distanceM: (others.isEmpty ? list : others)
              .map((a) => a.distanceM)
              .reduce((a, b) => a < b ? a : b),
          createdAt: list.first.createdAt,
          confirmations: list.fold(0, (n, a) => n + a.confirmations),
          vendors: list.fold(0, (n, a) => n + a.vendors),
          confirmedByMe: list.any((a) => a.mine || a.confirmedByMe),
          mine: others.isEmpty,
        );
      }(),
  ];
  groups.sort((a, b) => b.createdAt.compareTo(a.createdAt));
  return groups;
}

class AreaAlertService {
  static const reasons = ['EVICTION', 'ROAD_BLOCKED', 'RAIN', 'CROWD'];

  static String _url(String cartId) =>
      '${ApiConstants.carts}/area-alerts/$cartId';

  static Map<String, String> _headers(String token) => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  static Future<List<AreaAlert>> list(String token, String cartId) async {
    final res = await http
        .get(Uri.parse(_url(cartId)), headers: _headers(token))
        .timeout(const Duration(seconds: 15));
    final data = _check(res);
    return [
      for (final a in data['data'] as List)
        AreaAlert.fromJson(a as Map<String, dynamic>),
    ];
  }

  static Future<void> send(String token, String cartId, String reason) async {
    final res = await http
        .post(
          Uri.parse(_url(cartId)),
          headers: _headers(token),
          body: jsonEncode({'reason': reason}),
        )
        .timeout(const Duration(seconds: 15));
    _check(res);
  }

  static Future<void> confirm(
    String token,
    String cartId,
    String alertId,
  ) async {
    final res = await http
        .post(
          Uri.parse('${_url(cartId)}/confirm/$alertId'),
          headers: _headers(token),
        )
        .timeout(const Duration(seconds: 15));
    _check(res);
  }

  static Map<String, dynamic> _check(http.Response res) {
    final data = res.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    throw ApiException(
      data['message']?.toString() ?? 'Something went wrong',
      res.statusCode,
    );
  }
}

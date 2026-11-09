class ItemStat {
  final String name;
  final double revenue;
  final int qty;

  const ItemStat({required this.name, required this.revenue, required this.qty});

  factory ItemStat.fromJson(Map<String, dynamic> json) {
    return ItemStat(
      name: json['name']?.toString() ?? '-',
      revenue: _toDouble(json['revenue']),
      qty: _toInt(json['qty']),
    );
  }
}

class HourCount {
  final int hour;
  final int count;

  const HourCount({required this.hour, required this.count});

  factory HourCount.fromJson(Map<String, dynamic> json) {
    return HourCount(hour: _toInt(json['hour']), count: _toInt(json['count']));
  }

  /// 24h hour -> "1 AM", "2 PM" etc, kept short for chart labels.
  String get label {
    final h = hour % 12 == 0 ? 12 : hour % 12;
    final suffix = hour < 12 ? 'AM' : 'PM';
    return '$h$suffix';
  }
}

/// Paid revenue on one IST day ("2026-11-06").
class DaySales {
  final DateTime day;
  final double revenue;

  const DaySales({required this.day, required this.revenue});

  factory DaySales.fromJson(Map<String, dynamic> json) => DaySales(
    day: DateTime.tryParse(json['day']?.toString() ?? '') ?? DateTime(2000),
    revenue: _toDouble(json['revenue']),
  );
}

/// A customer's written feedback (with their star rating, if they gave one).
class FeedbackNote {
  final String text;
  final int? rating;
  final DateTime? at;

  const FeedbackNote({required this.text, this.rating, this.at});

  factory FeedbackNote.fromJson(Map<String, dynamic> json) => FeedbackNote(
    text: json['text']?.toString() ?? '',
    rating: json['rating'] == null ? null : _toInt(json['rating']),
    at: DateTime.tryParse(json['at']?.toString() ?? '')?.toLocal(),
  );
}

/// The vendor's sales report for a date range. Fields added later
/// (comparison, days, customers, ratings, feedback, unsold items) are null or empty
/// when the backend is older, and the screen leaves those parts out.
class SalesModel {
  // revenue (the hero card)
  final double revenue;
  final double subtotalRevenue;
  final double parcelRevenue;
  final double platformFeeRevenue;
  final double netRevenue;

  // orders
  final int paidOrders; // PAID + SERVED: every order that brought money in
  final double avgOrderValue;
  final int pendingOrders;
  final int cancelledOrders;
  final double unpaidValue;
  final double cancelledValue;

  // the same number of days just before
  final double? previousRevenue;
  final int? previousOrders;
  final double? previousAvgOrderValue;

  // trends
  final List<DaySales> days;
  final List<HourCount> hours;
  final int? peakHour;

  // customers and service; the rating and feedback are all-time
  final int customers;
  final int returningCustomers;
  final double? avgRating;
  final int ratingCount;
  final List<FeedbackNote> recentFeedback;
  final String? avgWaitAfterPayment;

  // order type and parcel
  final int qrOrders;
  final int manualOrders;
  final double qrRevenue;
  final double manualRevenue;
  final int parcelOrders;
  final double avgParcelCharge;

  // items
  final int totalItemsSold;
  final double avgItemsPerOrder;
  final List<ItemStat> topItems;
  final List<String> unsoldItems;

  const SalesModel({
    required this.revenue,
    required this.subtotalRevenue,
    required this.parcelRevenue,
    required this.platformFeeRevenue,
    required this.netRevenue,
    required this.paidOrders,
    required this.avgOrderValue,
    required this.pendingOrders,
    required this.cancelledOrders,
    required this.unpaidValue,
    required this.cancelledValue,
    this.previousRevenue,
    this.previousOrders,
    this.previousAvgOrderValue,
    required this.days,
    required this.hours,
    this.peakHour,
    required this.customers,
    required this.returningCustomers,
    this.avgRating,
    required this.ratingCount,
    required this.recentFeedback,
    this.avgWaitAfterPayment,
    required this.qrOrders,
    required this.manualOrders,
    required this.qrRevenue,
    required this.manualRevenue,
    required this.parcelOrders,
    required this.avgParcelCharge,
    required this.totalItemsSold,
    required this.avgItemsPerOrder,
    required this.topItems,
    required this.unsoldItems,
  });

  factory SalesModel.fromJson(Map<String, dynamic> json) {
    final previous = json['previous'] as Map<String, dynamic>?;
    List<T> list<T>(String key, T Function(Map<String, dynamic>) parse) =>
        ((json[key] as List?) ?? []).map((e) => parse(e as Map<String, dynamic>)).toList();

    return SalesModel(
      revenue: _toDouble(json['revenue']),
      subtotalRevenue: _toDouble(json['subtotalRevenue']),
      parcelRevenue: _toDouble(json['parcelRevenue']),
      platformFeeRevenue: _toDouble(json['platformFeeRevenue']),
      netRevenue: _toDouble(json['netRevenue']),
      paidOrders: _toInt(json['paidOrders']) + _toInt(json['servedOrders']),
      avgOrderValue: _toDouble(json['avgOrderValue']),
      pendingOrders: _toInt(json['pendingOrders']),
      cancelledOrders: _toInt(json['cancelledOrders']),
      unpaidValue: _toDouble(json['unpaidValue']),
      cancelledValue: _toDouble(json['cancelledValue']),
      previousRevenue: previous == null ? null : _toDouble(previous['revenue']),
      previousOrders: previous == null ? null : _toInt(previous['orders']),
      previousAvgOrderValue: previous == null ? null : _toDouble(previous['avgOrderValue']),
      days: list('days', DaySales.fromJson),
      // An older backend sends only the top five hours, as busyHours.
      hours: list(json['hours'] == null ? 'busyHours' : 'hours', HourCount.fromJson),
      peakHour: json['peakHour'] == null ? null : _toInt(json['peakHour']),
      customers: _toInt(json['customers']),
      returningCustomers: _toInt(json['returningCustomers']),
      avgRating: json['avgRating'] == null ? null : _toDouble(json['avgRating']),
      ratingCount: _toInt(json['ratingCount']),
      recentFeedback: list('recentFeedback', FeedbackNote.fromJson),
      avgWaitAfterPayment: (json['avgWaitAfterPayment'] ?? json['avgServeAfterPaymentTime'])?.toString(),
      qrOrders: _toInt(json['qrOrders']),
      manualOrders: _toInt(json['manualOrders']),
      qrRevenue: _toDouble(json['qrRevenue']),
      manualRevenue: _toDouble(json['manualRevenue']),
      parcelOrders: _toInt(json['parcelOrders']),
      avgParcelCharge: _toDouble(json['avgParcelCharge']),
      totalItemsSold: _toInt(json['totalItemsSold']),
      avgItemsPerOrder: _toDouble(json['avgItemsPerOrder']),
      topItems: list('topItems', ItemStat.fromJson),
      unsoldItems: ((json['unsoldItems'] as List?) ?? []).map((e) => e.toString()).toList(),
    );
  }
}

double _toDouble(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

int _toInt(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
}

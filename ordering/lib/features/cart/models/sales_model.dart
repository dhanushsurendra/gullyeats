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

class SalesModel {
  // revenue
  final double revenue;
  final double subtotalRevenue;
  final double parcelRevenue;
  final double platformFeeRevenue;
  final double netRevenue;

  // order counts
  final int totalOrders;
  final int pendingOrders;
  final int paidOrders;
  final int servedOrders;
  final int cancelledOrders;

  // rates (0-100)
  final double completionRate;
  final double cancellationRate;
  final double paymentRate;

  // order value
  final double avgOrderValue;
  final double highestOrder;
  final double lowestOrder;
  final double revenuePerOrder;

  // items
  final int totalItemsSold;
  final double avgItemsPerOrder;
  final int highestItemsInOrder;
  final int uniqueItemsSold;

  // timings (already formatted strings from backend, e.g. "4 min 12 sec")
  final String? avgPrepTime;
  final String? fastestOrder;
  final String? slowestOrder;
  final String? avgPaymentTime;
  final String? avgServeAfterPaymentTime;

  // timing patterns
  final int? peakHour;
  final int? slowestHour;
  final List<HourCount> busyHours;
  final String? averageTimeBetweenOrders;

  // order type
  final int qrOrders;
  final int manualOrders;
  final double qrRevenue;
  final double manualRevenue;

  // parcel
  final int parcelOrders;
  final double avgParcelCharge;

  // items leaderboard
  final String? topRevenueItem;
  final String? topVolumeItem;
  final List<ItemStat> topItems;
  final List<ItemStat> bottomItems;

  const SalesModel({
    required this.revenue,
    required this.subtotalRevenue,
    required this.parcelRevenue,
    required this.platformFeeRevenue,
    required this.netRevenue,
    required this.totalOrders,
    required this.pendingOrders,
    required this.paidOrders,
    required this.servedOrders,
    required this.cancelledOrders,
    required this.completionRate,
    required this.cancellationRate,
    required this.paymentRate,
    required this.avgOrderValue,
    required this.highestOrder,
    required this.lowestOrder,
    required this.revenuePerOrder,
    required this.totalItemsSold,
    required this.avgItemsPerOrder,
    required this.highestItemsInOrder,
    required this.uniqueItemsSold,
    this.avgPrepTime,
    this.fastestOrder,
    this.slowestOrder,
    this.avgPaymentTime,
    this.avgServeAfterPaymentTime,
    this.peakHour,
    this.slowestHour,
    required this.busyHours,
    this.averageTimeBetweenOrders,
    required this.qrOrders,
    required this.manualOrders,
    required this.qrRevenue,
    required this.manualRevenue,
    required this.parcelOrders,
    required this.avgParcelCharge,
    this.topRevenueItem,
    this.topVolumeItem,
    required this.topItems,
    required this.bottomItems,
  });

  factory SalesModel.fromJson(Map<String, dynamic> json) {
    return SalesModel(
      revenue: _toDouble(json['revenue']),
      subtotalRevenue: _toDouble(json['subtotalRevenue']),
      parcelRevenue: _toDouble(json['parcelRevenue']),
      platformFeeRevenue: _toDouble(json['platformFeeRevenue']),
      netRevenue: _toDouble(json['netRevenue']),
      totalOrders: _toInt(json['totalOrders']),
      pendingOrders: _toInt(json['pendingOrders']),
      paidOrders: _toInt(json['paidOrders']),
      servedOrders: _toInt(json['servedOrders']),
      cancelledOrders: _toInt(json['cancelledOrders']),
      completionRate: _toDouble(json['completionRate']),
      cancellationRate: _toDouble(json['cancellationRate']),
      paymentRate: _toDouble(json['paymentRate']),
      avgOrderValue: _toDouble(json['avgOrderValue']),
      highestOrder: _toDouble(json['highestOrder']),
      lowestOrder: _toDouble(json['lowestOrder']),
      revenuePerOrder: _toDouble(json['revenuePerOrder']),
      totalItemsSold: _toInt(json['totalItemsSold']),
      avgItemsPerOrder: _toDouble(json['avgItemsPerOrder']),
      highestItemsInOrder: _toInt(json['highestItemsInOrder']),
      uniqueItemsSold: _toInt(json['uniqueItemsSold']),
      avgPrepTime: json['avgPrepTime']?.toString(),
      fastestOrder: json['fastestOrder']?.toString(),
      slowestOrder: json['slowestOrder']?.toString(),
      avgPaymentTime: json['avgPaymentTime']?.toString(),
      avgServeAfterPaymentTime: json['avgServeAfterPaymentTime']?.toString(),
      peakHour: json['peakHour'] == null ? null : _toInt(json['peakHour']),
      slowestHour: json['slowestHour'] == null ? null : _toInt(json['slowestHour']),
      busyHours: ((json['busyHours'] as List?) ?? [])
          .map((e) => HourCount.fromJson(e as Map<String, dynamic>))
          .toList(),
      averageTimeBetweenOrders: json['averageTimeBetweenOrders']?.toString(),
      qrOrders: _toInt(json['qrOrders']),
      manualOrders: _toInt(json['manualOrders']),
      qrRevenue: _toDouble(json['qrRevenue']),
      manualRevenue: _toDouble(json['manualRevenue']),
      parcelOrders: _toInt(json['parcelOrders']),
      avgParcelCharge: _toDouble(json['avgParcelCharge']),
      topRevenueItem: json['topRevenueItem']?.toString(),
      topVolumeItem: json['topVolumeItem']?.toString(),
      topItems: ((json['topItems'] as List?) ?? [])
          .map((e) => ItemStat.fromJson(e as Map<String, dynamic>))
          .toList(),
      bottomItems: ((json['bottomItems'] as List?) ?? [])
          .map((e) => ItemStat.fromJson(e as Map<String, dynamic>))
          .toList(),
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
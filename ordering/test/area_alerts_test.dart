import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/alerts/area_alert_service.dart';

AreaAlert alert(
  String id,
  String reason,
  int minutesAgo, {
  int distanceM = 500,
  int confirmations = 0,
  bool mine = false,
  bool confirmedByMe = false,
}) => AreaAlert.fromJson({
  '_id': id,
  'reason': reason,
  'distanceM': distanceM,
  'createdAt': DateTime(
    2026,
    11,
    15,
    12,
  ).subtract(Duration(minutes: minutesAgo)).toIso8601String(),
  'confirmations': confirmations,
  'confirmedByMe': confirmedByMe,
  'mine': mine,
});

void main() {
  test('one row per reason, newest first, counting every vendor', () {
    final groups = groupAreaAlerts([
      alert('e1', 'EVICTION', 20, distanceM: 700, confirmations: 2),
      alert('r1', 'RAIN', 5),
      alert('e2', 'EVICTION', 3, distanceM: 300),
      alert('e3', 'EVICTION', 10, distanceM: 200, mine: true),
    ]);

    expect(groups.map((g) => g.reason), ['EVICTION', 'RAIN']);
    final eviction = groups.first;
    expect(eviction.vendors, 5); // e1 + 2 confirmations, e2, e3
    expect(
      eviction.id,
      'e2',
    ); // "I see it too" goes to the newest other cart's report
    expect(eviction.distanceM, 300); // nearest report from another cart
    expect(eviction.mine, isFalse);
    expect(eviction.confirmedByMe, isTrue); // this cart already reported it
    expect(groups.last.vendors, 1);
  });

  test('a group of only this cart\'s reports is its own', () {
    final g = groupAreaAlerts([alert('m', 'CROWD', 1, mine: true)]).single;
    expect(g.mine, isTrue);
  });
}

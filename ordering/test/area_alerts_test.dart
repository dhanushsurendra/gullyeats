import 'package:flutter_test/flutter_test.dart';
import 'package:ordering/features/alerts/area_alert_service.dart';
import 'package:ordering/features/alerts/area_alerts.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

  test('the Profile count clears once alerts are seen, and a new one counts again', () async {
    SharedPreferences.setMockInitialValues({});
    await AreaAlertsSeen.load();
    final mine = alert('m1', 'RAIN', 1, mine: true);
    final road = alert('r1', 'ROAD_BLOCKED', 2);
    expect(AreaAlertsSeen.unseen([road, mine]), 1, reason: 'own reports never count');

    await AreaAlertsSeen.markSeen([road, mine]);
    expect(AreaAlertsSeen.unseen([road, mine]), 0);

    final eviction = alert('e1', 'EVICTION', 0);
    expect(AreaAlertsSeen.unseen([eviction, road, mine]), 1);

    // Kept on the phone: a restart doesn't bring the count back.
    AreaAlertsSeen.ids.value = {};
    await AreaAlertsSeen.load();
    expect(AreaAlertsSeen.unseen([road]), 0);
  });

  test('an alert closed with X stays closed after a restart; a new one shows', () async {
    SharedPreferences.setMockInitialValues({});
    await AreaAlertsHidden.load();
    final road = alert('r1', 'ROAD_BLOCKED', 2);
    final old = alert('o1', 'RAIN', 90);
    await AreaAlertsHidden.hide(['r1'], [road]);

    AreaAlertsHidden.ids.value = {};
    await AreaAlertsHidden.load();
    expect(AreaAlertsHidden.ids.value, {'r1'});

    // Ended alerts are dropped on the next close, so the list stays small.
    final crowd = alert('c1', 'CROWD', 0);
    await AreaAlertsHidden.hide(['c1'], [crowd]);
    expect(AreaAlertsHidden.ids.value, {'c1'});
    expect(old.id, isNot(isIn(AreaAlertsHidden.ids.value)));
  });
}

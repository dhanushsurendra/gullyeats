import 'dart:math' as math;

import 'package:ordering/features/orders/models/menu_item_model.dart';
import 'package:ordering/features/orders/models/order_model.dart';

/// What a spoken command asks for, matched against this cart's menu and
/// today's orders. Plain word lists and edit distance: no AI.
sealed class VoiceCommand {
  const VoiceCommand();
}

class VoiceLine {
  final MenuItemModel item;
  int quantity;

  VoiceLine(this.item, this.quantity);
}

/// "2 masala dosa 1 filter coffee parcel paid".
class NewOrderCommand extends VoiceCommand {
  final List<VoiceLine> lines;
  final bool parcel;
  final bool paid;

  /// Words that were neither a dish, a number nor a known keyword.
  final List<String> unknown;

  const NewOrderCommand(
    this.lines, {
    this.parcel = false,
    this.paid = false,
    this.unknown = const [],
  });
}

/// "number 6 paid".
class MarkPaidCommand extends VoiceCommand {
  final OrderModel order;
  const MarkPaidCommand(this.order);
}

/// "number 7 served".
class ServeCommand extends VoiceCommand {
  final OrderModel order;
  const ServeCommand(this.order);
}

/// "#6 paid" when #6 isn't waiting for that step.
class OrderNotFound extends VoiceCommand {
  final int number;
  const OrderNotFound(this.number);
}

class NotUnderstood extends VoiceCommand {
  const NotUnderstood();
}

// ---------------------------------------------------------------------------
// Word lists (English, Hindi, Kannada, Tamil; romanised and in script)
// ---------------------------------------------------------------------------

const _numbers = <String, int>{
  // English
  'a': 1, 'an': 1, 'one': 1, 'single': 1, 'two': 2, 'double': 2, 'three': 3,
  'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
  'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
  'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
  'nineteen': 19, 'twenty': 20,
  // How the recogniser often writes "two": "to chicken biryani".
  'to': 2, 'too': 2,
  // Hindi
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'chaar': 4, 'paanch': 5,
  'panch': 5, 'chhe': 6, 'che': 6, 'chah': 6, 'saat': 7, 'aath': 8,
  'nau': 9, 'das': 10,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6,
  'छः': 6, 'छे': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  // Kannada
  'ondu': 1, 'eradu': 2, 'yeradu': 2, 'mooru': 3, 'muru': 3, 'naalku': 4,
  'nalku': 4, 'aidu': 5, 'eidu': 5, 'aaru': 6, 'elu': 7, 'yelu': 7,
  'entu': 8, 'yentu': 8, 'ombattu': 9, 'hattu': 10,
  'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5, 'ಆರು': 6,
  'ಏಳು': 7, 'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9, 'ಹತ್ತು': 10,
  // Tamil
  'onnu': 1, 'ondru': 1, 'oru': 1, 'rendu': 2, 'irandu': 2, 'moonu': 3,
  'moondru': 3, 'naalu': 4, 'nangu': 4, 'anju': 5, 'ainthu': 5, 'ezhu': 7,
  'ettu': 8, 'onbathu': 9, 'pathu': 10,
  'ஒன்று': 1, 'ஒன்னு': 1, 'ஒரு': 1, 'இரண்டு': 2, 'ரெண்டு': 2,
  'மூன்று': 3, 'மூணு': 3, 'நான்கு': 4, 'நாலு': 4, 'ஐந்து': 5, 'அஞ்சு': 5,
  'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
};

const _paid = {
  'paid',
  'pay',
  'payed',
  'cash',
  'upi',
  'paisa',
  'paise',
  'duddu',
  'panam',
  'पेड',
  'पैसे',
  'कैश',
  'ಪೇಡ್',
  'ಪೇಯ್ಡ್',
  'ಕ್ಯಾಶ್',
  'ದುಡ್ಡು',
  'பெய்டு',
  'பேய்டு',
  'பெய்ட்',
  'கேஷ்',
  'பணம்',
};

const _parcel = {
  'parcel',
  'parsal',
  'pack',
  'packing',
  'takeaway',
  'pacel',
  'पार्सल',
  'पैक',
  'ಪಾರ್ಸಲ್',
  'ಪಾರ್ಸೆಲ್',
  'ಪ್ಯಾಕ್',
  'பார்சல்',
  'பேக்',
};

const _serve = {
  'serve',
  'served',
  'serving',
  'ready',
  'done',
  'deliver',
  'delivered',
  'given',
  'sarve',
  'सर्व',
  'सर्वड',
  'रेडी',
  'तैयार',
  'ಸರ್ವ್',
  'ಸರ್ವ್ಡ್',
  'ರೆಡಿ',
  'சர்வ்',
  'சர்வ்டு',
  'ரெடி',
};

const _numberMarker = {
  'number',
  'no',
  'num',
  'nambar',
  'order',
  'नंबर',
  'नम्बर',
  'ऑर्डर',
  'ನಂಬರ್',
  'ಆರ್ಡರ್',
  'நம்பர்',
  'ஆர்டர்',
};

// Words that carry no item: "new order", "and", "please", "give".
const _filler = {
  'new',
  'and',
  'special',
  'spl',
  'extra',
  'please',
  'plus',
  'with',
  'give',
  'make',
  'of',
  'the',
  'x',
  'aur',
  'mattu',
  'matte',
  'kodi',
  'kodu',
  'chahiye',
  'dena',
  'venum',
  'kudu',
  'um',
  'uh',
  'ok',
  'okay',
  'नया',
  'और',
  'ಹೊಸ',
  'ಮತ್ತು',
  'ಕೊಡಿ',
  'புது',
  'மற்றும்',
  'குடு',
};

const _yes = {
  'yes',
  'yeah',
  'yep',
  'ya',
  'ok',
  'okay',
  'confirm',
  'confirmed',
  'done',
  'sure',
  'haan',
  'han',
  'ha',
  'ji',
  'theek',
  'houdu',
  'haudu',
  'sari',
  'aama',
  'ama',
  'aamam',
  // English "yes"/"ok" written in each script.
  'यस',
  'येस',
  'ओके',
  'ಯೆಸ್',
  'ಎಸ್',
  'யெஸ்',
  'எஸ்',
  'हाँ',
  'हां',
  'जी',
  'ठीक',
  'ಹೌದು',
  'ಸರಿ',
  'ಓಕೆ',
  'ஆமா',
  'ஆமாம்',
  'சரி',
  'ஓகே',
};

const _no = {
  'no',
  'nope',
  'cancel',
  'stop',
  'nahi',
  'nahin',
  'mat',
  'beda',
  'illa',
  'venda',
  'vendam',
  'illai',
  'नहीं',
  'नही',
  'मत',
  'ಬೇಡ',
  'ಇಲ್ಲ',
  'வேண்டாம்',
  'வேணாம்',
  'இல்லை',
};

/// Whether a short reply means yes (true), no (false) or neither (null).
bool? parseYesNo(String heard) {
  final words = _words(heard);
  if (words.any(_no.contains)) return false;
  if (words.any(_yes.contains)) return true;
  return null;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/// Lower-case, punctuation to spaces, nukta dropped, "2x" split.
String normalise(String s) => s
    .toLowerCase()
    .replaceAll(RegExp('[़಼஼]'), '')
    .replaceAllMapped(RegExp(r'(\d+)\s*[x×]'), (m) => '${m[1]} ')
    .replaceAll(RegExp(r'[^\p{L}\p{M}\p{N}#]+', unicode: true), ' ')
    .replaceAll('#', ' # ')
    .trim();

List<String> _words(String s) =>
    normalise(s).split(' ').where((w) => w.isNotEmpty).toList();

int? _number(String w) => int.tryParse(w) ?? _numbers[w];

/// 1 = the same, 0 = nothing alike (edit distance over the longer length).
double similarity(String a, String b) {
  if (a == b) return 1;
  if (a.isEmpty || b.isEmpty) return 0;
  final prev = List<int>.generate(b.length + 1, (i) => i);
  final cur = List<int>.filled(b.length + 1, 0);
  for (var i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (var j = 1; j <= b.length; j++) {
      final cost = a.codeUnitAt(i - 1) == b.codeUnitAt(j - 1) ? 0 : 1;
      cur[j] = math.min(
        math.min(cur[j - 1] + 1, prev[j] + 1),
        prev[j - 1] + cost,
      );
    }
    prev.setAll(0, cur);
  }
  return 1 - prev[b.length] / math.max(a.length, b.length);
}

const _minScore = 0.75;
// Longest dish name to try, in words ("ghee roast paper dosa with extra chutney").
const _maxWindow = 8;

/// Every spelling a menu item has (English and each script), spaces removed.
List<String> _spellings(MenuItemModel item) => {item.name, ...item.names.values}
    .map((n) => normalise(n).replaceAll(' ', ''))
    .where((n) => n.isNotEmpty)
    .toList();

/// The best reading among the recogniser's guesses (best first): the
/// earliest one that understands the most, so a guess that turned
/// "biryani" into "bury Annie" loses to one that heard the dish.
VoiceCommand parseBestVoiceCommand(
  List<String> guesses,
  List<MenuItemModel> menu,
  List<OrderModel> active,
) {
  int score(VoiceCommand c) => switch (c) {
    NotUnderstood() => -1000,
    OrderNotFound() => -500,
    NewOrderCommand c => -c.unknown.length,
    _ => 0,
  };
  VoiceCommand best = const NotUnderstood();
  for (final heard in guesses) {
    final command = parseVoiceCommand(heard, menu, active);
    if (score(command) > score(best)) best = command;
  }
  return best;
}

/// Understands one spoken command. [active] is today's orders, for "#N".
VoiceCommand parseVoiceCommand(
  String heard,
  List<MenuItemModel> menu,
  List<OrderModel> active,
) {
  final words = _words(heard);
  if (words.isEmpty) return const NotUnderstood();

  final spellings = {for (final item in menu) item: _spellings(item)};
  final longest = menu
      .expand((item) => {item.name, ...item.names.values})
      .map((n) => normalise(n).split(' ').length)
      .fold(1, math.max)
      .clamp(1, _maxWindow);

  // Each word of each name, and the dishes it appears in: "coffee" alone
  // means Filter Coffee when no other dish has that word.
  final byWord = <String, Set<MenuItemModel>>{};
  for (final item in menu) {
    for (final name in {item.name, ...item.names.values}) {
      for (final w in normalise(name).split(' ')) {
        // Joining words ("with", "and") never pick a dish.
        if (w.length >= 3 && !_filler.contains(w)) {
          (byWord[w] ??= {}).add(item);
        }
      }
    }
  }
  MenuItemModel? onlyDishWith(String word) {
    MenuItemModel? found;
    for (final MapEntry(key: w, value: items) in byWord.entries) {
      if (similarity(word, w) < 0.85) continue;
      if (items.length > 1 || (found != null && found != items.first)) {
        return null;
      }
      found = items.first;
    }
    return found;
  }

  // The best dish starting at word [i]: (item, words used, score).
  (MenuItemModel, int, double)? dishAt(int i) {
    (MenuItemModel, int, double)? best;
    for (var n = math.min(longest, words.length - i); n >= 1; n--) {
      final window = words.sublist(i, i + n);
      // A window can't start or end on a number or a keyword.
      if (window.any((w) => _number(w) != null && int.tryParse(w) != null)) {
        continue;
      }
      final text = window.join();
      for (final MapEntry(key: item, value: names) in spellings.entries) {
        for (final name in names) {
          final score = similarity(text, name);
          // Longer windows win ties: "ghee roast dosa" over "dosa".
          if (score >= _minScore && (best == null || score > best.$3 + 0.02)) {
            best = (item, n, score);
          }
        }
      }
    }
    // No full name matched: one word that only one dish has.
    if (best == null && _number(words[i]) == null && words[i].length >= 3) {
      final item = onlyDishWith(words[i]);
      if (item != null) best = (item, 1, _minScore - 0.001);
    }
    return best;
  }

  final lines = <VoiceLine>[];
  final unknown = <String>[];
  var parcel = false, paid = false, serve = false;
  int? pendingQty;
  int? firstNumber;
  var lastExplicit = true;

  void addLine(MenuItemModel item, int qty, bool explicit) {
    final existing = lines.where((l) => l.item.id == item.id).firstOrNull;
    if (existing != null) {
      existing.quantity += qty;
    } else {
      lines.add(VoiceLine(item, qty));
    }
    lastExplicit = explicit;
  }

  var i = 0;
  while (i < words.length) {
    final w = words[i];
    final asNumber = _number(w);
    var dish = dishAt(i);
    // "do masala dosa": "do" is two, unless the dish only matches with it.
    if (dish != null && asNumber != null) {
      final after = i + 1 < words.length ? dishAt(i + 1) : null;
      if (after != null && dish.$3 <= after.$3 + 0.05) dish = null;
    }
    if (dish != null) {
      // A lone word of the dish just said is the rest of its name, not
      // another one ("... dosa with extra chutney").
      final byOneWord = dish.$3 < _minScore;
      if (!(byOneWord &&
          pendingQty == null &&
          lines.isNotEmpty &&
          lines.last.item.id == dish.$1.id)) {
        addLine(dish.$1, pendingQty ?? 1, pendingQty != null);
      }
      pendingQty = null;
      i += dish.$2;
      continue;
    }
    if (asNumber != null) {
      firstNumber ??= asNumber;
      // "masala dosa 2": a number after a dish with no quantity of its own.
      if (pendingQty == null &&
          lines.isNotEmpty &&
          !lastExplicit &&
          (i + 1 >= words.length || dishAt(i + 1) == null)) {
        lines.last.quantity = asNumber;
        lastExplicit = true;
      } else {
        pendingQty = asNumber;
      }
      i++;
      continue;
    }
    if (_paid.contains(w)) {
      paid = true;
    } else if (_parcel.contains(w)) {
      parcel = true;
    } else if (_serve.contains(w)) {
      serve = true;
    } else if (!_filler.contains(w) && !_numberMarker.contains(w) && w != '#') {
      unknown.add(w);
    }
    i++;
  }

  // No dish, a number and paid/served: an existing order ("number 6 paid").
  if (lines.isEmpty && firstNumber != null && (paid || serve)) {
    final n = firstNumber;
    final wanted = serve ? 'PAID' : 'PENDING';
    final order = active
        .where((o) => o.orderNumber == '$n' && o.status == wanted)
        .firstOrNull;
    if (order == null) return OrderNotFound(n);
    return serve ? ServeCommand(order) : MarkPaidCommand(order);
  }

  if (lines.isEmpty) return const NotUnderstood();
  return NewOrderCommand(lines, parcel: parcel, paid: paid, unknown: unknown);
}

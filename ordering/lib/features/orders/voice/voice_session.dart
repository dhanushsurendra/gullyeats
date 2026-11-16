import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// The phone's own speech recogniser and voice, in the app's language. The
/// mic is on only inside [listen]; nothing is recorded or sent to GullyEats.
class VoiceSession {
  final _stt = SpeechToText();
  final _tts = FlutterTts();
  bool _ready = false;
  Completer<String>? _heard;
  String _words = '';

  static String get _lang => LanguageProvider.current.languageCode;
  static String get _sttLocale => switch (_lang) {
    'hi' => 'hi_IN',
    'kn' => 'kn_IN',
    'ta' => 'ta_IN',
    _ => 'en_IN',
  };
  static String get _ttsLocale => _sttLocale.replaceAll('_', '-');

  /// Sets up the recogniser (asks for the mic the first time). False when
  /// the mic is refused or the phone has no recogniser.
  Future<bool> init() async {
    if (_ready) return true;
    try {
      _ready = await _stt.initialize(
        onStatus: (status) {
          if (status == SpeechToText.doneStatus ||
              status == SpeechToText.notListeningStatus) {
            _finish(_words);
          }
        },
        onError: (SpeechRecognitionError e) => _finish(_words),
      );
    } catch (e) {
      debugPrint('Voice init failed: $e');
      _ready = false;
    }
    return _ready;
  }

  bool get isListening => _stt.isListening;

  void _finish(String words) {
    final c = _heard;
    if (c != null && !c.isCompleted) c.complete(words.trim());
  }

  /// Listens once and returns what was said ('' for nothing). Stops on its
  /// own after a [pauseFor] silence or [listenFor] in all. [onWords] gets
  /// the words as they come.
  Future<String> listen({
    void Function(String words)? onWords,
    Duration pauseFor = const Duration(seconds: 2),
    Duration listenFor = const Duration(seconds: 10),
  }) async {
    if (!await init()) return '';
    await stop();
    _words = '';
    final heard = _heard = Completer<String>();
    try {
      await _stt.listen(
        onResult: (SpeechRecognitionResult r) {
          _words = r.recognizedWords;
          onWords?.call(_words);
          if (r.finalResult) _finish(_words);
        },
        listenOptions: SpeechListenOptions(
          localeId: _sttLocale,
          pauseFor: pauseFor,
          listenFor: listenFor,
          partialResults: true,
          cancelOnError: true,
          listenMode: ListenMode.confirmation,
        ),
      );
    } catch (e) {
      debugPrint('Voice listen failed: $e');
      _finish('');
    }
    // A last guard in case the recogniser never reports back.
    return heard.future.timeout(
      listenFor + const Duration(seconds: 3),
      onTimeout: () => _words.trim(),
    );
  }

  Future<void> stop() async {
    if (_stt.isListening) await _stt.stop();
  }

  /// Says [text] aloud in the app's language and waits until it's done.
  /// Quietly skipped when the phone has no voice for that language.
  Future<void> say(String text) async {
    try {
      final ok = await _tts.isLanguageAvailable(_ttsLocale);
      if (ok != true) return;
      await _tts.setLanguage(_ttsLocale);
      await _tts.awaitSpeakCompletion(true);
      await _tts.speak(text);
    } catch (e) {
      debugPrint('Voice read-back failed: $e');
    }
  }

  Future<void> quiet() async {
    try {
      await _tts.stop();
    } catch (_) {}
    await stop();
  }
}

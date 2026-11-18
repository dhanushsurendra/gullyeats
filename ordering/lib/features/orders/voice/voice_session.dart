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
  Completer<List<String>>? _heard;
  String _words = '';
  List<String> _alternates = const [];
  // A "done" left over from the last listen must not end this one.
  bool _started = false;

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
          if (status == SpeechToText.listeningStatus) _started = true;
          if (_started &&
              (status == SpeechToText.doneStatus ||
                  status == SpeechToText.notListeningStatus)) {
            _finish();
          }
        },
        onError: (SpeechRecognitionError e) {
          debugPrint('Voice error: ${e.errorMsg}');
          if (_started || e.permanent) _finish();
        },
      );
    } catch (e) {
      debugPrint('Voice init failed: $e');
      _ready = false;
    }
    return _ready;
  }

  bool get isListening => _stt.isListening;

  void _finish() {
    final c = _heard;
    if (c != null && !c.isCompleted) c.complete(_result());
  }

  /// The recogniser's guesses, best first, without repeats or blanks.
  List<String> _result() {
    final all = {
      _words.trim(),
      ..._alternates.map((a) => a.trim()),
    }.where((a) => a.isNotEmpty).toList();
    debugPrint('Voice heard: $all');
    return all;
  }

  /// Listens once and returns the recogniser's guesses at what was said,
  /// best first (empty for nothing). Stops on its
  /// own after a [pauseFor] silence or [listenFor] in all. [onWords] gets
  /// the words as they come.
  Future<List<String>> listen({
    void Function(String words)? onWords,
    Duration pauseFor = const Duration(seconds: 3),
    Duration listenFor = const Duration(seconds: 15),
  }) async {
    if (!await init()) return const [];
    await stop();
    _words = '';
    _alternates = const [];
    _started = false;
    final heard = _heard = Completer<List<String>>();
    try {
      await _stt.listen(
        onResult: (SpeechRecognitionResult r) {
          _words = r.recognizedWords;
          _alternates = r.alternates.map((a) => a.recognizedWords).toList();
          onWords?.call(_words);
          if (r.finalResult) _finish();
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
      _finish();
    }
    // A last guard in case the recogniser never reports back.
    return heard.future.timeout(
      listenFor + const Duration(seconds: 3),
      onTimeout: _result,
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

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';

class OtpInputRow extends StatefulWidget {
  final Function(String) onCompleted;
  final Function(String) onChanged;

  const OtpInputRow({
    super.key,
    required this.onCompleted,
    required this.onChanged,
  });

  @override
  State<OtpInputRow> createState() => _OtpInputRowState();
}

class _OtpInputRowState extends State<OtpInputRow> {
  final List<TextEditingController> controllers = List.generate(
    6,
    (_) => TextEditingController(),
  );
  final List<FocusNode> focusNodes = List.generate(6, (_) => FocusNode());
  final List<FocusNode> listenerNodes = List.generate(6, (_) => FocusNode());

  @override
  void dispose() {
    for (var i = 0; i < 6; i++) {
      controllers[i].dispose();
      focusNodes[i].dispose();
      listenerNodes[i].dispose();
    }
    super.dispose();
  }

  void _handleInput(String value, int index) {
    final fullOtp = controllers.map((e) => e.text).join();
    widget.onChanged(fullOtp);

    if (value.isNotEmpty) {
      if (index < 5) {
        focusNodes[index + 1].requestFocus();
      } else {
        focusNodes[index].unfocus();
        widget.onCompleted(fullOtp);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(6, (index) {
        return SizedBox(
          width: 45,
          height: 55,
          child: KeyboardListener(
            focusNode: listenerNodes[index],
            onKeyEvent: (KeyEvent event) {
              if (event is KeyDownEvent &&
                  event.logicalKey == LogicalKeyboardKey.backspace &&
                  controllers[index].text.isEmpty &&
                  index > 0) {
                focusNodes[index - 1].requestFocus();
              }
            },
            child: TextField(
              controller: controllers[index],
              focusNode: focusNodes[index],
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: 1,
              style: AppTextStyles.heading2,
              autofocus: index == 0,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                counterText: "",
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.grey200),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(
                    color: AppColors.primary,
                    width: 2,
                  ),
                ),
              ),
              onChanged: (value) => _handleInput(value, index),
            ),
          ),
        );
      }),
    );
  }
}

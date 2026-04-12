import 'dart:async';
import 'package:flutter/material.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/routes/app_routes.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/auth/widgets/otp_input_row.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class VerifyOtpScreen extends StatefulWidget {
  const VerifyOtpScreen({super.key});

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen> {
  bool _isLoading = false;
  String? _errorMessage;
  String _currentOtp = "";

  late Timer _timer;
  int _start = 120;
  bool _canResend = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    if (mounted) {
      setState(() {
        _start = 120;
        _canResend = false;
        _errorMessage = null;
      });
    }
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_start == 0) {
        setState(() {
          _canResend = true;
          timer.cancel();
        });
      } else {
        setState(() => _start--);
      }
    });
  }

  void _handleResend() async {
    _startTimer();
    final phone = ModalRoute.of(context)?.settings.arguments as String? ?? "";

    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    try {
      final otp = await authProvider.sendOtp(phone);

      final Uri smsUri = Uri.parse("sms:$phone?body=Code - $otp");

      await launchUrl(smsUri);
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      setState(() {
        _errorMessage = message;
      });
    }
  }

  String get _timerText {
    final minutes = (_start ~/ 60).toString().padLeft(2, '0');
    final seconds = (_start % 60).toString().padLeft(2, '0');
    return "$minutes:$seconds";
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  void _handleManualVerify() {
    if (_currentOtp.length < 6) {
      setState(() => _errorMessage = "Please enter the complete 6-digit code");
      return;
    }
    _verifyOtp(_currentOtp);
  }

  Future<void> _verifyOtp(String otp) async {
    if (otp.length != 6) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final phone = ModalRoute.of(context)?.settings.arguments as String? ?? "";
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final result = await authProvider.verifyOtp(phone, otp);
      final data = {
        'phoneNumber': phone,
        'userId': result?['userId'] ?? '',
        'pin': result?['pin'] ?? '',
      };

      if (result != null) {
        if (mounted) {
          AppSnackBar.show(
            context,
            message: "OTP verified successfully!",
            isError: false,
          );

          await Future.delayed(const Duration(milliseconds: 400));

          if (!mounted) return;
          Navigator.pushNamed(
            context,
            AppRoutes.carts,
            arguments: data,
          );
        }
      } else {
        setState(() => _errorMessage = "Invalid OTP. Please try again.");
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      setState(() => _errorMessage = message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final phone = ModalRoute.of(context)?.settings.arguments;

    return BaseScreen(
      title: "Verify OTP",
      subtitle: "Enter the code sent to",
      onBack: () => Navigator.pop(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text("+91 $phone", style: AppTextStyles.heading3),
              AppGaps.w8,
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Text(
                  "Change",
                  style: AppTextStyles.heading3.copyWith(
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),

          AppGaps.h32,
          Center(child: Image.asset("assets/images/login.png", height: 160)),
          AppGaps.h32,
          OtpInputRow(
            onCompleted: (otp) {
              _currentOtp = otp;
              _verifyOtp(otp);
            },
            onChanged: (value) {
              setState(() {
                _currentOtp = value;
                _errorMessage = null;
              });
            },
          ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: _errorMessage != null
                ? Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.error_outline,
                          size: 16,
                          color: Colors.red,
                        ),
                        AppGaps.w8,
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: AppTextStyles.body.copyWith(
                              color: Colors.red,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),

          AppGaps.h32,
          AppButton(
            label: "VERIFY & CONTINUE",
            isLoading: _isLoading,
            onPressed: _currentOtp.length == 6 ? _handleManualVerify : null,
          ),

          AppGaps.h24,
          Center(
            child: Column(
              children: [
                Text.rich(
                  TextSpan(
                    text: "Didn't receive OTP? ",
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.grey400,
                    ),
                    children: [
                      WidgetSpan(
                        alignment: PlaceholderAlignment.middle,
                        child: GestureDetector(
                          onTap: _canResend ? _handleResend : null,
                          child: Text(
                            "Resend",
                            style: AppTextStyles.body.copyWith(
                              fontWeight: FontWeight.bold,
                              color: _canResend
                                  ? AppColors.primary
                                  : AppColors.grey300,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (!_canResend) ...[
                  AppGaps.h8,
                  Text(
                    "Resend available in $_timerText",
                    style: AppTextStyles.body.copyWith(
                      fontSize: 12,
                      color: AppColors.grey400,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

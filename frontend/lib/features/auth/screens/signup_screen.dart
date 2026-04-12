import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:provider/provider.dart';

import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_input.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/core/routes/app_routes.dart';

import 'package:url_launcher/url_launcher.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  late final TextEditingController _phoneController;
  String? _errorMessage;
  bool isLoading = false;

  @override
  void initState() {
    super.initState();
    _phoneController = TextEditingController();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  void _handleOtpSend() async {
    setState(() {
      isLoading = true;
    });

    FocusScope.of(context).unfocus();
    
    final phone = _phoneController.text.trim();
    final isValid = RegExp(r'^[6-9]\d{9}$').hasMatch(phone);

    if (!isValid) {
      setState(() {
        _errorMessage = "Please enter a valid 10-digit mobile number";
      });
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);

    try {
      final otp = await authProvider.sendOtp(phone);
      final Uri smsUri = Uri.parse("sms:$phone?body=Code - $otp");
      await launchUrl(smsUri);
      if (mounted) {
        Navigator.pushNamed(context, AppRoutes.verifyOtp, arguments: phone);
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      setState(() {
        _errorMessage = message;
      });
    } finally {
      isLoading = false;
    }
  }

  @override
  Widget build(BuildContext context) {

    return BaseScreen(
      title: 'Mobile Login',
      subtitle: 'Enter your mobile number to continue',
      showBackButton: false,
      centerContent: true,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Image.asset(
                "assets/images/login.png",
                height: 180,
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) => const Icon(
                  Icons.mobile_friendly,
                  size: 80,
                  color: AppColors.grey300,
                ),
              ),
            ),
            AppGaps.h32,
            AppInput(
              controller: _phoneController,
              label: "Mobile Number",
              hint: "0000000000",
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              prefix: const Padding(
                padding: EdgeInsets.only(left: 12, right: 8),
                child: Text("+91", style: AppTextStyles.heading3),
              ),
            ),

            if (_errorMessage != null) ...[
              AppGaps.h8,
              Text(
                _errorMessage!,
                style: AppTextStyles.body.copyWith(
                  color: Colors.red,
                  fontSize: 13,
                ),
              ),
            ],
            AppGaps.h24,
            AppButton(
              label: "SEND OTP",
              isLoading: isLoading,
              onPressed: _handleOtpSend,
            ),
            AppGaps.h32,
            const _TermsAndConditionFooter(),
          ],
        ),
      ),
    );
  }
}

class _TermsAndConditionFooter extends StatelessWidget {
  const _TermsAndConditionFooter();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Column(
        children: [
          Text(
            "By continuing, you agree to our",
            style: AppTextStyles.body.copyWith(
              fontSize: 12,
              color: AppColors.grey400,
            ),
          ),
          const SizedBox(height: 2),
          InkWell(
            onTap: () async {
              final url = Uri.parse(
                'https://dhanushsurendra.github.io/gullyeats-legal/',
              );
              if (await canLaunchUrl(url)) {
                await launchUrl(url, mode: LaunchMode.externalApplication);
              }
            },
            child: Text(
              "Terms of Service and Privacy Policy",
              style: AppTextStyles.body.copyWith(
                fontWeight: FontWeight.bold,
                fontSize: 12,
                color: AppColors.primary,
                decoration: TextDecoration.underline,
                decorationColor: AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

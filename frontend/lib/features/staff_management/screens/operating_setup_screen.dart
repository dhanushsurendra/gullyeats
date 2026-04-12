import 'package:flutter/material.dart';
import 'package:gullyeats/core/theme/app_colors.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';

enum OperatingMode { solo, staff }

class OperatingSetupScreen extends StatefulWidget {
  const OperatingSetupScreen({super.key});

  @override
  State<OperatingSetupScreen> createState() => _OperatingSetupScreenState();
}

class _OperatingSetupScreenState extends State<OperatingSetupScreen> {
  OperatingMode _selectedOption = OperatingMode.solo;

  bool get _isStaffOption => _selectedOption == OperatingMode.staff;

  void _handleContinue() async {
    if (_isStaffOption) {
      Navigator.pushNamed(context, '/staff-management');
    } else {
      Navigator.pushNamed(context, '/cart-activated');
    }
  }

  @override
  Widget build(BuildContext context) {
    return BaseScreen(
      title: 'Operating Setup',
      subtitle: "Tell us how your cart will be managed",
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
      bottomNavigationBar: _buildFooter(),
      child: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 16),
        children: [
          Center(
            child: Image.asset(
              "assets/images/operating.png",
              height: 180,
              fit: BoxFit.contain,
            ),
          ),
          AppGaps.h32,
          Text("How will you run the cart?", style: AppTextStyles.heading2),
          AppGaps.h16,
          _buildSelectionCard(
            mode: OperatingMode.solo,
            title: "I run it myself",
            subtitle: "Manage all orders on this phone",
            icon: Icons.person_outline,
          ),
          AppGaps.h16,
          _buildSelectionCard(
            mode: OperatingMode.staff,
            title: "My staff also runs it",
            subtitle: "Add staff members to help you",
            icon: Icons.group_outlined,
          ),
          AppGaps.h24,
          _buildInfoBox(),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(16),
        child: AppButton(
          label: _isStaffOption ? "ADD STAFF MEMBERS" : "SAVE & CONTINUE",
          onPressed: _handleContinue,
        ),
      ),
    );
  }

  Widget _buildInfoBox() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.grey100,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, size: 18, color: AppColors.primary),
          AppGaps.w12,
          Expanded(
            child: Text(
              _selectedOption == OperatingMode.solo
                  ? "All orders and serving details will be managed directly on this device."
                  : "You can assign roles to your staff and track their activity remotely.",
              style: AppTextStyles.caption.copyWith(height: 1.4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSelectionCard({
    required OperatingMode mode,
    required String title,
    required String subtitle,
    required IconData icon,
  }) {
    final isSelected = _selectedOption == mode;

    return InkWell(
      onTap: () => setState(() => _selectedOption = mode),
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.04)
              : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.grey200,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: isSelected ? AppColors.primary : AppColors.grey400,
            ),
            AppGaps.w16,

            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : AppColors.grey100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                color: isSelected ? AppColors.primary : AppColors.grey400,
              ),
            ),

            AppGaps.w16,

            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.body.copyWith(
                      fontWeight: FontWeight.bold,
                      color: isSelected ? Colors.black : AppColors.grey400,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: AppTextStyles.caption.copyWith(fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

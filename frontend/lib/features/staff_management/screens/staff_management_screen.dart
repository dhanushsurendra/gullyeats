import 'package:flutter/material.dart';
import 'package:gullyeats/core/error/app_exceptions.dart';
import 'package:gullyeats/core/theme/app_gaps.dart';
import 'package:gullyeats/core/theme/app_text_styles.dart';
import 'package:gullyeats/core/widgets/app_button.dart';
import 'package:gullyeats/core/widgets/app_snack_bar.dart';
import 'package:gullyeats/core/widgets/base_screen.dart';
import 'package:gullyeats/features/auth/providers/auth_provider.dart';
import 'package:gullyeats/features/onboarding/providers/cart_provider.dart';
import 'package:gullyeats/features/staff_management/models/staff.dart';
import 'package:gullyeats/features/staff_management/widgets/add_staff_form.dart';
import 'package:gullyeats/features/menu/widgets/staff_member_card.dart';
import 'package:gullyeats/features/staff_management/providers/staff_provider.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class StaffManagementScreen extends StatefulWidget {
  const StaffManagementScreen({super.key});

  @override
  State<StaffManagementScreen> createState() => _StaffManagementScreenState();
}

class _StaffManagementScreenState extends State<StaffManagementScreen> {
  bool _isLoading = false;
  bool _isStaffLoading = false;
  List<StaffModel> _staffList = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadStaff();
    });
  }

  Future<void> _loadStaff() async {
    setState(() => _isStaffLoading = true);

    try {
      final staffProvider = Provider.of<StaffProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final cartId = cartProvider.cartId;

      List<StaffModel> staffList = await staffProvider.loadStaff(
        auth.token,
        cartId!,
      );

      setState(() {
        _staffList = staffList;
      });
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true);
      }
    } finally {
      if (mounted) setState(() => _isStaffLoading = false);
    }
  }

  Future<void> _addStaff(String staffName, String staffPhone) async {
    setState(() => _isLoading = true);

    try {
      final staffProvider = Provider.of<StaffProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final cartId = cartProvider.cartId;

      StaffModel result = await staffProvider.addStaff(
        auth.token,
        staffName,
        staffPhone,
        cartId!,
      );

      if (mounted) {
        setState(() {
          _staffList.add(result);
        });
        AppSnackBar.show(context, message: "Staff added successfully!");
      }

      final message =
          "Your GullyEats credentials:\nUser ID: ${result.userId}\nPIN: ${result.pinHash}";
      final Uri smsUri = Uri(
        scheme: 'sms',
        path: staffPhone,
        queryParameters: {'body': message},
      );

      if (await canLaunchUrl(smsUri)) {
        launchUrl(smsUri);
      } else {
        throw 'could_not_launch_sms';
      }
    } catch (e) {
      if (mounted) {
        final errorMessage = (e == 'could_not_launch_sms')
            ? "Staff added, but couldn't open SMS app."
            : AppExceptionHandler.getMessage(e);

        AppSnackBar.show(context, message: errorMessage, isError: true);
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _onDelete(String staffId) async {
    try {
      final staffProvider = Provider.of<StaffProvider>(context, listen: false);
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final result = await staffProvider.deleteStaff(auth.token, staffId);

      if (result != '') {
        if (mounted) {
          AppSnackBar.show(context, message: result);
        }
        setState(() {
          _staffList.removeWhere((staff) => staff.id == staffId);
        });
      }
    } catch (e) {
      final message = AppExceptionHandler.getMessage(e);
      if (mounted) {
        AppSnackBar.show(context, message: message, isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BaseScreen(
      title: 'Staff Management',
      subtitle: "Add helpers who can run your cart using OTP.",
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
      bottomNavigationBar: _buildFooter(),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 16),
        children: [
          AddStaffForm(
            onAddStaff: (staffName, staffPhone) =>
                _addStaff(staffName, staffPhone),
            isLoading: _isLoading,
          ),
          AppGaps.h32,
          if (_staffList.isNotEmpty) ...[
            Text("Your Staff", style: AppTextStyles.heading3),
            AppGaps.h16,
          ],
          if (_isStaffLoading)
            const Center(child: CircularProgressIndicator())
          else if (_staffList.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  "No staff added yet",
                  style: AppTextStyles.body.copyWith(color: Colors.grey),
                ),
              ),
            )
          else
            ..._staffList.map(
              (staff) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: StaffMemberCard(
                  staffId: staff.id,
                  name: staff.name,
                  phone: staff.phoneNumber,
                  onDelete: _onDelete,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: AppButton(
          label: "CONTINUE",
          onPressed: () => Navigator.pushNamed(context, "/cart-activated"),
        ),
      ),
    );
  }
}

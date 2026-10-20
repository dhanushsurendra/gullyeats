import 'package:flutter/material.dart';
import 'package:ordering/app/home/widgets/bottom_nav_bar.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/features/cart/presentation/sales_screen.dart';
import 'package:ordering/features/orders/screens/orders_screen.dart';
import 'package:ordering/features/profile/presentation/profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 1;

  final List<Widget> _screens = const [
    SalesScreen(),
    OrdersScreen(),
    ProfileScreen(),
  ];

  void _onTabTap(int index) {
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      body: Stack(
        children: [
          Positioned.fill(
            child: IndexedStack(
              index: _currentIndex,
              children: List.generate(_screens.length, (i) {
                return AnimatedOpacity(
                  opacity: _currentIndex == i ? 1 : 0,
                  duration: const Duration(milliseconds: 250),
                  child: _screens[i],
                );
              }),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: BottomNavBar(currentIndex: _currentIndex, onTap: _onTabTap),
          ),
        ],
      ),
    );
  }
}

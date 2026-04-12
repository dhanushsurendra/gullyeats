import 'package:flutter/material.dart';
import 'package:gullyeats/features/staff_management/models/staff.dart';
import 'package:gullyeats/features/staff_management/services/staff_service.dart';

class StaffProvider with ChangeNotifier {
  final StaffService _staffService = StaffService();

  Future<StaffModel> addStaff(
    String? token,
    String staffName,
    String staffPhone,
    String cartId,
  ) async {
    try {
      final result = await _staffService.addStaff(
        token,
        cartId,
        staffName,
        staffPhone,
      );
      return result;
    } finally {
      notifyListeners();
    }
  }

  Future<List<StaffModel>> loadStaff(String? token, String cartId) async {
    try {
      List<StaffModel> staffList = await _staffService.getAllStaff(
        token,
        cartId,
      );
      return staffList;
    } finally {
      notifyListeners();
    }
  }

  Future<String> deleteStaff(String? token, String staffId) async {
    try {
      return await _staffService.deleteStaff(token, staffId);
    } finally {
      notifyListeners();
    }
  }
}

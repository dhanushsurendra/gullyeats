import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';

class LanguagePreferencesScreen extends StatefulWidget {
  const LanguagePreferencesScreen({super.key});

  @override
  State<LanguagePreferencesScreen> createState() =>
      _LanguagePreferencesScreenState();
}

class _LanguagePreferencesScreenState
    extends State<LanguagePreferencesScreen> {
  final List<String> languages = [
    "Kannada",
    "English",
    "Hindi",
  ];

  String selectedLanguage = "English";
  String searchQuery = "";

  List<String> get filteredLanguages {
    if (searchQuery.isEmpty) return languages;

    return languages
        .where((l) =>
            l.toLowerCase().contains(searchQuery.toLowerCase()))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      /// 🔶 APP BAR
      appBar: AppBar(
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.black),
          onPressed: () => Navigator.pop(context),
        ),
      ),

      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: AppPadding.screen,
              children: [
                /// 🔶 TITLE
                Text(
                  "Language Preferences",
                  style: AppTextStyles.heading1,
                ),
                AppGaps.h4,
                Text(
                  "Choose your preferred language for the app.",
                  style: AppTextStyles.caption,
                ),

                AppGaps.h16,

                /// 🔶 CURRENT LANGUAGE
                AppCard(
                  padding: AppPadding.card,
                  child: Row(
                    mainAxisAlignment:
                        MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment:
                            CrossAxisAlignment.start,
                        children: [
                          Text("Current Language",
                              style: AppTextStyles.caption),
                          AppGaps.h4,
                          Text(
                            selectedLanguage,
                            style: AppTextStyles.heading3,
                          ),
                          AppGaps.h4,
                          Text(
                            "Supported: Kannada, Hindi, English",
                            style: AppTextStyles.caption,
                          ),
                        ],
                      ),

                      Container(
                        padding: AppPadding.chip,
                        decoration: BoxDecoration(
                          color: AppColors.success.withOpacity(0.1),
                          borderRadius:
                              BorderRadius.circular(20),
                        ),
                        child: Text(
                          "✓ Selected",
                          style:
                              AppTextStyles.caption.copyWith(
                            color: AppColors.success,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      )
                    ],
                  ),
                ),

                AppGaps.h16,

                AppSearchBar(
                  onChanged: (val) =>
                      setState(() => searchQuery = val),
                  hintText: "Search language...",
                ),

                AppGaps.h16,

                /// 🔶 LIST HEADER
                Text(
                  "Available Languages",
                  style: AppTextStyles.heading3,
                ),

                AppGaps.h12,

                /// 🔶 LANGUAGE LIST
                ...filteredLanguages.map(
                  (lang) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _languageTile(lang),
                  ),
                ),

                AppGaps.h16,

                /// 🔶 INFO
                AppCard(
                  padding: AppPadding.smallCard,
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline,
                          size: 16, color: AppColors.grey500),
                      AppGaps.w8,
                      Expanded(
                        child: Text(
                          "Menu items will remain the same.",
                          style: AppTextStyles.caption,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          /// 🔶 BOTTOM ACTION
          Padding(
            padding: AppPadding.screen,
            child: Column(
              children: [
                AppButton(
                  onPressed: () {},
                  label: "SAVE LANGUAGE",
                ),
                AppGaps.h8,
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Text(
                    "Cancel",
                    style: AppTextStyles.caption.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 🔶 LANGUAGE TILE
  Widget _languageTile(String lang) {
    final isSelected = selectedLanguage == lang;

    return GestureDetector(
      onTap: () => setState(() => selectedLanguage = lang),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: AppPadding.card,
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: isSelected
              ? Border.all(
                  color: AppColors.primary,
                  width: 2,
                )
              : null,
          boxShadow: [
            BoxShadow(
              color: AppColors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: Row(
          mainAxisAlignment:
              MainAxisAlignment.spaceBetween,
          children: [
            Text(
              lang,
              style: AppTextStyles.body.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),

            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected
                      ? AppColors.primary
                      : AppColors.grey300,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Center(
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
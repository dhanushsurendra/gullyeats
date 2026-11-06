import 'package:flutter/material.dart';
import 'package:ordering/core/theme/app_colors.dart';
import 'package:ordering/core/theme/app_padding.dart';
import 'package:ordering/core/theme/app_text_styles.dart';
import 'package:ordering/core/theme/app_gaps.dart';
import 'package:ordering/core/widgets/app_button.dart';
import 'package:ordering/core/widgets/app_footer.dart';
import 'package:ordering/core/widgets/base_screen.dart';
import 'package:ordering/core/widgets/info_box.dart';
import 'package:ordering/core/widgets/app_card.dart';
import 'package:ordering/core/widgets/app_search_bar.dart';
import 'package:ordering/features/profile/providers/language_provider.dart';
import 'package:ordering/l10n/l10n.dart';
import 'package:provider/provider.dart';

class LanguagePreferencesScreen extends StatefulWidget {
  const LanguagePreferencesScreen({super.key});

  @override
  State<LanguagePreferencesScreen> createState() =>
      _LanguagePreferencesScreenState();
}

class _LanguagePreferencesScreenState
    extends State<LanguagePreferencesScreen> {
  /// English names too, so typing "Hindi" finds हिन्दी.
  static const _englishNames = {
    'en': 'English',
    'kn': 'Kannada',
    'hi': 'Hindi',
    'ta': 'Tamil',
  };

  String selectedCode = LanguageProvider.current.languageCode;
  String searchQuery = "";

  List<String> get filteredLanguages {
    final query = searchQuery.toLowerCase();
    return LanguageProvider.languages.keys
        .where((code) =>
            LanguageProvider.languages[code]!.toLowerCase().contains(query) ||
            _englishNames[code]!.toLowerCase().contains(query))
        .toList();
  }

  Future<void> _save() async {
    await context.read<LanguageProvider>().setLanguage(selectedCode);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final current = context.watch<LanguageProvider>().locale.languageCode;

    return BaseScreen(
      title: l10n.languagePreferences,
      subtitle: l10n.chooseLanguageSubtitle,
      onBack: () => Navigator.pop(context),
      expandToFullHeight: true,
      bottomNavigationBar: AppFooter(
        children: [AppButton(label: l10n.saveLanguageCaps, onPressed: _save)],
      ),
      child: ListView(
        children: [
          AppCard(
            padding: AppPadding.card,
            child: SizedBox(
              width: double.infinity,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.currentLanguage, style: AppTextStyles.caption),
                  AppGaps.h4,
                  Text(
                    LanguageProvider.languages[current]!,
                    style: AppTextStyles.heading3,
                  ),
                  AppGaps.h4,
                  Text(l10n.supportedLanguages, style: AppTextStyles.caption),
                ],
              ),
            ),
          ),
          AppGaps.h16,
          AppSearchBar(
            onChanged: (val) => setState(() => searchQuery = val),
            hintText: l10n.searchLanguage,
          ),
          AppGaps.h24,
          Text(l10n.availableLanguages, style: AppTextStyles.heading2),
          AppGaps.h12,
          for (final code in filteredLanguages) ...[
            _languageTile(code),
            AppGaps.h12,
          ],
          AppGaps.h4,
          InfoBox(lines: [l10n.menuItemsUnchanged]),
        ],
      ),
    );
  }

  /// 🔶 LANGUAGE TILE
  Widget _languageTile(String code) {
    final isSelected = selectedCode == code;

    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => setState(() => selectedCode = code),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: AppPadding.card,
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.grey200,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                LanguageProvider.languages[code]!,
                style: AppTextStyles.body.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: isSelected ? AppColors.primary : AppColors.grey300,
            ),
          ],
        ),
      ),
    );
  }
}

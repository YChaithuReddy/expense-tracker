import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Metadata for a single expense category — icon, colour, and subcategories.
class CategoryInfo {
  const CategoryInfo({
    required this.name,
    required this.icon,
    required this.color,
    this.subcategories = const [],
  });

  final String name;
  final IconData icon;
  final Color color;
  final List<String> subcategories;
}

/// Complete expense category taxonomy with Material icons and colors.
///
/// Use [ExpenseCategories.all] for the full list, or
/// [ExpenseCategories.byName] for O(1) lookup by category name.
abstract final class ExpenseCategories {
  // ─── Category Definitions ───────────────────────────────────────────
  static const List<CategoryInfo> all = [
    CategoryInfo(
      name: 'Transportation',
      icon: Icons.directions_car_rounded,
      color: Color(0xFF006699),
      subcategories: ['Cab', 'Auto', 'Metro', 'Bus', 'Train', 'Flight'],
    ),
    CategoryInfo(
      name: 'Food',
      icon: Icons.restaurant_rounded,
      color: Color(0xFFE65100),
    ),
    CategoryInfo(
      name: 'Accommodation',
      icon: Icons.hotel_rounded,
      color: Color(0xFF7B1FA2),
    ),
    CategoryInfo(
      name: 'Office Supplies',
      icon: Icons.inventory_2_rounded,
      color: Color(0xFF0277BD),
    ),
    CategoryInfo(
      name: 'Communication',
      icon: Icons.phone_in_talk_rounded,
      color: Color(0xFF00838F),
    ),
    CategoryInfo(
      name: 'Medical',
      icon: Icons.local_hospital_rounded,
      color: Color(0xFFC62828),
    ),
    CategoryInfo(
      name: 'Parking',
      icon: Icons.local_parking_rounded,
      color: Color(0xFF4527A0),
    ),
    CategoryInfo(
      name: 'Toll',
      icon: Icons.toll_rounded,
      color: Color(0xFF558B2F),
    ),
    CategoryInfo(
      name: 'Entertainment',
      icon: Icons.movie_rounded,
      color: Color(0xFFAD1457),
    ),
    CategoryInfo(
      name: 'Other',
      icon: Icons.more_horiz_rounded,
      color: AppColors.onSurfaceVariant,
    ),
  ];

  // ─── Lookup Map (lazy-initialised) ──────────────────────────────────
  static final Map<String, CategoryInfo> _byName = {
    for (final cat in all) cat.name: cat,
  };

  /// Returns [CategoryInfo] for the given [name], or a fallback "Other"
  /// category if no match is found.
  static CategoryInfo byName(String name) {
    return _byName[name] ?? all.last;
  }

  /// Returns just the icon for a category [name].
  static IconData iconFor(String name) => byName(name).icon;

  /// Returns just the color for a category [name].
  static Color colorFor(String name) => byName(name).color;

  /// Returns subcategories for a given category [name].
  static List<String> subcategoriesFor(String name) {
    return byName(name).subcategories;
  }

  /// All top-level category names.
  static List<String> get names => all.map((c) => c.name).toList();
}

/// Application-wide constants for FluxGen Expense Tracker.
///
/// Centralises Supabase configuration, category taxonomy,
/// payment modes, and visit types used throughout the app.
abstract final class AppConstants {
  // ─── App Identity ───────────────────────────────────────────────────
  static const String appName = 'FluxGen Expense Tracker';
  static const String appVersion = '2.4.2';

  // ─── Supabase ───────────────────────────────────────────────────────
  static const String supabaseUrl =
      'https://ynpquqlxafdvoealmfye.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlucHF1cWx4YWZkdm9lYWxtZnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDA2MjQsImV4cCI6MjA4NTU3NjYyNH0.ib7e4Xql3UCJCeGtB9VYpxwR1nzxLZJlGQxXtzVdmec';

  // ─── Sentry (automatic crash reporting) ──────────────────────────────
  static const String sentryDsn = 'https://12e2a66645af24681be742c8e7050317@o4511228261105664.ingest.us.sentry.io/4511228263530496';

  // ─── Pagination ─────────────────────────────────────────────────────
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  // ─── Categories (matches Fluxgen reimbursement sheet) ───────────────
  static const Map<String, List<String>> categories = {
    'Travel': ['Rapido', 'Uber', 'Ola', 'Auto', 'Personal Bike', 'Personal Car', 'Cab', 'Metro', 'Bus', 'Train', 'Flight', 'Portar', 'Other'],
    'Food Expense': [],
    'Postage & Courier Charges': [],
    'Stationery': [],
    'Office Supplies': [],
    'Project Consumables': [],
    'Accommodation': [],
    'Communication': [],
    'Other': [],
  };

  /// Categories that require travel fields (From/To/KM)
  static const Set<String> travelCategories = {'Travel'};
  static bool isTravelCategory(String? cat) => cat != null && travelCategories.contains(cat);

  /// Flat list of all top-level category names.
  static List<String> get categoryNames => categories.keys.toList();

  /// Returns subcategories for a given [category], or an empty list
  /// if the category has none or doesn't exist.
  static List<String> subcategoriesFor(String category) {
    return categories[category] ?? const [];
  }

  // ─── Payment Modes ──────────────────────────────────────────────────
  static const List<String> paymentModes = [
    'Cash',
    'Bank Transfer',
    'UPI',
  ];

  // ─── Visit Types ────────────────────────────────────────────────────
  static const List<String> visitTypes = [
    'Project',
    'Service',
    'Survey',
  ];

  // ─── Date / Time ────────────────────────────────────────────────────
  static const String dateFormat = 'dd MMM yyyy';
  static const String dateTimeFormat = 'dd MMM yyyy, hh:mm a';
  static const String monthYearFormat = 'MMMM yyyy';

  // ─── Validation ─────────────────────────────────────────────────────
  static const int maxExpenseAmount = 10000000; // ₹1 crore
  static const int maxDescriptionLength = 500;
  static const int maxReceiptImages = 5;
}

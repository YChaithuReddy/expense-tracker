import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/constants/categories.dart';
import '../../../core/theme/app_colors.dart';
import '../../shared/image_viewer_screen.dart';
import '../../../services/activity_log_service.dart';
import 'add_expense_screen.dart';

/// Displays the full details of a single expense.
///
/// Takes a raw Supabase [expense] map as its constructor parameter so that
/// this screen can be launched without requiring the [Expense] model.
/// Provides Edit and Delete actions.
class ExpenseDetailScreen extends StatefulWidget {
  /// Raw row from the Supabase `expenses` table.
  final Map<String, dynamic> expense;

  const ExpenseDetailScreen({super.key, required this.expense});

  @override
  State<ExpenseDetailScreen> createState() => _ExpenseDetailScreenState();
}

class _ExpenseDetailScreenState extends State<ExpenseDetailScreen> {
  final _supabase = Supabase.instance.client;
  late Map<String, dynamic> _expense;
  bool _isDeleting = false;
  String? _receiptImageUrl;
  bool _isLoadingImage = true;

  @override
  void initState() {
    super.initState();
    _expense = Map<String, dynamic>.from(widget.expense);
    _loadReceiptImage();
  }

  /// Fetches the first image from the expense_images junction table.
  Future<void> _loadReceiptImage() async {
    try {
      final expenseId = _expense['id'] as String;
      final rows = await _supabase
          .from('expense_images')
          .select('public_url')
          .eq('expense_id', expenseId)
          .limit(1);
      if (rows.isNotEmpty && mounted) {
        setState(() {
          _receiptImageUrl = rows[0]['public_url'] as String?;
        });
      }
    } catch (e) {
      debugPrint('Failed to load receipt image: $e');
    } finally {
      if (mounted) setState(() => _isLoadingImage = false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────
  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Delete Expense',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        content: const Text(
          'Are you sure you want to delete this expense? This action cannot be undone.',
          style: TextStyle(fontSize: 14, color: AppColors.onSurfaceVariant),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete',
                style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isDeleting = true);

    try {
      final expenseId = _expense['id'] as String;
      await _supabase.from('expenses').delete().eq('id', expenseId);

      if (!mounted) return;

      // Log activity
      ActivityLogService.log('expense_deleted', 'Deleted expense');

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Text('Expense deleted',
                  style: TextStyle(fontWeight: FontWeight.w500)),
            ],
          ),
          backgroundColor: AppColors.statusActive,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ),
      );

      Navigator.pop(context, true); // true signals the list should refresh
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to delete: $e',
              style: const TextStyle(fontWeight: FontWeight.w500)),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: const EdgeInsets.all(16),
        ),
      );
    } finally {
      if (mounted) setState(() => _isDeleting = false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────
  Future<void> _editExpense() async {
    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => AddExpenseScreen(existingExpense: _expense),
      ),
    );

    if (result == true && mounted) {
      // Re-fetch the updated expense from Supabase
      try {
        final updated = await _supabase
            .from('expenses')
            .select()
            .eq('id', _expense['id'] as String)
            .single();
        setState(() => _expense = updated);
        // Reload receipt image in case it was changed
        _loadReceiptImage();
      } catch (_) {
        // If fetch fails, pop back — the list will refresh anyway
        if (mounted) Navigator.pop(context, true);
      }
    }
  }

  // ── Build ────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final categoryStr = (_expense['category'] as String?) ?? 'Other';
    String mainCategory = categoryStr;
    String? subcategory;
    if (categoryStr.contains(' - ')) {
      final parts = categoryStr.split(' - ');
      mainCategory = parts[0].trim();
      subcategory = parts[1].trim();
    }
    final category = mainCategory;
    final catInfo = ExpenseCategories.byName(category);

    // Amount
    final amountRaw = _expense['amount'];
    final amount = (amountRaw is num)
        ? amountRaw.toDouble()
        : double.tryParse(amountRaw?.toString() ?? '0') ?? 0.0;
    final formattedAmount = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '\u20B9',
      decimalDigits: 2,
    ).format(amount);

    // Date
    final dateRaw = _expense['date']?.toString() ?? '';
    final date = DateTime.tryParse(dateRaw) ?? DateTime.now();
    final formattedDate = DateFormat(AppConstants.dateFormat).format(date);

    // Other fields
    final vendor = (_expense['vendor'] as String?) ?? 'N/A';
    final description = (_expense['description'] as String?) ?? '';
    final billAttached = (_expense['bill_attached'] as String?) == 'yes';

    // Visit type
    final visitTypeRaw =
        ((_expense['visit_type'] as String?) ?? 'project').toLowerCase();
    final visitType = switch (visitTypeRaw) {
      'service' => 'Service',
      'survey' => 'Survey',
      _ => 'Project',
    };

    // Payment mode
    final paymentModeRaw =
        ((_expense['payment_mode'] as String?) ?? 'cash').toLowerCase();
    final paymentMode = switch (paymentModeRaw) {
      'bank_transfer' || 'bank transfer' => 'Bank Transfer',
      'upi' => 'UPI',
      _ => 'Cash',
    };

    // Voucher status
    final voucherStatus = _expense['voucher_status'] as String?;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: Colors.white.withAlpha(240),
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.onSurfaceVariant),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Expense Details',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.onSurface,
            letterSpacing: -0.02,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined,
                size: 20, color: AppColors.primary),
            tooltip: 'Edit',
            onPressed: _editExpense,
          ),
          IconButton(
            icon: Icon(
              Icons.delete_outline_rounded,
              size: 20,
              color: _isDeleting
                  ? AppColors.onSurfaceVariant
                  : AppColors.error,
            ),
            tooltip: 'Delete',
            onPressed: _isDeleting ? null : _confirmDelete,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // ── Amount Hero Card ──────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.shadow.withAlpha(10),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Category icon
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: catInfo.color.withAlpha(25),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(catInfo.icon, color: catInfo.color, size: 28),
                  ),
                  const SizedBox(height: 16),

                  // Amount
                  Text(
                    formattedAmount,
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                      color: AppColors.onSurface,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Vendor
                  Text(
                    vendor,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Category badge
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _Badge(
                        label: category,
                        color: catInfo.color,
                        backgroundColor: catInfo.color.withAlpha(25),
                      ),
                      if (subcategory != null &&
                          subcategory.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        _Badge(
                          label: subcategory,
                          color: catInfo.color,
                          backgroundColor: catInfo.color.withAlpha(15),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Detail Rows Card ──────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.shadow.withAlpha(10),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  _DetailRow(
                    icon: Icons.calendar_today_rounded,
                    label: 'Date',
                    value: formattedDate,
                  ),
                  const _Divider(),
                  _DetailRow(
                    icon: Icons.work_outline_rounded,
                    label: 'Visit Type',
                    trailing: _Badge(
                      label: visitType,
                      color: AppColors.primary,
                      backgroundColor: AppColors.primary.withAlpha(20),
                    ),
                  ),
                  const _Divider(),
                  _DetailRow(
                    icon: Icons.payment_rounded,
                    label: 'Payment Mode',
                    trailing: _Badge(
                      label: paymentMode,
                      color: AppColors.statusReimbursed,
                      backgroundColor:
                          AppColors.statusReimbursed.withAlpha(20),
                    ),
                  ),
                  const _Divider(),
                  _DetailRow(
                    icon: Icons.receipt_long_rounded,
                    label: 'Bill Attached',
                    value: billAttached ? 'Yes' : 'No',
                  ),
                  if (voucherStatus != null &&
                      voucherStatus.isNotEmpty &&
                      voucherStatus != 'none') ...[
                    const _Divider(),
                    _DetailRow(
                      icon: Icons.assignment_turned_in_rounded,
                      label: 'Voucher Status',
                      trailing: _Badge(
                        label: voucherStatus[0].toUpperCase() +
                            voucherStatus.substring(1),
                        color: AppColors.statusForeground(voucherStatus),
                        backgroundColor:
                            AppColors.statusBackground(voucherStatus),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // ── Description Card (if exists) ──────────────────────
            if (description.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.shadow.withAlpha(10),
                      blurRadius: 20,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.notes_rounded,
                            size: 18, color: AppColors.primary),
                        SizedBox(width: 8),
                        Text(
                          'Description',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.onSurface,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      description,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // ── Receipt Image Card (loaded from expense_images) ─────
            if (_isLoadingImage && billAttached) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                height: 120,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.shadow.withAlpha(10),
                      blurRadius: 20,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Center(
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
            if (!_isLoadingImage &&
                _receiptImageUrl != null &&
                _receiptImageUrl!.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.shadow.withAlpha(10),
                      blurRadius: 20,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.image_rounded,
                            size: 18, color: AppColors.primary),
                        SizedBox(width: 8),
                        Text(
                          'Receipt',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.onSurface,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ImageViewerScreen(
                              imageUrl: _receiptImageUrl!,
                              title: 'Receipt',
                            ),
                          ),
                        );
                      },
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: CachedNetworkImage(
                          imageUrl: _receiptImageUrl!,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                            height: 200,
                            color: AppColors.surfaceContainerLow,
                            child: const Center(
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          errorWidget: (_, __, ___) => Container(
                            height: 120,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceContainerLow,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.broken_image_rounded,
                                      size: 32,
                                      color: AppColors.onSurfaceVariant),
                                  SizedBox(height: 8),
                                  Text(
                                    'Could not load receipt',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: Text(
                        'Tap image to view full size',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.onSurfaceVariant.withAlpha(160),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 24),

            // ── Action Buttons ────────────────────────────────────
            Row(
              children: [
                // Edit button
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: _editExpense,
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      label: const Text('Edit',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(
                            color: AppColors.primary, width: 1.5),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Delete button
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: _isDeleting ? null : _confirmDelete,
                      icon: _isDeleting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: AppColors.error),
                            )
                          : const Icon(Icons.delete_outline_rounded,
                              size: 18),
                      label: Text(
                        _isDeleting ? 'Deleting...' : 'Delete',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: BorderSide(
                          color: _isDeleting
                              ? AppColors.error.withAlpha(80)
                              : AppColors.error,
                          width: 1.5,
                        ),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Private helper widgets
// ═══════════════════════════════════════════════════════════════════════════

/// A single row in the detail card: icon + label on the left, value or
/// trailing widget on the right.
class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    this.value,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String? value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ),
          if (trailing != null) trailing!,
          if (value != null && trailing == null)
            Text(
              value!,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.onSurface,
              ),
            ),
        ],
      ),
    );
  }
}

/// Thin horizontal divider between detail rows.
class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 0.5,
      color: AppColors.outlineVariant.withAlpha(100),
    );
  }
}

/// Small colored badge chip for category, visit type, payment mode, etc.
class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.color,
    required this.backgroundColor,
  });

  final String label;
  final Color color;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

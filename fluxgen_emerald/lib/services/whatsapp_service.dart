import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

/// Service for sharing expense data via WhatsApp.
///
/// Constructs WhatsApp deep links with pre-filled messages and
/// opens them via `url_launcher`. Falls back to wa.me web URL
/// which works on both mobile and desktop.
class WhatsAppService {
  WhatsAppService();

  /// Sends an expense summary to [phoneNumber] via WhatsApp.
  ///
  /// [phoneNumber] should be in international format without '+' or spaces
  /// (e.g. '919876543210' for an Indian number).
  /// [message] is the pre-filled text to send.
  Future<void> sendExpenseSummary({
    required String phoneNumber,
    required String message,
  }) async {
    // Strip any non-digit characters
    final cleanNumber = phoneNumber.replaceAll(RegExp(r'[^\d]'), '');
    final encodedMessage = Uri.encodeComponent(message);

    final url = Uri.parse('https://wa.me/$cleanNumber?text=$encodedMessage');

    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        debugPrint('Could not launch WhatsApp URL: $url');
        throw Exception('WhatsApp is not installed or URL cannot be opened');
      }
    } catch (e) {
      debugPrint('WhatsApp send error: $e');
      rethrow;
    }
  }

  /// Builds a formatted expense summary message.
  ///
  /// Takes a list of expense maps (each having 'date', 'vendor', 'amount',
  /// 'category', 'description') and the employee's name. Returns a
  /// human-readable text summary suitable for WhatsApp.
  String buildExpenseSummary(
    List<Map<String, dynamic>> expenses,
    String employeeName,
  ) {
    final buffer = StringBuffer();

    buffer.writeln('*Expense Summary - $employeeName*');
    buffer.writeln('-----------------------------------');
    buffer.writeln();

    double total = 0;

    for (var i = 0; i < expenses.length; i++) {
      final e = expenses[i];
      final date = e['date'] ?? '';
      final vendor = e['vendor'] ?? e['description'] ?? '-';
      final category = e['category'] ?? '';
      final amount = (e['amount'] as num?)?.toDouble() ?? 0;
      total += amount;

      buffer.writeln('${i + 1}. $date');
      if (category.toString().isNotEmpty) {
        buffer.writeln('   Category: $category');
      }
      buffer.writeln('   Vendor: $vendor');
      buffer.writeln('   Amount: Rs. ${amount.toStringAsFixed(2)}');
      buffer.writeln();
    }

    buffer.writeln('-----------------------------------');
    buffer.writeln('*Total: Rs. ${total.toStringAsFixed(2)}*');
    buffer.writeln('*Expenses: ${expenses.length}*');
    buffer.writeln();
    buffer.writeln('_Sent from FluxGen Expense Tracker_');

    return buffer.toString();
  }
}

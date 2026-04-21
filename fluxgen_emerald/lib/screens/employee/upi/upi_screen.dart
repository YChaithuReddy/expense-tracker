import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// UPI Payment launcher screen.
///
/// Displays buttons for Google Pay, PhonePe, and Paytm.
/// Launches UPI payment intents with optional pre-filled amount and UPI ID.
/// Shows a snackbar if the target app is not installed.
class UpiScreen extends StatelessWidget {
  final String? amount;
  final String? upiId;

  const UpiScreen({
    super.key,
    this.amount,
    this.upiId,
  });

  Future<void> _launchUpiApp(
    BuildContext context, {
    required String scheme,
    required String appName,
  }) async {
    final pa = upiId ?? '';
    final am = amount ?? '';

    String uriString = '$scheme?';
    if (pa.isNotEmpty) uriString += 'pa=$pa&';
    if (am.isNotEmpty) uriString += 'am=$am&';
    // Remove trailing & or ?
    uriString = uriString.replaceAll(RegExp(r'[&?]$'), '');

    final uri = Uri.parse(uriString);

    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$appName is not installed'),
            backgroundColor: const Color(0xFFEA580C),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      }
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$appName is not installed'),
          backgroundColor: const Color(0xFFEA580C),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white.withValues(alpha: 0.95),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new,
            size: 18,
            color: Color(0xFF444653),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Pay via UPI',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
            letterSpacing: -0.02,
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header info
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF191C1E).withValues(alpha: 0.04),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.currency_rupee,
                    size: 40,
                    color: Color(0xFF006699),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Select Payment App',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                  if (amount != null && amount!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Amount: \u20B9$amount',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF059669),
                      ),
                    ),
                  ],
                  if (upiId != null && upiId!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      'UPI ID: $upiId',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Google Pay
            _UpiAppButton(
              appName: 'Google Pay',
              icon: Icons.g_mobiledata,
              iconColor: const Color(0xFF4285F4),
              bgColor: const Color(0xFF4285F4),
              onTap: () => _launchUpiApp(
                context,
                scheme: 'tez://upi/pay',
                appName: 'Google Pay',
              ),
            ),

            const SizedBox(height: 12),

            // PhonePe
            _UpiAppButton(
              appName: 'PhonePe',
              icon: Icons.phone_android,
              iconColor: const Color(0xFF5F259F),
              bgColor: const Color(0xFF5F259F),
              onTap: () => _launchUpiApp(
                context,
                scheme: 'phonepe://pay',
                appName: 'PhonePe',
              ),
            ),

            const SizedBox(height: 12),

            // Paytm
            _UpiAppButton(
              appName: 'Paytm',
              icon: Icons.account_balance_wallet,
              iconColor: const Color(0xFF00BAF2),
              bgColor: const Color(0xFF00BAF2),
              onTap: () => _launchUpiApp(
                context,
                scheme: 'paytm://upi/pay',
                appName: 'Paytm',
              ),
            ),

            const SizedBox(height: 24),

            // Info text
            const Center(
              child: Text(
                'If an app is not installed, you will be notified.',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFF9CA3AF),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UpiAppButton extends StatelessWidget {
  final String appName;
  final IconData icon;
  final Color iconColor;
  final Color bgColor;
  final VoidCallback onTap;

  const _UpiAppButton({
    required this.appName,
    required this.icon,
    required this.iconColor,
    required this.bgColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF191C1E).withValues(alpha: 0.04),
              blurRadius: 12,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: bgColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 28, color: iconColor),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    appName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Tap to open $appName',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios,
              size: 16,
              color: bgColor.withValues(alpha: 0.5),
            ),
          ],
        ),
      ),
    );
  }
}

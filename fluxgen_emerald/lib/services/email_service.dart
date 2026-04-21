import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// Service for sending reimbursement emails with optional PDF attachments.
///
/// Uses `url_launcher` to open the default email app with pre-filled fields
/// and `share_plus` to share the attachment when one is provided.
class EmailService {
  EmailService();

  /// Opens the default email client with pre-filled [toEmail], [subject],
  /// and [body].
  ///
  /// If [attachmentPath] is provided, uses `share_plus` to share the file
  /// (since mailto: URIs cannot carry attachments). The email fields are
  /// composed into the share text so the user can copy/paste or forward.
  ///
  /// When no attachment is present, a standard `mailto:` URI is launched.
  Future<void> sendReimbursementEmail({
    required String toEmail,
    required String subject,
    required String body,
    String? attachmentPath,
  }) async {
    if (attachmentPath != null && attachmentPath.isNotEmpty) {
      // Share the PDF file — the OS share sheet lets the user pick email
      // or any other app. We include the email context in the share text.
      final file = XFile(attachmentPath);

      await Share.shareXFiles(
        [file],
        text: 'To: $toEmail\n\n$body',
        subject: subject,
      );
    } else {
      // No attachment — open mailto: directly
      final mailtoUri = Uri(
        scheme: 'mailto',
        path: toEmail,
        queryParameters: {
          'subject': subject,
          'body': body,
        },
      );

      if (await canLaunchUrl(mailtoUri)) {
        await launchUrl(mailtoUri);
      } else {
        throw Exception(
          'Could not launch email client. '
          'Please ensure an email app is installed.',
        );
      }
    }
  }
}

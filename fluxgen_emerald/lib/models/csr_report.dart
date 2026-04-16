import 'dart:typed_data';

class CsrReport {
  CsrReport({
    String? csrNo,
    String? csrDate,
  }) : csrNo = csrNo ?? _generateCsrNo(),
       csrDate = csrDate ?? _todayStr();

  // Header
  String csrNo;
  String csrDate;
  String callBy = '';

  // Customer Details
  String customerName = '';
  String address = '';
  String city = '';
  String state = '';
  String zip = '';

  // Engineer & Instruction
  String instructionFrom = '';
  String inspectedBy = '';

  // Work Details
  String natureOfWork = '';
  String workDetails = '';
  String location = '';
  String statusAfter = 'Completed'; // Completed, In Progress, Pending, Requires Follow-up
  String defects = '';
  String remarks = '';

  // Service Timings
  String eventDate = '';
  String eventTime = '';
  String startTime = '';
  String endTime = '';

  // Customer Satisfaction
  String rating = ''; // Extremely Satisfied, Satisfied, Dissatisfied, Annoyed

  // Customer Feedback
  String feedbackRemarks = '';
  String feedbackName = '';
  String feedbackDesignation = '';
  String feedbackPhone = '';
  String feedbackEmail = '';
  String feedbackDate = '';

  // Signatures (PNG bytes from canvas export)
  Uint8List? customerSignature;
  Uint8List? engineerSignature;
  Uint8List? sealImage;

  static String _generateCsrNo() {
    final now = DateTime.now();
    return 'FGCS-${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
  }

  static String _todayStr() {
    final d = DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  static const List<String> statusOptions = [
    'Completed', 'In Progress', 'Pending', 'Requires Follow-up',
  ];

  static const List<String> ratingOptions = [
    'Extremely Satisfied', 'Satisfied', 'Dissatisfied', 'Annoyed',
  ];
}

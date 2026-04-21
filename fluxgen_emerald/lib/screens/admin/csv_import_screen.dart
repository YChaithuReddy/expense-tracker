import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:emerald/services/csv_import_service.dart';

/// Admin screen for importing CSV data into Supabase.
///
/// Provides three import sections:
///   - Import Employees (profiles table)
///   - Import Projects (projects table)
///   - Import Expenses (expenses table)
///
/// Each section describes the expected CSV columns, lets the user
/// pick a file, and shows a progress indicator and result count.
class CsvImportScreen extends StatefulWidget {
  const CsvImportScreen({super.key});

  @override
  State<CsvImportScreen> createState() => _CsvImportScreenState();
}

class _CsvImportScreenState extends State<CsvImportScreen> {
  final _csvService = CsvImportService();

  // ─── Per-section state ──────────────────────────────────────────────
  bool _employeesLoading = false;
  int? _employeesResult;
  String? _employeesError;

  bool _projectsLoading = false;
  int? _projectsResult;
  String? _projectsError;

  bool _expensesLoading = false;
  int? _expensesResult;
  String? _expensesError;

  // ─── Helpers ────────────────────────────────────────────────────────

  Future<String?> _getOrgId() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return null;
    try {
      final profile = await Supabase.instance.client
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .maybeSingle();
      return profile?['organization_id'] as String?;
    } catch (_) {
      return null;
    }
  }

  // ─── Import: Employees ──────────────────────────────────────────────

  Future<void> _importEmployees() async {
    setState(() {
      _employeesLoading = true;
      _employeesResult = null;
      _employeesError = null;
    });

    try {
      final filePath = await _csvService.pickCsvFile();
      if (filePath == null) {
        setState(() => _employeesLoading = false);
        return;
      }

      final orgId = await _getOrgId();
      if (orgId == null || orgId.isEmpty) {
        setState(() {
          _employeesError = 'Organization not found. Please contact admin.';
          _employeesLoading = false;
        });
        return;
      }

      final rows = await _csvService.parseCsvFile(filePath);
      if (rows.isEmpty) {
        setState(() {
          _employeesError = 'No data rows found in the CSV file.';
          _employeesLoading = false;
        });
        return;
      }

      final count = await _csvService.importEmployees(rows, orgId);
      setState(() {
        _employeesResult = count;
        _employeesLoading = false;
      });
    } catch (e) {
      setState(() {
        _employeesError = 'Import failed: $e';
        _employeesLoading = false;
      });
    }
  }

  // ─── Import: Projects ───────────────────────────────────────────────

  Future<void> _importProjects() async {
    setState(() {
      _projectsLoading = true;
      _projectsResult = null;
      _projectsError = null;
    });

    try {
      final filePath = await _csvService.pickCsvFile();
      if (filePath == null) {
        setState(() => _projectsLoading = false);
        return;
      }

      final orgId = await _getOrgId();
      if (orgId == null || orgId.isEmpty) {
        setState(() {
          _projectsError = 'Organization not found. Please contact admin.';
          _projectsLoading = false;
        });
        return;
      }

      final rows = await _csvService.parseCsvFile(filePath);
      if (rows.isEmpty) {
        setState(() {
          _projectsError = 'No data rows found in the CSV file.';
          _projectsLoading = false;
        });
        return;
      }

      final count = await _csvService.importProjects(rows, orgId);
      setState(() {
        _projectsResult = count;
        _projectsLoading = false;
      });
    } catch (e) {
      setState(() {
        _projectsError = 'Import failed: $e';
        _projectsLoading = false;
      });
    }
  }

  // ─── Import: Expenses ───────────────────────────────────────────────

  Future<void> _importExpenses() async {
    setState(() {
      _expensesLoading = true;
      _expensesResult = null;
      _expensesError = null;
    });

    try {
      final filePath = await _csvService.pickCsvFile();
      if (filePath == null) {
        setState(() => _expensesLoading = false);
        return;
      }

      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) {
        setState(() {
          _expensesError = 'Not logged in.';
          _expensesLoading = false;
        });
        return;
      }

      final rows = await _csvService.parseCsvFile(filePath);
      if (rows.isEmpty) {
        setState(() {
          _expensesError = 'No data rows found in the CSV file.';
          _expensesLoading = false;
        });
        return;
      }

      final count = await _csvService.importExpenses(rows, user.id);
      setState(() {
        _expensesResult = count;
        _expensesLoading = false;
      });
    } catch (e) {
      setState(() {
        _expensesError = 'Import failed: $e';
        _expensesLoading = false;
      });
    }
  }

  // ─── Build ──────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Import CSV',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF191C1E),
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF191C1E)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Info banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF006699).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFF006699).withValues(alpha: 0.2),
              ),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: Color(0xFF006699), size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Select a .csv file to import. The first row must be the header with column names.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF374151)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Import Employees ──
          _ImportSection(
            icon: Icons.people_outline,
            iconColor: const Color(0xFF006699),
            title: 'Import Employees',
            description:
                'Expected columns: name, email, employee_id, role, department',
            isLoading: _employeesLoading,
            result: _employeesResult,
            error: _employeesError,
            onImport: _importEmployees,
          ),
          const SizedBox(height: 14),

          // ── Import Projects ──
          _ImportSection(
            icon: Icons.folder_outlined,
            iconColor: const Color(0xFF8B5CF6),
            title: 'Import Projects',
            description:
                'Expected columns: project_code, project_name, client_name, description',
            isLoading: _projectsLoading,
            result: _projectsResult,
            error: _projectsError,
            onImport: _importProjects,
          ),
          const SizedBox(height: 14),

          // ── Import Expenses ──
          _ImportSection(
            icon: Icons.receipt_long_outlined,
            iconColor: const Color(0xFF059669),
            title: 'Import Expenses',
            description:
                'Expected columns: date, category, vendor, description, amount, payment_mode',
            isLoading: _expensesLoading,
            result: _expensesResult,
            error: _expensesError,
            onImport: _importExpenses,
          ),
        ],
      ),
    );
  }
}

// ── Import Section Widget ──────────────────────────────────────────────────

class _ImportSection extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String description;
  final bool isLoading;
  final int? result;
  final String? error;
  final VoidCallback onImport;

  const _ImportSection({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.description,
    required this.isLoading,
    required this.result,
    required this.error,
    required this.onImport,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF191C1E),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Description
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.description_outlined,
                    size: 16, color: Color(0xFF9CA3AF)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    description,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Import button or progress
          if (isLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  children: [
                    SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Color(0xFF006699),
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Importing...',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onImport,
                icon: const Icon(Icons.upload_file, size: 18),
                label: const Text('Choose CSV File'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: iconColor,
                  side: BorderSide(color: iconColor.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),

          // Result
          if (result != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: const Color(0xFF059669).withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle,
                      color: Color(0xFF059669), size: 18),
                  const SizedBox(width: 8),
                  Text(
                    'Successfully imported $result row${result == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF059669),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Error
          if (error != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: const Color(0xFFBA1A1A).withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline,
                      color: Color(0xFFBA1A1A), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      error!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFFBA1A1A),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

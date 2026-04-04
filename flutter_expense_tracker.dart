import 'package:flutter/material.dart';

// Modern Fintech Theme - Matches Figma Design & Template References
const Color _bgLight = Color(0xFFF8F9FA);
const Color _cardBg = Color(0xFFFFFFFF);
const Color _primaryTeal = Color(0xFF10B981);
const Color _primaryDark = Color(0xFF059669);
const Color _textPrimary = Color(0xFF1F2937);
const Color _textSecondary = Color(0xFF6B7280);
const Color _borderColor = Color(0xFFE5E7EB);

void main() {
  runApp(const ExpenseTrackerApp());
}

class ExpenseTrackerApp extends StatelessWidget {
  const ExpenseTrackerApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Expense Tracker',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _primaryTeal,
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: _bgLight,
        appBarTheme: AppBarTheme(
          backgroundColor: _cardBg,
          elevation: 0,
          centerTitle: false,
          titleTextStyle: const TextStyle(
            color: _primaryTeal,
            fontSize: 24,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.025,
          ),
          iconTheme: const IconThemeData(color: _textPrimary),
        ),
        cardTheme: CardTheme(
          color: _cardBg,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: _borderColor, width: 1),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: _primaryTeal,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            elevation: 0,
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: _textPrimary,
            side: const BorderSide(color: _borderColor),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: _cardBg,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _borderColor),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _borderColor),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: _primaryTeal, width: 2),
          ),
          hintStyle: const TextStyle(color: _textSecondary),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
        textTheme: const TextTheme(
          displayLarge: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            color: _textPrimary,
            letterSpacing: -0.02,
          ),
          displayMedium: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: _textPrimary,
          ),
          headlineSmall: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: _textPrimary,
          ),
          bodyLarge: TextStyle(
            fontSize: 16,
            color: _textPrimary,
            height: 1.5,
          ),
          bodyMedium: TextStyle(
            fontSize: 14,
            color: _textSecondary,
          ),
          labelMedium: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: _textPrimary,
          ),
        ),
      ),
      home: const IndexPage(),
    );
  }
}

class IndexPage extends StatelessWidget {
  const IndexPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 600;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Expense Tracker'),
        actions: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Center(
              child: Text(
                'Automate your reimbursement submissions',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            children: [
              // Hero Section - Scan Your Bill
              HeroCard(),
              const SizedBox(height: 24),

              // Cards Section (2 column on desktop, 1 column on mobile)
              if (isMobile)
                Column(
                  children: [
                    const UPIImportCard(),
                    const SizedBox(height: 20),
                    const TipsCard(),
                  ],
                )
              else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Expanded(child: UPIImportCard()),
                    const SizedBox(width: 20),
                    const Expanded(child: TipsCard()),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class HeroCard extends StatelessWidget {
  const HeroCard({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 600;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(40.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title
            Text(
              '📷 Scan Your Bill',
              style: Theme.of(context).textTheme.displayLarge,
            ),
            const SizedBox(height: 12),

            // Description
            Text(
              'Upload bill images to automatically extract expense details',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),

            // Buttons
            if (isMobile)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ElevatedButton.icon(
                    onPressed: () => _showAction(context, 'Camera'),
                    icon: const Text('📷'),
                    label: const Text('Camera'),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: () => _showAction(context, 'Gallery'),
                    icon: const Text('🖼️'),
                    label: const Text('Gallery'),
                  ),
                ],
              )
            else
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _showAction(context, 'Camera'),
                      icon: const Text('📷'),
                      label: const Text('Camera'),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _showAction(context, 'Gallery'),
                      icon: const Text('🖼️'),
                      label: const Text('Gallery'),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 24),

            // OR Divider
            Row(
              children: [
                Expanded(child: Container(height: 1, color: _borderColor)),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'OR',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
                Expanded(child: Container(height: 1, color: _borderColor)),
              ],
            ),
            const SizedBox(height: 24),

            // Manual Entry Button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _showAction(context, 'Manual Entry'),
                icon: const Text('✍️'),
                label: const Text('Enter Expense Manually (Without Bill)'),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Perfect for cash payments or when you don\'t have a receipt',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _showAction(BuildContext context, String action) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$action clicked')),
    );
  }
}

class UPIImportCard extends StatelessWidget {
  const UPIImportCard({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    const upiApps = ['Google Pay', 'PhonePe', 'Paytm', 'Airtel'];
    final isMobile = MediaQuery.of(context).size.width < 600;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '📱 Import from UPI',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              'Quick import from UPI apps',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),

            // UPI Apps Grid
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: isMobile ? 2 : 4,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1,
              ),
              itemCount: upiApps.length,
              itemBuilder: (context, index) {
                return UPIAppButton(app: upiApps[index]);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class UPIAppButton extends StatelessWidget {
  final String app;

  const UPIAppButton({required this.app, Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF3F4F6),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: () => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Opening $app')),
        ),
        borderRadius: BorderRadius.circular(8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('📲', style: TextStyle(fontSize: 24)),
            const SizedBox(height: 8),
            Text(
              app,
              style: Theme.of(context).textTheme.labelMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class TipsCard extends StatelessWidget {
  const TipsCard({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    const tips = [
      '✓ Use clear, well-lit photos',
      '✓ Include full receipt details',
      '✓ One receipt per image',
      '✓ Clear handwriting if manual',
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '💡 Tips for Best Results',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            ...tips.map((tip) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: Text(
                  tip,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }
}

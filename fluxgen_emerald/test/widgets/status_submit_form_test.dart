import 'package:emerald/models/fluxgen_status.dart';
import 'package:emerald/screens/attendance/widgets/status_submit_form.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _host({required StatusSubmitForm child}) =>
    MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));

void main() {
  testWidgets('renders 6 status cards', (tester) async {
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(empName: 'Alice', onSubmit: (_) async {}),
    ));
    expect(find.byKey(const Key('status_card_onSite')),       findsOneWidget);
    expect(find.byKey(const Key('status_card_inOffice')),     findsOneWidget);
    expect(find.byKey(const Key('status_card_workFromHome')), findsOneWidget);
    expect(find.byKey(const Key('status_card_onLeave')),      findsOneWidget);
    expect(find.byKey(const Key('status_card_holiday')),      findsOneWidget);
    expect(find.byKey(const Key('status_card_weekend')),      findsOneWidget);
  });

  testWidgets('tap On Site reveals site + work fields', (tester) async {
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(empName: 'Alice', onSubmit: (_) async {}),
    ));
    expect(find.byKey(const Key('site_name_field')), findsNothing);
    await tester.tap(find.byKey(const Key('status_card_onSite')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('site_name_field')), findsOneWidget);
    expect(find.byKey(const Key('work_type_field')), findsOneWidget);
    expect(find.byKey(const Key('scope_field')),     findsOneWidget);
  });

  testWidgets('tap On Leave hides all conditional fields', (tester) async {
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(empName: 'Alice', onSubmit: (_) async {}),
    ));
    await tester.tap(find.byKey(const Key('status_card_onLeave')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('site_name_field')), findsNothing);
    expect(find.byKey(const Key('work_type_field')), findsNothing);
    expect(find.byKey(const Key('scope_field')),     findsNothing);
  });

  testWidgets('submit without status shows validation message', (tester) async {
    StatusSubmitPayload? captured;
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(
        empName: 'Alice',
        onSubmit: (p) async => captured = p,
      ),
    ));
    await tester.tap(find.byKey(const Key('submit_btn')));
    await tester.pumpAndSettle();
    expect(find.text('Pick a status first'), findsOneWidget);
    expect(captured, isNull);
  });

  testWidgets('on-site submit with all fields calls onSubmit', (tester) async {
    StatusSubmitPayload? captured;
    await tester.pumpWidget(_host(
      child: StatusSubmitForm(
        empName: 'Alice',
        onSubmit: (p) async => captured = p,
      ),
    ));
    await tester.tap(find.byKey(const Key('status_card_onSite')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('site_name_field')), 'BLR');
    await tester.tap(find.byKey(const Key('work_type_field')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Project').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('scope_field')), 'HVAC');
    // After the form expands with conditional fields, submit may be below
    // the default test viewport — scroll it into view first.
    await tester.ensureVisible(find.byKey(const Key('submit_btn')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('submit_btn')));
    await tester.pumpAndSettle();

    expect(captured, isNotNull);
    expect(captured!.status, AttendanceStatus.onSite);
    expect(captured!.siteName, 'BLR');
    expect(captured!.workType, 'Project');
    expect(captured!.scopeOfWork, 'HVAC');
  });
}

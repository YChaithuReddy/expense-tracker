/// Central constants for the Fluxgen Employee Status integration.
///
/// Endpoint is a Google Apps Script Web App that backs both the
/// existing website (https://employee-status-one.vercel.app/) and
/// this Flutter app.
abstract final class FluxgenApi {
  static const String scriptUrl =
      'https://script.google.com/macros/s/'
      'AKfycbzFHKifKgVF5bW56sTV4PX0I-4bJn1PoGg6fXE8oQfoI-reRSRq07tBVKM_B-n-FVfqcw/exec';

  // GET actions
  static const String actionGetEmployees   = 'getEmployees';
  static const String actionGetStatus      = 'getStatus';
  static const String actionGetStatusRange = 'getStatusRange';

  // POST actions
  static const String actionSubmitStatus = 'submitStatus';

  // SharedPreferences keys
  static const String prefEmpId   = 'fluxgen_emp_id';
  static const String prefEmpName = 'fluxgen_emp_name';

  // Work type dropdown values (mirror website `mobile.html:543-547`)
  static const List<String> workTypes = [
    'Project',
    'Service',
    'Office Work',
    'BMS Integration',
    'Site Survey',
  ];
}

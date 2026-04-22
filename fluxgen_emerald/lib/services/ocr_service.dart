import 'package:flutter/foundation.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// OCR service — scans receipt images and extracts structured fields.
///
/// Covers three receipt families:
///   1. Classic shop/restaurant bills (Total, GST, line items)
///   2. UPI payment screenshots (Paytm / PhonePe / GPay / Kotak / HDFC)
///      — amount is often a standalone number, vendor sits under
///      "PAYMENT TO" / "Paid to", date may lack a year ("31 Mar, 06:24 PM").
///   3. Ride receipts (Rapido / Uber / Ola) — need pickup/drop extraction
///      so the add-expense flow can auto-fill From/To and calc distance.
///
/// Returned keys:
///   amount, date, vendor, category, subcategory,
///   modeOfExpense, fromLocation, toLocation, rawText.
class OcrService {
  OcrService._();

  /// Scan a receipt image and extract all fields.
  static Future<Map<String, String>> scanReceipt(String imagePath) async {
    try {
      final inputImage = InputImage.fromFilePath(imagePath);
      final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
      final result = await recognizer.processImage(inputImage);
      await recognizer.close();

      final rawText = result.text;
      if (rawText.trim().isEmpty) return _empty();

      final category = detectCategory(rawText);
      final subcategory = detectSubcategory(rawText, category) ?? '';
      final mode = _detectMode(rawText, subcategory);

      return {
        'amount': _extractAmount(rawText),
        'date': _extractDate(rawText),
        'vendor': _extractVendor(rawText),
        'category': category,
        'subcategory': subcategory,
        'modeOfExpense': mode,
        'fromLocation': _extractLocation(rawText, _fromKeywords),
        'toLocation': _extractLocation(rawText, _toKeywords),
        'rawText': rawText,
      };
    } catch (e) {
      debugPrint('OCR scan error: $e');
      return _empty();
    }
  }

  static Map<String, String> _empty() => {
        'amount': '', 'date': '', 'vendor': '',
        'category': '', 'subcategory': '',
        'modeOfExpense': '', 'fromLocation': '', 'toLocation': '',
        'rawText': '',
      };

  // ── AMOUNT EXTRACTION ────────────────────────────────────────────────
  //
  // Strategy: collect *all* candidate numbers with a confidence score, then
  // return the highest-scoring one. This replaces the old short-circuit
  // priority loop which failed on UPI screenshots where the amount sits on
  // its own line with no "Total"/₹ prefix (e.g. Paytm "1,700" scratch card).

  static String _extractAmount(String text) {
    final candidates = <_AmountCandidate>[];

    final lines = text.split('\n');
    final lower = text.toLowerCase();

    // Regex that captures any Indian-format number (optional commas + decimals)
    final numRe = RegExp(r'(?<![\w@])(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+\.\d{1,2})(?![\w@])');

    // Phone / ref-no / account filter — reject 10-digit integers starting with
    // 6-9 (mobile), long ints (>6 digits no decimal), and digit-runs >8.
    bool looksLikeNoise(String s) {
      final clean = s.replaceAll(',', '');
      if (clean.length > 8 && !clean.contains('.')) return true;
      if (RegExp(r'^[6-9]\d{9}$').hasMatch(clean)) return true; // mobile
      return false;
    }

    // Per-line scoring — walks each line once and attaches context bonuses.
    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      for (final m in numRe.allMatches(line)) {
        final raw = m.group(1)!;
        if (looksLikeNoise(raw)) continue;
        final val = double.tryParse(raw.replaceAll(',', ''));
        if (val == null || val <= 0 || val > 1000000) continue;

        int score = 0;
        // Currency symbol before or after
        if (RegExp(r'₹\s*$').hasMatch(line.substring(0, m.start)) ||
            RegExp(r'^\s*₹').hasMatch(line.substring(m.end))) score += 60;
        if (RegExp(r'\brs\.?\s*$', caseSensitive: false)
                .hasMatch(line.substring(0, m.start)) ||
            RegExp(r'^\s*rs\b', caseSensitive: false)
                .hasMatch(line.substring(m.end))) score += 55;
        if (RegExp(r'\binr\b', caseSensitive: false).hasMatch(line)) score += 30;

        // Context keywords on same line
        if (RegExp(r'total|net\s*amount|grand\s*total|amount\s*paid',
                caseSensitive: false)
            .hasMatch(line)) score += 50;
        if (RegExp(r'paid|payable|final|bill\s*amount',
                caseSensitive: false)
            .hasMatch(line)) score += 25;
        if (RegExp(r'fare|charge|cost|price', caseSensitive: false)
            .hasMatch(line)) score += 15;

        // Decimal-containing numbers are stronger (1,000.00 beats 1700)
        if (raw.contains('.')) score += 20;
        if (raw.contains(',')) score += 10;

        // UPI screenshot pattern — standalone amount line (only this number
        // plus maybe a currency char). Strong positive signal.
        final stripped = line.trim();
        final standaloneRe =
            RegExp(r'^[₹Rs.\s]*' + RegExp.escape(raw) + r'[\s.]*$', caseSensitive: false);
        if (standaloneRe.hasMatch(stripped)) score += 40;

        // Line directly after "PAYMENT TO" / "Paid to" headers
        if (i > 0) {
          final prev = lines[i - 1].toLowerCase();
          if (RegExp(r'payment\s*to|paid\s*to|amount|you\s*paid',
                  caseSensitive: false)
              .hasMatch(prev)) {
            score += 30;
          }
        }

        // Penalties: UPI IDs, ref nos, txn ids, dates, times
        if (RegExp(r'upi\s*id|ref\.?\s*no|txn|transaction',
                caseSensitive: false)
            .hasMatch(line)) score -= 40;
        if (RegExp(r'\b\d{1,2}[:.]\d{2}\b').hasMatch(line)) score -= 15;
        if (RegExp(r'\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b').hasMatch(line)) {
          score -= 20;
        }

        // Plain small integers without context are usually noise (1 / 2 / 5)
        if (score == 0 && val < 10) continue;

        candidates.add(_AmountCandidate(raw: raw, value: val, score: score));
      }
    }

    if (candidates.isEmpty) {
      // Fallback: word amounts ("Rupees Five Hundred Only")
      final w = _extractWordAmount(lower);
      return w > 0 ? w.toString() : '';
    }

    candidates.sort((a, b) {
      final s = b.score.compareTo(a.score);
      if (s != 0) return s;
      return b.value.compareTo(a.value); // prefer larger on tie
    });
    return candidates.first.raw.replaceAll(',', '');
  }

  static int _extractWordAmount(String text) {
    const nums = {
      'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
      'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
      'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
      'hundred': 100, 'thousand': 1000, 'lakh': 100000, 'lakhs': 100000,
    };
    final match = RegExp(r'rupees?\s+([\sa-z]+?)\s*only', caseSensitive: false)
        .firstMatch(text);
    if (match == null) return 0;
    final words = match.group(1)!.trim().split(RegExp(r'\s+'));
    int total = 0, current = 0;
    for (final w in words) {
      if (!nums.containsKey(w)) continue;
      final v = nums[w]!;
      if (v >= 100) {
        current = current == 0 ? v : current * v;
      } else {
        current += v;
      }
      if (v >= 1000) {
        total += current;
        current = 0;
      }
    }
    total += current;
    return (total > 0 && total <= 1000000) ? total : 0;
  }

  // ── DATE EXTRACTION ──────────────────────────────────────────────────

  static String _extractDate(String text) {
    const monthMap = {
      'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
      'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6,
      'jul': 7, 'july': 7, 'aug': 8, 'august': 8,
      'sep': 9, 'sept': 9, 'september': 9, 'oct': 10, 'october': 10,
      'nov': 11, 'november': 11, 'dec': 12, 'december': 12,
    };
    const ocrCorrections = {
      'sen': 'sep', 'seo': 'sep', 'oet': 'oct', 'oot': 'oct',
      'deo': 'dec', 'dee': 'dec', 'aup': 'aug', 'ang': 'aug',
      'jnn': 'jan', 'jau': 'jan', 'nay': 'may', 'juu': 'jun',
      'jnl': 'jul', 'nop': 'nov', 'nou': 'nov', 'nar': 'mar', 'fen': 'feb',
    };

    int? resolveMonth(String m) {
      final norm = m.toLowerCase().replaceAll('.', '').trim();
      if (monthMap.containsKey(norm)) return monthMap[norm];
      final c = ocrCorrections[norm];
      if (c != null && monthMap.containsKey(c)) return monthMap[c];
      return null;
    }

    bool isValid(int d, int m, int y) =>
        d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2099;

    String? format(int d, int m, int y) => isValid(d, m, y)
        ? '$y-${m.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}'
        : null;

    // ISO datetime: 2025-09-04T18:21:30
    final iso = RegExp(r'(\d{4})-(\d{2})-(\d{2})T').firstMatch(text);
    if (iso != null) {
      final r = format(int.parse(iso.group(3)!), int.parse(iso.group(2)!),
          int.parse(iso.group(1)!));
      if (r != null) return r;
    }

    // YMD numeric: 2025/09/04
    final ymd = RegExp(r'(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})')
        .firstMatch(text);
    if (ymd != null) {
      final r = format(int.parse(ymd.group(3)!), int.parse(ymd.group(2)!),
          int.parse(ymd.group(1)!));
      if (r != null) return r;
    }

    // DMY name with year: "04 September 2025", "11 Aug 23"
    final dmyName =
        RegExp(r'(\d{1,2})\s+([a-z]+\.?)\s+(\d{2,4})', caseSensitive: false)
            .firstMatch(text);
    if (dmyName != null) {
      final m = resolveMonth(dmyName.group(2)!);
      if (m != null) {
        int y = int.parse(dmyName.group(3)!);
        if (y < 100) y += 2000;
        final r = format(int.parse(dmyName.group(1)!), m, y);
        if (r != null) return r;
      }
    }

    // MDY name: "September 04, 2025"
    final mdyName =
        RegExp(r'([a-z]+\.?)\s+(\d{1,2})[,\s]+(\d{2,4})', caseSensitive: false)
            .firstMatch(text);
    if (mdyName != null) {
      final m = resolveMonth(mdyName.group(1)!);
      if (m != null) {
        int y = int.parse(mdyName.group(3)!);
        if (y < 100) y += 2000;
        final r = format(int.parse(mdyName.group(2)!), m, y);
        if (r != null) return r;
      }
    }

    // DMY numeric with 4-digit year: 04/09/2025
    final dmyNumeric =
        RegExp(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})').firstMatch(text);
    if (dmyNumeric != null) {
      final r = format(int.parse(dmyNumeric.group(1)!),
          int.parse(dmyNumeric.group(2)!), int.parse(dmyNumeric.group(3)!));
      if (r != null) return r;
    }

    // DMY numeric with 2-digit year: 04/09/25
    final dmy2 = RegExp(r'(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})(?!\d)')
        .firstMatch(text);
    if (dmy2 != null) {
      final y = 2000 + int.parse(dmy2.group(3)!);
      final r =
          format(int.parse(dmy2.group(1)!), int.parse(dmy2.group(2)!), y);
      if (r != null) return r;
    }

    // YMD concat: 20250904
    final ymdConcat = RegExp(r'(\d{4})(\d{2})(\d{2})(?!T|\d)').firstMatch(text);
    if (ymdConcat != null) {
      final r = format(int.parse(ymdConcat.group(3)!),
          int.parse(ymdConcat.group(2)!), int.parse(ymdConcat.group(1)!));
      if (r != null) return r;
    }

    // DM short (UPI style — "31 Mar, 06:24 PM"). No year → assume current.
    // Only fires if earlier patterns missed, so we can be liberal.
    final dmShort =
        RegExp(r'\b(\d{1,2})\s+([a-z]{3,9})\.?(?:[,\s]|$)', caseSensitive: false)
            .firstMatch(text);
    if (dmShort != null) {
      final m = resolveMonth(dmShort.group(2)!);
      if (m != null) {
        final d = int.parse(dmShort.group(1)!);
        final y = DateTime.now().year;
        final r = format(d, m, y);
        if (r != null) return r;
      }
    }

    return '';
  }

  // ── VENDOR EXTRACTION ────────────────────────────────────────────────

  static String _extractVendor(String text) {
    final lines = text.split('\n');

    // UPI fast-path: "PAYMENT TO" / "Paid to" / "TRANSFERRED TO" →
    // next non-empty line that isn't a UPI ID / amount / date is the vendor.
    final upiHeaderRe = RegExp(
        r'^(?:payment\s*to|paid\s*to|transferred\s*to|pay\s*to|sent\s*to|to)\s*$',
        caseSensitive: false);
    for (var i = 0; i < lines.length - 1; i++) {
      if (!upiHeaderRe.hasMatch(lines[i].trim())) continue;
      for (var j = i + 1; j < lines.length && j < i + 4; j++) {
        final c = _cleanVendorCandidate(lines[j]);
        if (c != null) return c;
      }
    }

    // Scoring fallback (original logic, tightened for UPI noise).
    final skip = RegExp(
      r'^(amount|paid|payment|paytm|phonepe|gpay|google\s*pay|upi|bank|ref|reference|date|time|bill|invoice|receipt|thank|thanks|total|subtotal|tax|gst|cgst|sgst|igst|cashier|customer|status|transaction|successful|failed|pending|from|to)\b',
      caseSensitive: false,
    );
    final business = RegExp(
      r'(limited|ltd|pvt|private|corp|corporation|company|inc|llp|station|store|stores|mart|shop|restaurant|hotel|cafe|petrol|pump|mall|center|centre)',
      caseSensitive: false,
    );

    final candidates = <Map<String, dynamic>>[];
    final maxLines = lines.length < 20 ? lines.length : 20;

    for (var i = 0; i < maxLines; i++) {
      final line = lines[i].trim();
      if (line.isEmpty || line.length < 3 || line.length > 60) continue;
      if (skip.hasMatch(line)) continue;
      if (line.contains('@')) continue; // UPI ID
      if (RegExp(r'^[\d\s\-+().,₹]+$').hasMatch(line)) continue;
      if (RegExp(r'^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$').hasMatch(line)) continue;
      if (RegExp(r'^\d+$').hasMatch(line)) continue;
      if (RegExp(r'^[^a-zA-Z]+$').hasMatch(line)) continue;
      if (RegExp(r'transaction|order\s*id|ref|upi\s*id',
              caseSensitive: false)
          .hasMatch(line)) continue;

      int confidence = 0;
      if (business.hasMatch(line)) confidence += 50;
      if (RegExp(r'^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$').hasMatch(line)) {
        confidence += 20;
      }
      if (line == line.toUpperCase() && RegExp(r'[A-Z]').hasMatch(line)) {
        confidence += 15;
      }
      if (line.length >= 5 && line.length <= 40) confidence += 10;
      final specials = RegExp(r'[^a-zA-Z0-9\s]').allMatches(line).length;
      if (specials > 2) confidence -= 10;
      confidence -= (i * 2);

      if (confidence > 0) {
        candidates.add({'name': line, 'confidence': confidence});
      }
    }

    if (candidates.isEmpty) return '';
    candidates
        .sort((a, b) => (b['confidence'] as int).compareTo(a['confidence'] as int));
    final best = candidates[0]['name'] as String;
    return best.length > 50 ? best.substring(0, 50).trim() : best;
  }

  static String? _cleanVendorCandidate(String raw) {
    final s = raw.trim();
    if (s.isEmpty || s.length < 3 || s.length > 60) return null;
    if (s.contains('@')) return null;
    if (RegExp(r'^[\d\s\-+().,₹]+$').hasMatch(s)) return null;
    if (RegExp(r'^(successful|failed|pending|completed|status)$',
            caseSensitive: false)
        .hasMatch(s)) return null;
    return s.length > 50 ? s.substring(0, 50).trim() : s;
  }

  // ── MODE + FROM/TO EXTRACTION (travel receipts) ──────────────────────

  static const _fromKeywords = [
    'from', 'pickup', 'pick up', 'pick-up', 'source', 'starting', 'origin'
  ];
  static const _toKeywords = [
    'to', 'drop', 'drop off', 'drop-off', 'destination', 'end'
  ];

  static String _extractLocation(String text, List<String> keywords) {
    final lines = text.split('\n');
    final kwPattern =
        keywords.map((k) => RegExp.escape(k)).join('|');

    // Inline form: "From: Koramangala" / "Pickup - HSR Layout"
    final inlineRe = RegExp(
        r'\b(?:' + kwPattern + r')\b\s*[:\-–]\s*([A-Za-z0-9][A-Za-z0-9\s,\-]{2,60})',
        caseSensitive: false);
    final inlineMatch = inlineRe.firstMatch(text);
    if (inlineMatch != null) {
      final loc = _cleanLocation(inlineMatch.group(1)!);
      if (loc != null) return loc;
    }

    // Header-above-value form:
    //   Pickup
    //   HSR Layout, Bangalore
    final headerRe = RegExp(r'^(?:' + kwPattern + r')\s*[:]?\s*$',
        caseSensitive: false);
    for (var i = 0; i < lines.length - 1; i++) {
      if (!headerRe.hasMatch(lines[i].trim())) continue;
      for (var j = i + 1; j < lines.length && j < i + 3; j++) {
        final loc = _cleanLocation(lines[j]);
        if (loc != null) return loc;
      }
    }

    return '';
  }

  static String? _cleanLocation(String raw) {
    var s = raw.trim();
    if (s.isEmpty || s.length < 3 || s.length > 80) return null;
    // Reject lines that are purely numeric, a date, or a time
    if (RegExp(r'^[\d\s\-+().,:/]+$').hasMatch(s)) return null;
    if (RegExp(r'^\d{1,2}[:.]\d{2}').hasMatch(s)) return null;
    // Trim trailing separator fluff
    s = s.replaceAll(RegExp(r'[,\-\s]+$'), '').trim();
    if (s.length < 3) return null;
    return s.length > 60 ? s.substring(0, 60).trim() : s;
  }

  static String _detectMode(String text, String subcategory) {
    // When the subcategory detector already picked a ride vendor, reuse it.
    const rideSubs = {
      'Rapido', 'Uber', 'Ola', 'Cab', 'Auto', 'Metro', 'Bus',
      'Train', 'Flight', 'Personal Bike', 'Personal Car', 'Portar',
    };
    if (rideSubs.contains(subcategory)) return subcategory;

    // Fallback: keyword scan on the raw text.
    final lower = text.toLowerCase();
    const keywords = {
      'Rapido': ['rapido'],
      'Uber': ['uber'],
      'Ola': ['ola cabs', 'ola '],
      'Auto': ['auto rickshaw', 'auto '],
      'Cab': ['cab', 'taxi'],
      'Metro': ['metro'],
      'Bus': ['ksrtc', 'redbus', 'bus '],
      'Train': ['irctc', 'railway'],
      'Flight': ['indigo', 'spicejet', 'vistara', 'air india', 'flight'],
    };
    for (final entry in keywords.entries) {
      for (final k in entry.value) {
        if (lower.contains(k)) return entry.key;
      }
    }
    return '';
  }

  // ── CATEGORY DETECTION ───────────────────────────────────────────────

  static String detectCategory(String text) {
    final lower = text.toLowerCase();
    final scores = <String, int>{
      'Travel': 0,
      'Food Expense': 0,
      'Accommodation': 0,
      'Office Supplies': 0,
      'Communication': 0,
      'Project Consumables': 0,
      'Postage & Courier Charges': 0,
      'Stationery': 0,
    };

    const keywords = {
      'Travel': [
        'uber', 'ola', 'taxi', 'cab', 'transport', 'bus', 'train', 'metro',
        'railway', 'auto', 'rickshaw', 'rapido', 'toll', 'fuel', 'petrol',
        'diesel', 'gas', 'hp', 'iocl', 'bpcl', 'shell', 'portar',
        'pickup', 'drop-off', 'ride'
      ],
      'Food Expense': [
        'restaurant', 'food', 'cafe', 'coffee', 'meal', 'dinner', 'lunch',
        'breakfast', 'zomato', 'swiggy', 'dominos', 'mcdonald', 'kfc',
        'pizza', 'burger', 'tiffin', 'snack', 'chai', 'tea', 'juice'
      ],
      'Accommodation': [
        'hotel', 'accommodation', 'lodge', 'resort', 'guest house', 'inn',
        'motel', 'hostel', 'airbnb', 'oyo'
      ],
      'Office Supplies': ['office', 'supplies', 'printer', 'toner', 'cartridge'],
      'Communication': [
        'mobile', 'phone', 'internet', 'broadband', 'recharge', 'data',
        'airtel', 'jio', 'vodafone', 'vi'
      ],
      'Project Consumables': [
        'wire', 'wiring', 'cable', 'electrical', 'plumbing', 'pipe', 'tap',
        'hardware', 'tools', 'consumable'
      ],
      'Postage & Courier Charges': [
        'courier', 'postage', 'dtdc', 'bluedart', 'fedex', 'dhl', 'india post',
        'speed post'
      ],
      'Stationery': [
        'stationery', 'pen', 'paper', 'notebook', 'file', 'folder', 'xerox',
        'photocopy'
      ],
    };

    keywords.forEach((cat, kws) {
      for (final kw in kws) {
        if (lower.contains(kw)) scores[cat] = (scores[cat] ?? 0) + 10;
      }
    });

    String best = 'Other';
    int maxScore = 0;
    scores.forEach((cat, score) {
      if (score > maxScore) {
        maxScore = score;
        best = cat;
      }
    });

    return maxScore > 0 ? best : 'Other';
  }

  // ── SUBCATEGORY DETECTION ────────────────────────────────────────────

  static String? detectSubcategory(String text, String mainCategory) {
    final lower = text.toLowerCase();

    const subcategoryMap = {
      'Travel': {
        'Rapido': ['rapido'],
        'Uber': ['uber'],
        'Ola': ['ola'],
        'Cab': ['taxi', 'cab', 'meru'],
        'Auto': ['auto', 'rickshaw', 'auto rickshaw', 'three wheeler'],
        'Metro': ['metro', 'dmrc', 'bmrc', 'cmrl'],
        'Bus': ['bus', 'ksrtc', 'apsrtc', 'tsrtc', 'redbus', 'volvo'],
        'Train': ['train', 'railway', 'irctc', 'indian railways', 'rail'],
        'Flight': ['flight', 'airline', 'indigo', 'spicejet', 'vistara', 'air india'],
        'Personal Bike': ['bike', 'motorbike', 'two wheeler', 'scooter', 'activa'],
        'Personal Car': ['personal car', 'own car'],
        'Portar': ['portar', 'porter', 'coolie'],
      },
    };

    final subs = subcategoryMap[mainCategory];
    if (subs == null) return null;

    String? best;
    int maxScore = 0;
    subs.forEach((sub, kws) {
      int score = 0;
      for (final kw in kws) {
        if (lower.contains(kw)) {
          score += 10;
          if (kw.length > 5) score += 5;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        best = sub;
      }
    });

    return maxScore > 0 ? best : null;
  }
}

class _AmountCandidate {
  final String raw;
  final double value;
  final int score;
  const _AmountCandidate({
    required this.raw,
    required this.value,
    required this.score,
  });
}

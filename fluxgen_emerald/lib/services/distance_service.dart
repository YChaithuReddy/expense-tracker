import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// Distance calculation service using OpenRouteService.
///
/// Free tier: 2,000 requests/day, real driving distance (not straight-line).
/// Sign up at https://openrouteservice.org/dev/#/signup to get an API key.
class DistanceService {
  // Paste your OpenRouteService API key here
  static const String _apiKey = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjUyN2I3MTU4NGNiMDRhZmZiMmU4NzI2YzM4NDdhYzE2IiwiaCI6Im11cm11cjY0In0=';

  /// Calculate driving distance in kilometers between two locations.
  /// Returns null if geocoding or routing fails.
  static Future<double?> calculateDistance(String from, String to) async {
    if (from.trim().isEmpty || to.trim().isEmpty) return null;

    try {
      // Step 1: Geocode "from" address → coordinates
      final fromCoords = await _geocode(from);
      if (fromCoords == null) return null;

      // Step 2: Geocode "to" address → coordinates
      final toCoords = await _geocode(to);
      if (toCoords == null) return null;

      // Step 3: Get driving distance
      final url = Uri.parse(
        'https://api.openrouteservice.org/v2/directions/driving-car'
        '?api_key=$_apiKey'
        '&start=${fromCoords['lng']},${fromCoords['lat']}'
        '&end=${toCoords['lng']},${toCoords['lat']}',
      );

      final response = await http.get(url);
      if (response.statusCode != 200) {
        debugPrint('ORS directions failed: ${response.statusCode}');
        return null;
      }

      final data = jsonDecode(response.body);
      final meters = data['features']?[0]?['properties']?['summary']?['distance'] as num?;
      if (meters == null) return null;

      // Convert meters to km with 1 decimal precision
      return double.parse((meters / 1000).toStringAsFixed(1));
    } catch (e) {
      debugPrint('DistanceService error: $e');
      return null;
    }
  }

  /// Geocode a plain text address → {lat, lng}
  static Future<Map<String, double>?> _geocode(String address) async {
    try {
      final url = Uri.parse(
        'https://api.openrouteservice.org/geocode/search'
        '?api_key=$_apiKey'
        '&text=${Uri.encodeComponent(address)}'
        '&size=1',
      );
      final response = await http.get(url);
      if (response.statusCode != 200) return null;

      final data = jsonDecode(response.body);
      final features = data['features'] as List?;
      if (features == null || features.isEmpty) return null;

      final coords = features[0]['geometry']['coordinates'] as List;
      return {
        'lng': (coords[0] as num).toDouble(),
        'lat': (coords[1] as num).toDouble(),
      };
    } catch (e) {
      debugPrint('Geocode error for "$address": $e');
      return null;
    }
  }
}

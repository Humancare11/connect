import 'package:flutter/material.dart';

class AppConstants {
  static const appName = 'HumanCare Connect';
  static final apiBaseUrl = const String.fromEnvironment('API_BASE_URL', defaultValue: 'https://humancareconnect.co');
  static final stripePublishableKey = const String.fromEnvironment('STRIPE_PUBLISHABLE_KEY', defaultValue: 'pk_test_replace_with_key');
}

class AppColors {
  static const primary = Color(0xFF2563EB);
  static const secondary = Color(0xFF0EA5E9);
  static const surface = Color(0xFFFFFFFF);
  static const background = Color(0xFFF8FAFC);
  static const error = Color(0xFFDC2626);
  static const success = Color(0xFF16A34A);
}

class StatusLabels {
  static const pending = 'pending';
  static const confirmed = 'confirmed';
  static const completed = 'completed';
  static const cancelled = 'cancelled';
  static const assigned = 'assigned';
  static const answered = 'answered';
  static const resolved = 'resolved';
}

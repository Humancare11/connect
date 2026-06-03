import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import '../utils/constants.dart';

class StripeService {
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    final key = AppConstants.stripePublishableKey;
    if (key.isEmpty || key.contains('replace_with_key')) {
      debugPrint('Stripe publishable key is not configured. Payment features are disabled.');
      return;
    }
    Stripe.publishableKey = key;
    await Stripe.instance.applySettings();
    _initialized = true;
  }

  static bool get isAvailable => _initialized;

  static Future<void> presentPaymentSheet({
    required String clientSecret,
    required String merchantName,
  }) async {
    if (!_initialized) {
      throw Exception('Stripe is not initialized.');
    }
    await Stripe.instance.initPaymentSheet(
      paymentSheetParameters: SetupPaymentSheetParameters(
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: merchantName,
        style: ThemeMode.light,
      ),
    );
    await Stripe.instance.presentPaymentSheet();
  }
}

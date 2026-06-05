import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/models.dart';
import '../utils/constants.dart';
import '../utils/storage.dart';

class AuthProvider with ChangeNotifier {
  UserModel? user;
  String? accessToken;
  String? refreshToken;
  bool isLoading = true;
  String? errorMessage;
  bool warningActive = false;
  int warningSecondsRemaining = 0;

  Timer? _warningTimer;
  Timer? _logoutTimer;
  Timer? _countdownTimer;
  final _client = http.Client();

  bool get isAuthenticated => user != null && accessToken != null;

  AuthProvider() {
    initialize();
  }

  Future<void> initialize() async {
    accessToken = await SecureStorage.getAccessToken();
    refreshToken = await SecureStorage.getRefreshToken();
    if (accessToken != null) {
      final success = await _fetchCurrentUser();
      if (!success && refreshToken != null) {
        final refreshed = await refreshSession();
        if (refreshed) resetActivityTimer();
      } else if (success) {
        resetActivityTimer();
      }
    } else if (refreshToken != null) {
      final refreshed = await refreshSession();
      if (refreshed) resetActivityTimer();
    }
    isLoading = false;
    notifyListeners();
  }

  Uri _uri(String path) => Uri.parse('${AppConstants.apiBaseUrl}$path');

  Map<String, String> _headers({bool withAuth = true}) {
    final headers = {'Content-Type': 'application/json'};
    if (withAuth && accessToken != null) {
      headers['Authorization'] = 'Bearer $accessToken';
    }
    return headers;
  }

  Future<bool> _fetchCurrentUser() async {
    try {
      final res = await _client.get(_uri('/api/auth/me'), headers: _headers());
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
        return true;
      }
    } catch (_) {}
    user = null;
    return false;
  }

  Future<void> _saveTokens(String access, String refresh) async {
    accessToken = access;
    refreshToken = refresh;
    await SecureStorage.saveTokens(access, refresh);
  }

  Future<void> _clearTimers() async {
    _warningTimer?.cancel();
    _logoutTimer?.cancel();
    _countdownTimer?.cancel();
    warningActive = false;
    warningSecondsRemaining = 0;
  }

  Future<void> _clearSession() async {
    await _clearTimers();
    user = null;
    accessToken = null;
    refreshToken = null;
    await SecureStorage.deleteTokens();
    notifyListeners();
  }

  int get _sessionTimeoutMs {
    final role = user?.role?.toLowerCase() ?? 'user';
    if (role == 'admin') return 30 * 60 * 1000;
    if (role == 'superadmin') return 60 * 60 * 1000;
    if (role == 'doctor') return 60 * 60 * 1000;
    return 45 * 60 * 1000;
  }

  void _startWarningCountdown() {
    warningActive = true;
    warningSecondsRemaining = 5 * 60;
    notifyListeners();

    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      warningSecondsRemaining = math.max(0, warningSecondsRemaining - 1);
      notifyListeners();
      if (warningSecondsRemaining <= 0) {
        timer.cancel();
      }
    });
  }

  void _scheduleTimers() {
    _warningTimer?.cancel();
    _logoutTimer?.cancel();
    _countdownTimer?.cancel();
    warningActive = false;
    warningSecondsRemaining = 0;

    final timeoutMs = _sessionTimeoutMs;
    final warningDelay = math.max(0, timeoutMs - 5 * 60 * 1000);

    _warningTimer = Timer(Duration(milliseconds: warningDelay), _startWarningCountdown);
    _logoutTimer = Timer(Duration(milliseconds: timeoutMs), () async {
      await logout();
    });
  }

  void resetActivityTimer() {
    if (!isAuthenticated) return;
    _scheduleTimers();
  }

  Future<bool> refreshSession() async {
    if (refreshToken == null) return false;
    try {
      final res = await _client.post(
        _uri('/api/auth/refresh'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $refreshToken',
        },
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final access = data['accessToken'] as String?;
        final refresh = data['refreshToken'] as String?;
        if (access != null && refresh != null) {
          await _saveTokens(access, refresh);
          final fetched = await _fetchCurrentUser();
          if (fetched) resetActivityTimer();
          return fetched;
        }
      }
    } catch (_) {}
    await _clearSession();
    return false;
  }

  Future<Map<String, dynamic>> _sendRequest(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool allowRetry = true,
  }) async {
    if (path != '/api/auth/logout') {
      resetActivityTimer();
    }
    final uri = _uri(path);
    final headers = _headers();
    http.Response res;

    if (method == 'GET') {
      res = await _client.get(uri, headers: headers);
    } else if (method == 'POST') {
      res = await _client.post(uri, headers: headers, body: jsonEncode(body ?? {}));
    } else if (method == 'PUT') {
      res = await _client.put(uri, headers: headers, body: jsonEncode(body ?? {}));
    } else {
      res = await _client.delete(uri, headers: headers);
    }

    if (res.statusCode == 401 && allowRetry && refreshToken != null) {
      final refreshed = await refreshSession();
      if (refreshed) {
        return _sendRequest(method, path, body: body, allowRetry: false);
      }
    }

    final decoded = res.body.isNotEmpty ? jsonDecode(res.body) : {};
    if (res.statusCode >= 400) {
      if (decoded is Map<String, dynamic>) {
        throw decoded['msg'] ?? decoded['error'] ?? 'Request failed';
      }
      throw 'Request failed';
    }
    return decoded;
  }

  Future<void> login(String email, String password) async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();

    try {
      final body = {'email': email.trim(), 'password': password};
      final data = await _sendRequest('POST', '/api/auth/login', body: body, allowRetry: false);
      final userData = data['user'] as Map<String, dynamic>;
      final access = data['accessToken'] as String?;
      final refresh = data['refreshToken'] as String?;
      if (access == null || refresh == null) {
        throw 'Authentication tokens were missing from the server response.';
      }
      await _saveTokens(access, refresh);
      user = UserModel.fromJson(userData);
      resetActivityTimer();
    } catch (err) {
      user = null;
      errorMessage = err.toString();
      rethrow;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await _sendRequest('POST', '/api/auth/logout', allowRetry: false);
    } catch (_) {}
    await _clearSession();
  }

  Future<void> register(Map<String, dynamic> details) async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();
    try {
      final data = await _sendRequest('POST', '/api/auth/register', body: details, allowRetry: false);
      final access = data['accessToken'] as String?;
      final refresh = data['refreshToken'] as String?;
      if (access == null || refresh == null) {
        throw 'Registration succeeded but server did not return auth tokens.';
      }
      await _saveTokens(access, refresh);
      user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    } catch (err) {
      errorMessage = err.toString();
      rethrow;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> sendRegisterOtp(String email) async {
    await _sendRequest('POST', '/api/auth/send-register-otp', body: {'email': email.trim()});
  }

  Future<void> sendForgotOtp(String email) async {
    await _sendRequest('POST', '/api/auth/send-forgot-otp', body: {'email': email.trim()});
  }

  Future<String> verifyForgotOtp(String email, String otp) async {
    final data = await _sendRequest('POST', '/api/auth/verify-forgot-otp', body: {'email': email.trim(), 'otp': otp.trim()});
    return data['resetToken'] as String? ?? '';
  }

  Future<void> resetPassword(String email, String resetToken, String newPassword) async {
    await _sendRequest('POST', '/api/auth/reset-password', body: {'resetToken': resetToken, 'newPassword': newPassword});
  }

  Future<void> updateProfile(Map<String, dynamic> values) async {
    final data = await _sendRequest('PUT', '/api/auth/update-profile', body: values);
    user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> changePassword(String oldPassword, String newPassword) async {
    await _sendRequest('PUT', '/api/auth/change-password', body: {'oldPassword': oldPassword, 'newPassword': newPassword});
  }

  Future<List<Map<String, dynamic>>> fetchList(String path) async {
    final result = await _sendRequest('GET', path);
    return (result as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> fetchOne(String path) async {
    return await _sendRequest('GET', path);
  }

  Future<T> post<T>(String path, {Map<String, dynamic>? body}) async {
    final result = await _sendRequest('POST', path, body: body);
    return result as T;
  }

  Future<T> put<T>(String path, {Map<String, dynamic>? body}) async {
    final result = await _sendRequest('PUT', path, body: body);
    return result as T;
  }
}

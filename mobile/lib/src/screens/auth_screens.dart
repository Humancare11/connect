import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../utils/constants.dart';
import '../widgets/common_widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  Future<void> _login() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.login(_emailController.text, _passwordController.text);
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Login')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 20),
                const Text('Welcome back', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Text('Sign in to access your health dashboard.', style: TextStyle(fontSize: 16, color: Colors.black54)),
                const SizedBox(height: 24),
                if (_error != null) AppErrorBanner(_error!),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password'),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _isSubmitting ? null : _login,
                  child: _isSubmitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Login'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ForgotPasswordScreen())),
                  child: const Text('Forgot Password?'),
                ),
                const SizedBox(height: 24),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
                  child: const Text('Create an account'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _emailController = TextEditingController();
  final _nameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _mobileController = TextEditingController();
  final _dobController = TextEditingController();
  final _otpController = TextEditingController();
  String _gender = 'male';
  String _country = 'India';
  bool _privacyConsent = false;
  bool _hipaaConsent = false;
  bool _otpSent = false;
  bool _isSubmitting = false;
  String? _error;
  String? _success;

  Future<void> _sendOtp() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.sendRegisterOtp(_emailController.text);
      setState(() {
        _otpSent = true;
        _success = 'OTP sent to your email. Check your inbox.';
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  Future<void> _register() async {
    if (!_privacyConsent || !_hipaaConsent) {
      setState(() {
        _error = 'You must accept the privacy and HIPAA consent to register.';
      });
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.register({
        'name': _nameController.text,
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
        'mobile': _mobileController.text,
        'dob': _dobController.text,
        'gender': _gender,
        'country': _country,
        'otp': _otpController.text.trim(),
        'privacyConsent': true,
        'hipaaConsent': true,
      });
      Navigator.of(context).pop();
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Register')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 20),
                const Text('Create your account', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Text('Complete registration with OTP verification.', style: TextStyle(fontSize: 16, color: Colors.black54)),
                const SizedBox(height: 24),
                if (_error != null) AppErrorBanner(_error!),
                if (_success != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
                    child: Text(_success!, style: TextStyle(color: AppColors.success)),
                  ),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                if (_otpSent) ...[
                  TextField(
                    controller: _otpController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'OTP'),
                  ),
                  const SizedBox(height: 12),
                ],
                TextField(
                  controller: _nameController,
                  decoration: const InputDecoration(labelText: 'Full Name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _mobileController,
                  decoration: const InputDecoration(labelText: 'Mobile Number'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _dobController,
                  decoration: const InputDecoration(labelText: 'Date of Birth (YYYY-MM-DD)'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _gender,
                  items: const [
                    DropdownMenuItem(value: 'male', child: Text('Male')),
                    DropdownMenuItem(value: 'female', child: Text('Female')),
                    DropdownMenuItem(value: 'other', child: Text('Other')),
                  ],
                  onChanged: (value) => setState(() {
                    _gender = value ?? 'male';
                  }),
                  decoration: const InputDecoration(labelText: 'Gender'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _country,
                  items: const [
                    DropdownMenuItem(value: 'India', child: Text('India')),
                    DropdownMenuItem(value: 'United States', child: Text('United States')),
                    DropdownMenuItem(value: 'Other', child: Text('Other')),
                  ],
                  onChanged: (value) => setState(() {
                    _country = value ?? 'India';
                  }),
                  decoration: const InputDecoration(labelText: 'Country'),
                ),
                const SizedBox(height: 16),
                CheckboxListTile(
                  value: _privacyConsent,
                  onChanged: (value) => setState(() => _privacyConsent = value ?? false),
                  title: const Text('I agree to the privacy policy'),
                ),
                CheckboxListTile(
                  value: _hipaaConsent,
                  onChanged: (value) => setState(() => _hipaaConsent = value ?? false),
                  title: const Text('I agree to HIPAA consent'),
                ),
                const SizedBox(height: 12),
                if (!_otpSent)
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : _sendOtp,
                    child: _isSubmitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Send OTP'),
                  )
                else
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : _register,
                    child: _isSubmitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Complete Registration'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _otpSent = false;
  bool _isSubmitting = false;
  String? _error;
  String? _resetToken;
  String? _success;

  Future<void> _sendOtp() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.sendForgotOtp(_emailController.text);
      setState(() {
        _otpSent = true;
        _success = 'OTP sent. Check your email.';
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final resetToken = await auth.verifyForgotOtp(_emailController.text, _otpController.text);
      setState(() {
        _resetToken = resetToken;
        _success = 'OTP verified. Please enter your new password.';
      });
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  Future<void> _resetPassword() async {
    if (_resetToken == null) {
      setState(() {
        _error = 'Please verify your OTP first.';
      });
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = null;
    });
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.resetPassword(_emailController.text, _resetToken!, _passwordController.text);
      setState(() {
        _success = 'Password updated. Please login with your new password.';
      });
      Navigator.of(context).pop();
    } catch (err) {
      setState(() {
        _error = err.toString();
      });
    } finally {
      setState(() {
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset Password')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 20),
                const Text('Forgot password', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                const Text('Use OTP verification to reset your password.', style: TextStyle(fontSize: 16, color: Colors.black54)),
                const SizedBox(height: 24),
                if (_error != null) AppErrorBanner(_error!),
                if (_success != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(10)),
                    child: Text(_success!, style: TextStyle(color: AppColors.success)),
                  ),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                if (_otpSent) ...[
                  TextField(
                    controller: _otpController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'OTP'),
                  ),
                  const SizedBox(height: 12),
                ],
                if (_resetToken != null) ...[
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'New Password'),
                  ),
                  const SizedBox(height: 12),
                ],
                ElevatedButton(
                  onPressed: _isSubmitting
                      ? null
                      : _resetToken != null
                          ? _resetPassword
                          : _otpSent
                              ? _verifyOtp
                              : _sendOtp,
                  child: _isSubmitting
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(_resetToken != null ? 'Reset Password' : (_otpSent ? 'Verify OTP' : 'Send OTP')),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

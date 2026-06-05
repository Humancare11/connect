import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/auth_screens.dart';
import 'screens/home_screens.dart';
import 'utils/constants.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) => SessionActivityListener(
          child: MaterialApp(
            title: AppConstants.appName,
            debugShowCheckedModeBanner: false,
            theme: ThemeData(
              colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary),
              useMaterial3: true,
              scaffoldBackgroundColor: AppColors.background,
              appBarTheme: const AppBarTheme(centerTitle: true),
            ),
            builder: (context, child) {
              return Stack(
                children: [
                  child ?? const SizedBox.shrink(),
                  if (auth.warningActive)
                    Positioned.fill(
                      child: Container(
                        color: Colors.black54,
                        alignment: Alignment.center,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Material(
                            borderRadius: BorderRadius.circular(16),
                            color: Colors.white,
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  const Text('Session expiring soon', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 12),
                                  Text(
                                    'You will be logged out in ${auth.warningSecondsRemaining ~/ 60} minute(s) due to inactivity.',
                                    style: const TextStyle(fontSize: 16),
                                  ),
                                  const SizedBox(height: 20),
                                  ElevatedButton(
                                    onPressed: auth.resetActivityTimer,
                                    child: const Text('Stay signed in'),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              );
            },
            home: const RootNavigator(),
          ),
        ),
      ),
    );
  }
}

class SessionActivityListener extends StatelessWidget {
  final Widget child;

  const SessionActivityListener({required this.child, super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => auth.resetActivityTimer(),
      child: child,
    );
  }
}

class RootNavigator extends StatefulWidget {
  const RootNavigator({super.key});

  @override
  State<RootNavigator> createState() => _RootNavigatorState();
}

class _RootNavigatorState extends State<RootNavigator> {
  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        if (auth.isLoading) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        if (!auth.isAuthenticated) {
          return const LoginScreen();
        }
        return const HomeShell();
      },
    );
  }
}

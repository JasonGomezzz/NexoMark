import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/preferences.dart';
import 'core/providers.dart';
import 'core/session/splash_gate.dart';
import 'core/theme/app_theme.dart';
import 'data/models.dart';
import 'features/account/account_screen.dart';
import 'features/account/change_email_screen.dart';
import 'features/account/change_password_screen.dart';
import 'features/account/credits_screen.dart';
import 'features/account/networks_screen.dart';
import 'features/account/profile_photo_screen.dart';
import 'features/admin/admin_notice_screen.dart';
import 'features/auth/forgot_password_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/splash_screen.dart';
import 'features/client/client_home_screen.dart';
import 'features/client/review_screen.dart';
import 'features/marketero/home_screen.dart';
import 'features/marketero/lab_screen.dart';
import 'features/marketero/project_detail_screen.dart';
import 'features/marketero/projects_screen.dart';
import 'features/shell/home_shell.dart';
import 'features/stats/stats_screen.dart';

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'raiz');

GoRouter _buildRouter(WidgetRef ref) {
  final session = ref.read(sessionProvider.notifier);
  final splash = ref.read(splashGateProvider);

  /// Pantallas de cuenta compartidas por ambos roles; se abren sobre las pestañas.
  List<RouteBase> cuenta() => [
        GoRoute(path: 'foto', parentNavigatorKey: _rootKey, builder: (_, _) => const ProfilePhotoScreen()),
        GoRoute(path: 'correo', parentNavigatorKey: _rootKey, builder: (_, _) => const ChangeEmailScreen()),
        GoRoute(path: 'contrasena', parentNavigatorKey: _rootKey, builder: (_, _) => const ChangePasswordScreen()),
        GoRoute(path: 'creditos', parentNavigatorKey: _rootKey, builder: (_, _) => const CreditsScreen()),
        GoRoute(path: 'redes', parentNavigatorKey: _rootKey, builder: (_, _) => const NetworksScreen()),
      ];

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/inicio',
    refreshListenable: Listenable.merge([session.routerRefresh, splash]),
    redirect: (context, state) {
      final s = ref.read(sessionProvider);
      final loc = state.matchedLocation;
      final publica = loc == '/login' || loc == '/olvide';
      // Cargando, o la N todavía encajando: la pantalla de carga se queda hasta que termine.
      if (s is SessionLoading || !splash.released) return loc == '/cargando' ? null : '/cargando';
      if (s is SignedOut) return publica ? null : '/login';
      final user = (s as SignedIn).user;
      final raiz = switch (user.rol) {
        Rol.marketero => '/m',
        Rol.cliente => '/c',
        Rol.superadmin => '/admin',
      };
      if (publica || loc == '/cargando' || loc == '/inicio') return '$raiz/inicio';
      if (!loc.startsWith(raiz)) return '$raiz/inicio';
      return null;
    },
    routes: [
      GoRoute(path: '/cargando', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/inicio', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/olvide', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(path: '/admin/inicio', builder: (_, _) => const AdminNoticeScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => HomeShell(shell: shell, rol: Rol.marketero),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/m/inicio', builder: (_, _) => const MarketeroHomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/m/laboratorio', builder: (_, _) => const LabScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/m/proyectos',
              builder: (_, _) => const ProjectsScreen(),
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, state) => ProjectDetailScreen(
                    id: int.parse(state.pathParameters['id']!),
                    inicial: state.extra is Campaign ? state.extra as Campaign : null,
                  ),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: '/m/estadisticas', builder: (_, _) => const StatsScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/m/cuenta', builder: (_, _) => const AccountScreen(), routes: cuenta()),
          ]),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => HomeShell(shell: shell, rol: Rol.cliente),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/c/inicio',
              builder: (_, _) => const ClientHomeScreen(),
              routes: [
                GoRoute(
                  path: 'revision/:id',
                  builder: (_, state) => ReviewScreen(id: int.parse(state.pathParameters['id']!)),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: '/c/estadisticas', builder: (_, _) => const StatsScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/c/cuenta', builder: (_, _) => const AccountScreen(), routes: cuenta()),
          ]),
        ],
      ),
    ],
  );
}

class NexoMarkApp extends ConsumerStatefulWidget {
  const NexoMarkApp({super.key});

  @override
  ConsumerState<NexoMarkApp> createState() => _NexoMarkAppState();
}

class _NexoMarkAppState extends ConsumerState<NexoMarkApp> {
  late final GoRouter _router = _buildRouter(ref);

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeModeProvider);
    return MaterialApp.router(
      title: 'NexoMark IA',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: themeMode,
      themeAnimationDuration: const Duration(milliseconds: 240),
      locale: const Locale('es', 'PE'),
      supportedLocales: const [Locale('es', 'PE'), Locale('es')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: _router,
      // Íconos de la barra de estado según el tema; las pantallas marinas lo sobrescriben.
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: Theme.of(context).brightness == Brightness.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
        child: child!,
      ),
    );
  }
}

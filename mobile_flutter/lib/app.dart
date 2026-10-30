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
import 'features/marketero/lab_screen.dart';
import 'features/marketero/project_detail_screen.dart';
import 'features/marketero/projects_screen.dart';
import 'features/shell/home_shell.dart';
import 'features/stats/stats_screen.dart';

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'raiz');

GoRouter _buildRouter(WidgetRef ref) {
  final session = ref.read(sessionProvider.notifier);
  final splash = ref.read(splashGateProvider);

  /// Pantallas de cuenta (segundo nivel). Se abren sobre la línea, sin barra.
  GoRoute cuenta(String path) => GoRoute(
        path: path,
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const AccountScreen(),
        routes: [
          GoRoute(path: 'foto', parentNavigatorKey: _rootKey, builder: (_, _) => const ProfilePhotoScreen()),
          GoRoute(path: 'correo', parentNavigatorKey: _rootKey, builder: (_, _) => const ChangeEmailScreen()),
          GoRoute(path: 'contrasena', parentNavigatorKey: _rootKey, builder: (_, _) => const ChangePasswordScreen()),
          GoRoute(path: 'creditos', parentNavigatorKey: _rootKey, builder: (_, _) => const CreditsScreen()),
          GoRoute(path: 'redes', parentNavigatorKey: _rootKey, builder: (_, _) => const NetworksScreen()),
        ],
      );

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
      final (raiz, primera) = switch (user.rol) {
        Rol.marketero => ('/m', '/m/dictar'),
        Rol.cliente => ('/c', '/c/aprobar'),
        Rol.superadmin => ('/admin', '/admin/inicio'),
      };
      if (publica || loc == '/cargando' || loc == '/inicio' || loc == raiz) return primera;
      if (!loc.startsWith(raiz)) return primera;
      return null;
    },
    routes: [
      GoRoute(path: '/cargando', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/inicio', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/olvide', builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(path: '/admin/inicio', builder: (_, _) => const AdminNoticeScreen()),
      // Marketero: la línea completa.
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => HomeShell(shell: shell, rol: Rol.marketero),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/m/dictar', builder: (_, _) => const LabScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/m/generar', builder: (_, _) => const ProjectsScreen(tramo: TramoCampanas.generar)),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/m/aprobar', builder: (_, _) => const ProjectsScreen(tramo: TramoCampanas.aprobar)),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/m/publicar', builder: (_, _) => const ProjectsScreen(tramo: TramoCampanas.publicar)),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: '/m/medir', builder: (_, _) => const StatsScreen())]),
        ],
      ),
      GoRoute(
        path: '/m/campana/:id',
        parentNavigatorKey: _rootKey,
        builder: (_, state) => ProjectDetailScreen(
          id: int.parse(state.pathParameters['id']!),
          inicial: state.extra is Campaign ? state.extra as Campaign : null,
        ),
      ),
      GoRoute(
        path: '/m/campanas',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const ProjectsScreen(),
      ),
      cuenta('/m/cuenta'),
      // Cliente: su tramo de la línea.
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => HomeShell(shell: shell, rol: Rol.cliente),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/c/aprobar', builder: (_, _) => const ClientHomeScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/c/publicar', builder: (_, _) => const ClientHomeScreen(tramo: TramoCliente.publicar)),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: '/c/medir', builder: (_, _) => const StatsScreen())]),
        ],
      ),
      GoRoute(
        path: '/c/revision/:id',
        parentNavigatorKey: _rootKey,
        builder: (_, state) => ReviewScreen(id: int.parse(state.pathParameters['id']!)),
      ),
      cuenta('/c/cuenta'),
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

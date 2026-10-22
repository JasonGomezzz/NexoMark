import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/tokens.dart';
import '../../widgets/motion_widgets.dart';

/// Mientras se recupera la sesión guardada. Continúa el arranque nativo sin
/// salto: el mismo ícono, del mismo tamaño y en el mismo lugar (120 pt en el
/// centro, como LaunchImage), y debajo aparece el nombre.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Nexo.navy,
        body: Stack(
          alignment: Alignment.center,
          children: [
            Image.asset('assets/brand/nexomark-icon.png', width: 120, height: 120),
            Positioned(
              top: MediaQuery.sizeOf(context).height / 2 + 74,
              child: const Entrance(
                index: 2,
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: 'NexoMark '),
                      TextSpan(text: 'IA', style: TextStyle(color: Nexo.turquoiseSoft)),
                    ],
                  ),
                  style: TextStyle(color: Nexo.onNavy, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.3),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

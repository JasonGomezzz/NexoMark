import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es');
  // Inter se descarga la primera vez y queda en caché.
  GoogleFonts.config.allowRuntimeFetching = true;
  runApp(
    // Sin reintentos automáticos: un 403 o un 404 no se arreglan repitiendo la petición.
    ProviderScope(retry: (_, _) => null, child: const NexoMarkApp()),
  );
}

import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/data/models.dart';

void main() {
  group('métricas', () {
    test('lo que el proveedor no informa queda en null, no en 0', () {
      final m = Metric.fromJson({'me_gusta': 5, 'comentarios': null});
      expect(m.meGusta, 5);
      expect(m.comentarios, isNull);
      expect(m.vacia, isFalse);
      expect(const Metric().vacia, isTrue);
    });

    test('resumen por red con serie anual: null es sin dato', () {
      final s = StatsSummary.fromJson({
        'redes': {
          'instagram': {'publicaciones': 2, 'me_gusta': 10, 'comentarios': null},
          'facebook': {'publicaciones': 0},
        },
        'total_publicaciones': 2,
        'anual': {
          'anio': 2026,
          'anios': [2026],
          'publicaciones_por_mes': [
            {'mes': '2026-10', 'instagram': 2, 'facebook': 0},
          ],
          'me_gusta_por_mes': [
            {'mes': '2026-10', 'instagram': 10, 'facebook': null},
          ],
        },
      });
      expect(s.redes['instagram']!.metricas.meGusta, 10);
      expect(s.redes['instagram']!.metricas.comentarios, isNull);
      expect(s.anio, 2026);
      expect(s.publicacionesPorMes.single.valores['facebook'], 0);
      expect(s.meGustaPorMes.single.valores['facebook'], isNull);
    });
  });

  group('campañas', () {
    test('Django (snake_case) y lista liviana', () {
      final c = Campaign.fromJson({
        'id': 49,
        'titulo': '2x1 en capuchinos',
        'estado': 'pendiente_ia',
        'cliente_nombre': 'Café Aurora',
        'cliente_email': 'cliente@test.com',
        'tiene_imagen': true,
        'marketero': 'Marketero Demo <marketero@test.com> [marketero]',
        'version': 3,
      });
      expect(c.estado, EstadoCampana.pendienteIa);
      expect(c.conImagen, isTrue);
      expect(c.imagenB64, isNull);
      expect(c.marketeroNombre, 'Marketero Demo');
      expect(c.version, 3);
    });

    test('Spring (camelCase) con destinos', () {
      final c = Campaign.fromJson({
        'id': 7,
        'titulo': 'Promo',
        'estado': 'pendiente_aprobacion',
        'clienteNombre': 'Café Aurora',
        'textoGenerado': 'Texto',
        'marketeroNombre': 'Ana',
        'destinos': [
          {'red': 'instagram', 'cuentaNombre': '@nexomarkia', 'estado': 'esperando_aprobacion'},
        ],
      });
      expect(c.clienteNombre, 'Café Aurora');
      expect(c.textoGenerado, 'Texto');
      expect(c.marketeroNombre, 'Ana');
      expect(c.destinos.single.cuentaNombre, '@nexomarkia');
    });

    test('solo borrador, generada y rechazada se editan', () {
      expect(EstadoCampana.values.where((e) => e.editable), [
        EstadoCampana.borrador,
        EstadoCampana.generado,
        EstadoCampana.rechazado,
      ]);
      expect(EstadoCampana.pendienteAprobacion.api, 'pendiente_aprobacion');
    });
  });

  group('usuario', () {
    test('cuenta de Google sin contraseña y foto con versión', () {
      final u = AppUser.fromJson({
        'id': 1,
        'email': 'ana@gmail.com',
        'nombre': 'Ana María Pérez',
        'rol': 'cliente',
        'has_avatar': true,
        'avatar_version': 1792636300,
        'has_password': false,
        'google_connected': true,
      });
      expect(u.rol, Rol.cliente);
      expect(u.iniciales, 'AM');
      expect(u.primerNombre, 'Ana');
      expect(u.hasPassword, isFalse);
      expect(u.googleConnected, isTrue);
      expect(u.avatarVersion, 1792636300);
    });

    test('sin créditos solo aplica al marketero', () {
      AppUser con(String rol, int creditos) =>
          AppUser.fromJson({'id': 1, 'email': 'a@b.c', 'nombre': 'A', 'rol': rol, 'tokens_disponibles': creditos});
      expect(con('marketero', 0).sinCreditos, isTrue);
      expect(con('marketero', 3).sinCreditos, isFalse);
      expect(con('cliente', 0).sinCreditos, isFalse);
    });
  });

  test('cambio de correo pendiente', () {
    final p = EmailChangePending.fromJson({
      'new_email': 'nuevo@test.com',
      'old_confirmed': true,
      'new_confirmed': false,
      'expires_at': '2026-10-21T22:00:00Z',
    });
    expect(p!.oldConfirmed, isTrue);
    expect(p.newConfirmed, isFalse);
    expect(EmailChangePending.fromJson(null), isNull);
  });
}

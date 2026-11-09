/// Planes y créditos de NexoMark (espejo de backend/services/credit_service.py).
///
/// Decisión del equipo (6 nov 2026), precios mensuales sin IGV:
///   Freelance     S/59  · 100 créditos  · hasta 25 generaciones
///   Agencia       S/149 · 400 créditos  · hasta 100 generaciones
///   Agencia Plus  S/299 · 1000 créditos · hasta 250 generaciones (próximamente)
///
/// Generar o regenerar texto + imagen cuesta [kCostoGeneracion] créditos. Editar,
/// enviar, aprobar, consultar y publicar en varias redes no gastan. Si la IA falla
/// sin entregar contenido, se devuelven. El costo vigente llega del API en
/// `costo_generacion` (/api/auth/me/); este valor es el respaldo.
library;

const int kCostoGeneracion = 4;

class PlanCreditos {
  const PlanCreditos({
    required this.key,
    required this.nombre,
    required this.precio,
    required this.creditos,
    required this.disponible,
  });

  final String key;
  final String nombre;
  final int precio;
  final int creditos;
  final bool disponible;

  int get generaciones => creditos ~/ kCostoGeneracion;
}

const List<PlanCreditos> kPlanes = [
  PlanCreditos(key: 'freelance', nombre: 'Freelance', precio: 59, creditos: 100, disponible: true),
  PlanCreditos(key: 'agencia', nombre: 'Agencia', precio: 149, creditos: 400, disponible: true),
  PlanCreditos(key: 'agencia_plus', nombre: 'Agencia Plus', precio: 299, creditos: 1000, disponible: false),
];

/// Generaciones completas que alcanzan con [creditos] (null si no hay dato).
int? generacionesCon(int? creditos, [int costo = kCostoGeneracion]) =>
    creditos == null ? null : (creditos < 0 ? 0 : creditos) ~/ costo;

/// "100 créditos · hasta 25 generaciones"
String creditosConGeneraciones(int? creditos, [int costo = kCostoGeneracion]) {
  final g = generacionesCon(creditos, costo);
  if (creditos == null || g == null) return 'sin dato';
  final c = creditos == 1 ? 'crédito' : 'créditos';
  final gen = g == 1 ? 'generación' : 'generaciones';
  return '$creditos $c · hasta $g $gen';
}

bool alcanzaParaGenerar(int? saldo, [int costo = kCostoGeneracion]) => saldo == null || saldo >= costo;

/// "Esta generación usará 4 créditos. Te quedan 96."
String avisoConsumo(int? saldo, {int costo = kCostoGeneracion, String accion = 'Esta generación'}) {
  final base = '$accion usará $costo créditos.';
  if (saldo == null) return base;
  return '$base Te quedan ${saldo < 0 ? 0 : saldo}.';
}

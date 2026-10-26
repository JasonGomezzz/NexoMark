/// Modelos de la API. Django responde en snake_case y Spring en camelCase:
/// cada `fromJson` acepta ambos. Un dato que el proveedor no informa queda en
/// null y la UI lo muestra como "sin dato", nunca como 0.
library;

T? _pick<T>(Map<String, dynamic> j, String snake, [String? camel]) {
  final value = j[snake] ?? (camel != null ? j[camel] : null);
  return value is T ? value : null;
}

int? _int(Map<String, dynamic> j, String snake, [String? camel]) {
  final value = j[snake] ?? (camel != null ? j[camel] : null);
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

DateTime? _date(Map<String, dynamic> j, String snake, [String? camel]) {
  final value = _pick<String>(j, snake, camel);
  return value == null ? null : DateTime.tryParse(value)?.toLocal();
}

List<Map<String, dynamic>> _list(dynamic value) =>
    value is List ? value.whereType<Map<String, dynamic>>().toList() : const [];

enum Rol { marketero, cliente, superadmin }

Rol rolDesde(String? value) => switch (value) {
  'cliente' => Rol.cliente,
  'superadmin' => Rol.superadmin,
  _ => Rol.marketero,
};

class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.nombre,
    required this.rol,
    this.tokensDisponibles,
    this.hasAvatar = false,
    this.avatarVersion,
    this.hasPassword = true,
    this.googleConnected = false,
  });

  final int id;
  final String email;
  final String nombre;
  final Rol rol;
  final int? tokensDisponibles;
  final bool hasAvatar;
  final int? avatarVersion;
  final bool hasPassword;
  final bool googleConnected;

  String get primerNombre => nombre.trim().split(RegExp(r'\s+')).first;
  String get iniciales {
    final partes = nombre
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (partes.isEmpty) return '?';
    return partes.take(2).map((p) => p[0].toUpperCase()).join();
  }

  bool get sinCreditos => rol == Rol.marketero && (tokensDisponibles ?? 1) <= 0;

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
    id: _int(j, 'id') ?? 0,
    email: _pick<String>(j, 'email') ?? '',
    nombre: _pick<String>(j, 'nombre') ?? '',
    rol: rolDesde(_pick<String>(j, 'rol', 'role')),
    tokensDisponibles: _int(j, 'tokens_disponibles', 'tokensDisponibles'),
    hasAvatar: j['has_avatar'] == true,
    avatarVersion:
        _int(j, 'avatar_version') ??
        (j['has_avatar'] == true ? _int(j, 'id') : null),
    hasPassword: j['has_password'] != false,
    googleConnected: j['google_connected'] == true,
  );
}

/// Estados de la FSM de campaña (Campaign.VALID_TRANSITIONS).
enum EstadoCampana {
  borrador('Borrador'),
  pendienteIa('Generando con IA'),
  generado('Generada'),
  pendienteAprobacion('Pendiente de aprobación'),
  aprobado('Aprobada'),
  rechazado('Rechazada'),
  fracaso('Cerrada sin aprobar');

  const EstadoCampana(this.etiqueta);
  final String etiqueta;

  static EstadoCampana desde(String? value) => switch (value) {
    'pendiente_ia' => pendienteIa,
    'generado' => generado,
    'pendiente_aprobacion' => pendienteAprobacion,
    'aprobado' => aprobado,
    'rechazado' => rechazado,
    'fracaso' => fracaso,
    _ => borrador,
  };

  String get api => switch (this) {
    pendienteIa => 'pendiente_ia',
    pendienteAprobacion => 'pendiente_aprobacion',
    _ => name,
  };

  bool get editable =>
      this == borrador || this == generado || this == rechazado;
}

class Destino {
  const Destino({
    required this.red,
    required this.cuentaNombre,
    this.estado,
    this.permalink,
  });
  final String red;
  final String cuentaNombre;
  final String? estado;
  final String? permalink;

  factory Destino.fromJson(Map<String, dynamic> j) => Destino(
    red: _pick<String>(j, 'red') ?? '',
    cuentaNombre: _pick<String>(j, 'cuenta_nombre', 'cuentaNombre') ?? '',
    estado: _pick<String>(j, 'estado'),
    permalink: _pick<String>(j, 'permalink'),
  );
}

class Campaign {
  const Campaign({
    required this.id,
    required this.titulo,
    required this.estado,
    this.clienteNombre = '',
    this.clienteEmail = '',
    this.industria = '',
    this.tono = '',
    this.plataforma = '',
    this.prompt = '',
    this.textoGenerado,
    this.imagenB64,
    this.tieneImagen = false,
    this.iaErrorMessage,
    this.feedbackRechazo,
    this.clienteValoracion,
    this.rechazosClienteCount = 0,
    this.marketeroNombre,
    this.fechaCreacion,
    this.enviadoClienteAt,
    this.version = 1,
    this.destinos = const [],
  });

  final int id;
  final String titulo;
  final EstadoCampana estado;
  final String clienteNombre;
  final String clienteEmail;
  final String industria;
  final String tono;
  final String plataforma;
  final String prompt;
  final String? textoGenerado;
  final String? imagenB64;
  final bool tieneImagen;
  final String? iaErrorMessage;
  final String? feedbackRechazo;
  final int? clienteValoracion;
  final int rechazosClienteCount;
  final String? marketeroNombre;
  final DateTime? fechaCreacion;
  final DateTime? enviadoClienteAt;
  final int version;
  final List<Destino> destinos;

  bool get conImagen => (imagenB64?.isNotEmpty ?? false) || tieneImagen;

  factory Campaign.fromJson(Map<String, dynamic> j) {
    final imagen = _pick<String>(j, 'imagen_b64', 'imagenB64');
    return Campaign(
      id: _int(j, 'id') ?? 0,
      titulo: _pick<String>(j, 'titulo') ?? 'Sin título',
      estado: EstadoCampana.desde(_pick<String>(j, 'estado')),
      clienteNombre: _pick<String>(j, 'cliente_nombre', 'clienteNombre') ?? '',
      clienteEmail: _pick<String>(j, 'cliente_email', 'clienteEmail') ?? '',
      industria: _pick<String>(j, 'industria') ?? '',
      tono: _pick<String>(j, 'tono') ?? '',
      plataforma: _pick<String>(j, 'plataforma') ?? '',
      prompt: _pick<String>(j, 'prompt') ?? '',
      textoGenerado: _pick<String>(j, 'texto_generado', 'textoGenerado'),
      imagenB64: imagen,
      tieneImagen: j['tiene_imagen'] == true || (imagen?.isNotEmpty ?? false),
      iaErrorMessage: _pick<String>(j, 'ia_error_message'),
      feedbackRechazo: _pick<String>(j, 'feedback_rechazo', 'feedbackRechazo'),
      clienteValoracion: _int(j, 'cliente_valoracion', 'clienteValoracion'),
      rechazosClienteCount:
          _int(j, 'rechazos_cliente_count', 'rechazosClienteCount') ?? 0,
      // Django manda "Nombre <correo> [rol]" (StringRelatedField); Spring, solo el nombre.
      marketeroNombre: _pick<String>(
        j,
        'marketero',
        'marketeroNombre',
      )?.split(' <').first,
      fechaCreacion: _date(j, 'fecha_creacion', 'fechaCreacion'),
      enviadoClienteAt: _date(j, 'enviado_cliente_at', 'enviadoClienteAt'),
      version: _int(j, 'version') ?? 1,
      destinos: _list(j['destinos']).map(Destino.fromJson).toList(),
    );
  }
}

class CampaignStats {
  const CampaignStats({
    this.total = 0,
    this.tokensDisponibles,
    this.borrador = 0,
    this.pendienteIa = 0,
    this.generado = 0,
    this.pendienteAprobacion = 0,
    this.aprobado = 0,
    this.rechazado = 0,
  });

  final int total;
  final int? tokensDisponibles;
  final int borrador;
  final int pendienteIa;
  final int generado;
  final int pendienteAprobacion;
  final int aprobado;
  final int rechazado;

  factory CampaignStats.fromJson(Map<String, dynamic> j) => CampaignStats(
    total: _int(j, 'total') ?? 0,
    tokensDisponibles: _int(j, 'tokens_disponibles'),
    borrador: _int(j, 'borrador') ?? 0,
    pendienteIa: _int(j, 'pendiente_ia') ?? 0,
    generado: _int(j, 'generado') ?? 0,
    pendienteAprobacion: _int(j, 'pendiente_aprobacion') ?? 0,
    aprobado: _int(j, 'aprobado') ?? 0,
    rechazado: _int(j, 'rechazado') ?? 0,
  );
}

/// Campos de una campaña que propone la IA a partir del brief.
const camposIntent = [
  'titulo',
  'cliente_nombre',
  'cliente_email',
  'industria',
  'tono',
  'plataforma',
  'prompt',
];

class CampaignIntent {
  const CampaignIntent({
    required this.id,
    required this.estado,
    required this.campos,
    required this.faltantes,
    required this.advertencias,
    this.campaignId,
  });

  final int id;
  final String estado;
  final Map<String, String?> campos;
  final List<String> faltantes;
  final List<String> advertencias;
  final int? campaignId;

  factory CampaignIntent.fromJson(Map<String, dynamic> j) {
    final finales = j['campos_finales'];
    return CampaignIntent(
      id: _int(j, 'id') ?? 0,
      estado: _pick<String>(j, 'estado') ?? 'borrador',
      campos: finales is Map
          ? finales.map((k, v) => MapEntry('$k', v is String ? v : null))
          : {},
      faltantes:
          (j['campos_faltantes'] as List?)?.whereType<String>().toList() ??
          const [],
      advertencias:
          (j['advertencias'] as List?)?.whereType<String>().toList() ??
          const [],
      campaignId: _int(j, 'campaign'),
    );
  }
}

class CampaignVersion {
  const CampaignVersion({
    required this.id,
    required this.numero,
    required this.textoPreview,
    required this.tieneImagen,
    this.imagenB64,
    this.creada,
  });

  final int id;
  final int numero;
  final String textoPreview;
  final bool tieneImagen;
  final String? imagenB64;
  final DateTime? creada;

  factory CampaignVersion.fromJson(Map<String, dynamic> j) => CampaignVersion(
    id: _int(j, 'id') ?? 0,
    numero: _int(j, 'version_number') ?? 0,
    textoPreview: _pick<String>(j, 'texto_preview') ?? '',
    tieneImagen: j['tiene_imagen'] == true,
    imagenB64: _pick<String>(j, 'imagen_b64'),
    creada: _date(j, 'created_at'),
  );
}

class SocialConnection {
  const SocialConnection({
    required this.id,
    required this.red,
    required this.cuentaNombre,
    required this.estado,
    this.propietarioEmail,
    this.propietarioRol,
  });

  final int id;
  final String red;
  final String cuentaNombre;
  final String estado;
  final String? propietarioEmail;
  final String? propietarioRol;

  factory SocialConnection.fromJson(Map<String, dynamic> j) => SocialConnection(
    id: _int(j, 'id') ?? 0,
    red: _pick<String>(j, 'red') ?? '',
    cuentaNombre: _pick<String>(j, 'cuenta_nombre') ?? '',
    estado: _pick<String>(j, 'estado') ?? '',
    propietarioEmail: _pick<String>(j, 'propietario_email'),
    propietarioRol: _pick<String>(j, 'propietario_rol'),
  );
}

class Metric {
  const Metric({
    this.meGusta,
    this.comentarios,
    this.compartidos,
    this.guardados,
    this.alcance,
    this.vistas,
    this.interacciones,
    this.obtenida,
  });

  final int? meGusta;
  final int? comentarios;
  final int? compartidos;
  final int? guardados;
  final int? alcance;
  final int? vistas;
  final int? interacciones;
  final DateTime? obtenida;

  bool get vacia => [
    meGusta,
    comentarios,
    compartidos,
    guardados,
    alcance,
    vistas,
    interacciones,
  ].every((v) => v == null);

  factory Metric.fromJson(Map<String, dynamic> j) => Metric(
    meGusta: _int(j, 'me_gusta'),
    comentarios: _int(j, 'comentarios'),
    compartidos: _int(j, 'compartidos'),
    guardados: _int(j, 'guardados'),
    alcance: _int(j, 'alcance'),
    vistas: _int(j, 'vistas'),
    interacciones: _int(j, 'interacciones'),
    obtenida: _date(j, 'obtenida_at', 'metricas_al'),
  );
}

class Publication {
  const Publication({
    required this.id,
    required this.campaignId,
    required this.red,
    required this.cuentaNombre,
    required this.estado,
    this.campaignTitulo,
    this.clienteNombre,
    this.permalink,
    this.error,
    this.intentos = 0,
    this.publicadoAt,
    this.ultimaMetrica,
    this.copyAprobado,
    this.resultadoIncierto = false,
  });

  final int id;
  final int campaignId;
  final String red;
  final String cuentaNombre;
  final String estado;
  final String? campaignTitulo;
  final String? clienteNombre;
  final String? permalink;
  final String? error;
  final int intentos;
  final DateTime? publicadoAt;
  final Metric? ultimaMetrica;
  final String? copyAprobado;
  final bool resultadoIncierto;

  factory Publication.fromJson(Map<String, dynamic> j) {
    final metrica = j['ultima_metrica'];
    return Publication(
      id: _int(j, 'id') ?? 0,
      campaignId: _int(j, 'campaign') ?? 0,
      red: _pick<String>(j, 'red') ?? '',
      cuentaNombre: _pick<String>(j, 'cuenta_nombre') ?? '',
      estado: _pick<String>(j, 'estado') ?? '',
      campaignTitulo: _pick<String>(j, 'campaign_titulo'),
      clienteNombre: _pick<String>(j, 'cliente_nombre'),
      permalink: _pick<String>(j, 'permalink'),
      error: _pick<String>(j, 'error'),
      intentos: _int(j, 'intentos') ?? 0,
      publicadoAt: _date(j, 'publicado_at'),
      ultimaMetrica: metrica is Map<String, dynamic>
          ? Metric.fromJson(metrica)
          : null,
      copyAprobado: _pick<String>(j, 'copy_aprobado'),
      resultadoIncierto: j['resultado_incierto'] == true,
    );
  }
}

class NetworkSummary {
  const NetworkSummary({
    required this.red,
    this.publicaciones = 0,
    this.publicacionesMes = 0,
    this.conMetricas = 0,
    this.metricas = const Metric(),
  });

  final String red;
  final int publicaciones;
  final int publicacionesMes;
  final int conMetricas;
  final Metric metricas;

  factory NetworkSummary.fromJson(String red, Map<String, dynamic> j) =>
      NetworkSummary(
        red: red,
        publicaciones: _int(j, 'publicaciones') ?? 0,
        publicacionesMes: _int(j, 'publicaciones_mes') ?? 0,
        conMetricas: _int(j, 'con_metricas') ?? 0,
        metricas: Metric.fromJson(j),
      );
}

class MonthPoint {
  const MonthPoint(this.mes, this.valores);
  final String mes;
  final Map<String, int?> valores;
}

class StatsSummary {
  const StatsSummary({
    required this.redes,
    this.totalPublicaciones = 0,
    this.fallidas = 0,
    this.pendientes = 0,
    this.anio,
    this.anios = const [],
    this.publicacionesPorMes = const [],
    this.meGustaPorMes = const [],
  });

  final Map<String, NetworkSummary> redes;
  final int totalPublicaciones;
  final int fallidas;
  final int pendientes;
  final int? anio;
  final List<int> anios;
  final List<MonthPoint> publicacionesPorMes;
  final List<MonthPoint> meGustaPorMes;

  factory StatsSummary.fromJson(Map<String, dynamic> j) {
    final redes = <String, NetworkSummary>{};
    final raw = j['redes'];
    if (raw is Map<String, dynamic>) {
      raw.forEach((red, valor) {
        if (valor is Map<String, dynamic>) {
          redes[red] = NetworkSummary.fromJson(red, valor);
        }
      });
    }
    final anual = j['anual'] is Map<String, dynamic>
        ? j['anual'] as Map<String, dynamic>
        : const <String, dynamic>{};
    List<MonthPoint> serie(dynamic filas) => _list(filas).map((f) {
      final valores = <String, int?>{};
      for (final red in redes.keys) {
        final v = f[red];
        valores[red] = v is num ? v.toInt() : null;
      }
      return MonthPoint(f['mes'] as String? ?? '', valores);
    }).toList();
    return StatsSummary(
      redes: redes,
      totalPublicaciones: _int(j, 'total_publicaciones') ?? 0,
      fallidas: _int(j, 'fallidas') ?? 0,
      pendientes: _int(j, 'pendientes') ?? 0,
      anio: _int(anual, 'anio'),
      anios:
          (anual['anios'] as List?)
              ?.whereType<num>()
              .map((n) => n.toInt())
              .toList() ??
          const [],
      publicacionesPorMes: serie(anual['publicaciones_por_mes']),
      meGustaPorMes: serie(anual['me_gusta_por_mes']),
    );
  }
}

class CreditRequest {
  const CreditRequest({
    required this.id,
    required this.estado,
    this.motivo = '',
    this.creditosOtorgados = 0,
    this.notaResolucion = '',
    this.fecha,
  });

  final int id;
  final String estado;
  final String motivo;
  final int creditosOtorgados;
  final String notaResolucion;
  final DateTime? fecha;

  factory CreditRequest.fromJson(Map<String, dynamic> j) => CreditRequest(
    id: _int(j, 'id') ?? 0,
    estado: _pick<String>(j, 'estado') ?? 'pendiente',
    motivo: _pick<String>(j, 'motivo') ?? '',
    creditosOtorgados: _int(j, 'creditos_otorgados') ?? 0,
    notaResolucion: _pick<String>(j, 'nota_resolucion') ?? '',
    fecha: _date(j, 'fecha_creacion'),
  );
}

class XConfig {
  const XConfig({
    this.habilitado = false,
    this.costoPostUsd,
    this.restantes = 0,
    this.maximoMes = 0,
  });
  final bool habilitado;
  final String? costoPostUsd;
  final int restantes;
  final int maximoMes;

  factory XConfig.fromJson(Map<String, dynamic> j) => XConfig(
    habilitado: j['habilitado'] == true,
    costoPostUsd: j['costo_post_usd']?.toString(),
    restantes: _int(j, 'restantes') ?? 0,
    maximoMes: _int(j, 'maximo_mes') ?? 0,
  );
}

class XVariant {
  const XVariant({
    required this.id,
    required this.campaignId,
    required this.texto,
    required this.estado,
    this.longitud = 0,
    this.limite = 280,
    this.hashTexto,
    this.feedbackCliente = '',
    this.vigente = true,
    this.bloqueada = false,
    this.campaignTitulo,
    this.publicaciones = const [],
  });

  final int id;
  final int campaignId;
  final String texto;
  final String estado;
  final int longitud;
  final int limite;
  final String? hashTexto;
  final String feedbackCliente;
  final bool vigente;
  final bool bloqueada;
  final String? campaignTitulo;
  final List<Publication> publicaciones;

  factory XVariant.fromJson(Map<String, dynamic> j) => XVariant(
    id: _int(j, 'id') ?? 0,
    campaignId: _int(j, 'campaign') ?? 0,
    texto: _pick<String>(j, 'texto') ?? '',
    estado: _pick<String>(j, 'estado') ?? 'borrador',
    longitud: _int(j, 'longitud') ?? 0,
    limite: _int(j, 'limite') ?? 280,
    hashTexto: _pick<String>(j, 'hash_texto'),
    feedbackCliente: _pick<String>(j, 'feedback_cliente') ?? '',
    vigente: j['vigente'] != false,
    bloqueada: j['bloqueada'] == true,
    campaignTitulo: _pick<String>(j, 'campaign_titulo'),
    publicaciones: _list(j['publicaciones']).map(Publication.fromJson).toList(),
  );
}

class EmailChangePending {
  const EmailChangePending({
    required this.newEmail,
    required this.oldConfirmed,
    required this.newConfirmed,
    required this.expiresAt,
  });

  final String newEmail;
  final bool oldConfirmed;
  final bool newConfirmed;
  final DateTime expiresAt;

  static EmailChangePending? fromJson(dynamic j) {
    if (j is! Map<String, dynamic>) return null;
    final expira = _date(j, 'expires_at');
    if (expira == null) return null;
    return EmailChangePending(
      newEmail: _pick<String>(j, 'new_email') ?? '',
      oldConfirmed: j['old_confirmed'] == true,
      newConfirmed: j['new_confirmed'] == true,
      expiresAt: expira,
    );
  }
}

class TikTokConfig {
  const TikTokConfig({
    this.configurado = false,
    this.mediosVerificados = false,
    this.maxTexto = 4000,
  });
  final bool configurado;
  final bool mediosVerificados;
  final int maxTexto;

  factory TikTokConfig.fromJson(Map<String, dynamic> j) => TikTokConfig(
    configurado: j['configurado'] == true,
    mediosVerificados: j['medios_verificados'] == true,
    maxTexto: _int(j, 'max_texto') ?? 4000,
  );
}

import 'package:flutter_test/flutter_test.dart';
import 'package:nexomark/features/voice/dictation.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('un aviso tardío del reconocedor tras cerrar Dictar no falla ni escribe', () {
    var escritos = 0;
    final dictado = DictationController(onText: (_) => escritos++);
    var avisos = 0;
    dictado.addListener(() => avisos++);
    dictado.dispose();
    expect(() => dictado.notifyListeners(), returnsNormally);
    expect(avisos, 0);
    expect(escritos, 0);
  });
}

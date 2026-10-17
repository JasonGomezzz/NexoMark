"""Reglas del texto para X: conteo ponderado, enlaces y resumen. Casos compartidos con el frontend."""

import json
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

from services import gemini_text_service, x_texto
from services.gemini_text_service import resumir_para_x

CASOS = json.loads((Path(__file__).parent / "casos_texto_x.json").read_text(encoding="utf-8"))["casos"]


def texto_del_caso(caso: dict) -> str:
    return caso["texto"] if "texto" in caso else caso["repetir"] * caso["veces"]


@pytest.mark.parametrize("caso", CASOS, ids=[c["nombre"] for c in CASOS])
def test_casos_compartidos_con_el_frontend(caso):
    texto = texto_del_caso(caso)
    assert x_texto.longitud_ponderada(texto) == caso["longitud"]
    assert x_texto.buscar_url(texto) == caso["url"]
    validacion = x_texto.validar(texto)
    assert validacion["valido"] is caso["valido"], validacion["motivo"]
    assert validacion["longitud"] == caso["longitud"] and validacion["limite"] == 280


def test_mensajes_explican_que_corregir():
    assert "US$0.20" in x_texto.validar("Compra en cafe.pe")["motivo"]
    assert x_texto.validar("a" * 281)["motivo"] == "El texto para X tiene 281 de 280 caracteres ponderados."
    assert x_texto.validar("")["motivo"] == "El texto para X está vacío."


class TestResumenBasico:
    LARGO = ("¡Este fin de semana 2x1 en todos los capuchinos de Café Aurora! " * 8) + "Visita https://cafe.pe/promo"

    def test_recorta_por_palabras_sin_enlaces_y_es_determinista(self):
        resumen = x_texto.resumen_basico(self.LARGO)
        assert resumen == x_texto.resumen_basico(self.LARGO)
        assert resumen.endswith("…")
        assert x_texto.validar(resumen)["valido"]
        assert 270 <= x_texto.longitud_ponderada(resumen) <= 280
        assert "http" not in resumen

    def test_texto_corto_queda_igual_salvo_enlaces_y_espacios(self):
        assert x_texto.resumen_basico("  2x1   en capuchinos  ") == "2x1 en capuchinos"
        assert x_texto.resumen_basico("Pide en cafeaurora.com hoy") == "Pide en hoy"

    def test_texto_sin_espacios_se_recorta_por_caracteres(self):
        resumen = x_texto.resumen_basico("中" * 200)
        assert x_texto.validar(resumen)["valido"] and resumen.endswith("…")


class TestResumirParaX:
    def test_modo_simulado_no_llama_a_gemini(self, settings):
        settings.USE_MOCK_AI = True
        with patch.object(gemini_text_service.httpx, "post", side_effect=AssertionError("no debe llamar")):
            texto, por_ia = resumir_para_x(TestResumenBasico.LARGO, "gastronomia", "casual")
        assert por_ia is False
        assert texto == x_texto.resumen_basico(TestResumenBasico.LARGO)

    def respuesta(self, texto: str) -> httpx.Response:
        return httpx.Response(
            200, json={"candidates": [{"content": {"parts": [{"text": texto}]}}]},
            request=httpx.Request("POST", "https://gemini.test"),
        )

    def test_gemini_valido_se_marca_como_ia(self, settings):
        settings.USE_MOCK_AI = False
        with patch.object(gemini_text_service.httpx, "post", return_value=self.respuesta('"2x1 en capuchinos ☕"')):
            assert resumir_para_x("Copy largo", "gastronomia", "casual") == ("2x1 en capuchinos ☕", True)

    def test_gemini_con_enlace_o_error_usa_el_recorte_sin_ia(self, settings):
        settings.USE_MOCK_AI = False
        with patch.object(gemini_text_service.httpx, "post", return_value=self.respuesta("Compra en cafe.pe")):
            assert resumir_para_x("Copy aprobado", "retail", "casual") == ("Copy aprobado", False)
        with patch.object(gemini_text_service.httpx, "post", side_effect=httpx.ConnectError("caído")):
            assert resumir_para_x("Copy aprobado", "retail", "casual") == ("Copy aprobado", False)

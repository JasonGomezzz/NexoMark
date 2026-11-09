from django.urls import path
from rest_framework.routers import SimpleRouter
from .instagram_publication import InstagramPublishView
from .facebook_publication import FacebookPublishView
from .x_publication import XPublishView, XSummaryView
from .tiktok_publication import TikTokUploadView, TikTokUploadStatusView
from .tiktok_publication_link import TikTokPublicationLinkView
from .publication_statistics import PublicationStatisticsView, RefreshPublicationStatisticsView

from .views import (
    CampaignExportPDFView,
    CampaignVersionListView,
    CampaignVersionRestoreView,
    CampaignViewSet,
    EmailSentCallbackView,
    IaResultCallbackView,
    GeminiVoiceView,
    GeminiTranscriptionView,
)

router = SimpleRouter()
router.register(r"", CampaignViewSet, basename="campaign")

urlpatterns = [
    path('publication-statistics/', PublicationStatisticsView.as_view()),
    path('<int:campaign_id>/publication-statistics/', PublicationStatisticsView.as_view()),
    path('<int:campaign_id>/publication-statistics/refresh/', RefreshPublicationStatisticsView.as_view()),
    path('<int:campaign_id>/send-tiktok/', TikTokUploadView.as_view()),
    path('<int:campaign_id>/tiktok-status/', TikTokUploadStatusView.as_view()),
    path('<int:campaign_id>/link-tiktok-publication/', TikTokPublicationLinkView.as_view()),
    path('<int:campaign_id>/summarize-x/', XSummaryView.as_view(), name='summarize-x'),
    path('<int:campaign_id>/publish-x/', XPublishView.as_view(), name='publish-x'),
    path('<int:campaign_id>/publish-facebook/', FacebookPublishView.as_view(), name='publish-facebook'),
    path('<int:campaign_id>/publish-instagram/', InstagramPublishView.as_view(), name='publish-instagram'),
    path("voice/synthesize/", GeminiVoiceView.as_view(), name="gemini-voice"),
    path("voice/transcribe/", GeminiTranscriptionView.as_view(), name="gemini-transcription"),
    # Rutas de callback n8n → Django (sin JWT, antes del router para evitar colisiones)
    path("webhook/ia-result/", IaResultCallbackView.as_view(), name="ia-result-callback"),
    path("webhook/email-sent/", EmailSentCallbackView.as_view(), name="email-sent-callback"),
    # Historial de versiones (HU23)
    path("<int:campaign_id>/versions/", CampaignVersionListView.as_view(), name="campaign-versions"),
    path(
        "<int:campaign_id>/versions/<int:version_id>/restore/",
        CampaignVersionRestoreView.as_view(),
        name="campaign-version-restore",
    ),
    # Exportar PDF (HU25)
    path("<int:campaign_id>/export-pdf/", CampaignExportPDFView.as_view(), name="campaign-export-pdf"),
] + router.urls

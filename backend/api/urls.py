from django.urls import path
from api.views import SummarizeView

urlpatterns = [
    path("summarize/", SummarizeView.as_view(), name="summarize"),
]

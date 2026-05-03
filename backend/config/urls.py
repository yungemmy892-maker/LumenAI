from django.urls import path, include
from django.http import JsonResponse

def root(request):
    return JsonResponse({"message": "AI Summarizer API is running "})

urlpatterns = [
    path("", root),  
    path("api/", include("api.urls")),
]
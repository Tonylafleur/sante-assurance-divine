from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.api.routes.auth import get_current_active_user
from app.services.ai_assistant import chat_with_assistant, evaluer_urgence, suggerer_prescription, ai_status

router = APIRouter(prefix="/ai", tags=["Assistant IA"])


@router.get("/status")
async def status(current_user=Depends(get_current_active_user)):
    return await ai_status()


class ChatMessage(BaseModel):
    role: str  # user / assistant
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[dict] = None


class TriageRequest(BaseModel):
    symptomes: str
    signes_vitaux: Optional[dict] = None


class PrescriptionRequest(BaseModel):
    diagnostic: str
    patient_info: dict
    symptomes: str


@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user=Depends(get_current_active_user)
):
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    response = await chat_with_assistant(messages, request.context)
    return {"response": response}


@router.post("/triage")
async def triage(
    request: TriageRequest,
    current_user=Depends(get_current_active_user)
):
    result = await evaluer_urgence(request.symptomes, request.signes_vitaux)
    return result


@router.post("/prescription/suggerer")
async def suggerer(
    request: PrescriptionRequest,
    current_user=Depends(get_current_active_user)
):
    result = await suggerer_prescription(request.diagnostic, request.patient_info, request.symptomes)
    return result

from typing import Optional
import json
import logging
import anthropic
import httpx
from app.config import settings

logger = logging.getLogger("uvicorn.error")

SYSTEME_SANTE_CAMEROUN = """Tu es un assistant médical intelligent intégré dans le système de gestion du Centre de Santé "Assurance Divine" à Yaoundé, Cameroun.

CONTEXTE :
- Centre de santé intégré offrant : consultations générales et spécialisées, hospitalisation, kinésithérapie, CPN, accouchements, petite chirurgie, laboratoire, vaccination, gynécologie, pro-pharmacie, éducation sanitaire.
- Les patients sont principalement des camerounais.
- Les protocoles de traitement suivent les directives du Ministère de la Santé Publique du Cameroun (MINSANTÉ) et de l'OMS Afrique.
- Les maladies prévalentes incluent : paludisme, typhoïde, VIH/SIDA, tuberculose, diabète, HTA, infections respiratoires, maladies diarrhéiques, parasitoses.

TES CAPACITÉS :
1. **TRIAGE INTELLIGENT** : Évalue le niveau d'urgence (Vert/Jaune/Orange/Rouge) selon les symptômes.
2. **AIDE AU DIAGNOSTIC** : Propose des hypothèses diagnostiques différentielles basées sur les symptômes et signes vitaux.
3. **PRESCRIPTIONS** : Suggère des traitements conformes aux protocoles MINSANTÉ et essentiels OMS, avec les posologies adaptées aux adultes et enfants.
4. **ÉDUCATION SANITAIRE** : Répond aux questions de santé en français simple et accessible.
5. **SUIVI CPN** : Interprète les paramètres de suivi prénatal selon les normes CPN-R du Cameroun.
6. **ALERTE MÉDICAMENT** : Vérifie les interactions médicamenteuses et les contre-indications.

RÈGLES IMPORTANTES :
- Toujours rappeler que tes suggestions sont une aide à la décision, pas un diagnostic final.
- Utiliser les noms DCI des médicaments de la liste des médicaments essentiels OMS.
- Adapter les conseils au contexte africain (disponibilité médicaments, ressources limitées).
- Répondre en français.
- En cas d'urgence (niveau Rouge), recommander immédiatement un transfert si les capacités locales sont insuffisantes.
"""


# ─── Aiguillage multi-provider (cloud Anthropic / local Ollama) ───────────────

def _anthropic_dispo() -> bool:
    return bool(settings.ANTHROPIC_API_KEY) and settings.AI_PROVIDER in ("auto", "anthropic")


def _ollama_actif() -> bool:
    return settings.AI_PROVIDER in ("auto", "ollama")


async def _ollama_genere(system: str, messages: list[dict], max_tokens: int, json_mode: bool) -> str:
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [{"role": "system", "content": system}, *messages],
        "stream": False,
        "options": {"num_predict": max_tokens, "temperature": 0.3},
    }
    if json_mode:
        payload["format"] = "json"
    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(f"{settings.OLLAMA_URL}/api/chat", json=payload)
        r.raise_for_status()
        return r.json()["message"]["content"]


def _anthropic_genere(system: str, messages: list[dict], max_tokens: int) -> str:
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001", max_tokens=max_tokens,
        system=system, messages=messages,
    )
    return response.content[0].text


async def _generer(system: str, messages: list[dict], max_tokens: int = 1500, json_mode: bool = False) -> Optional[str]:
    """Essaie le cloud puis le local selon AI_PROVIDER. Renvoie None si aucun n'est disponible."""
    if _anthropic_dispo():
        try:
            return _anthropic_genere(system, messages, max_tokens)
        except Exception as exc:
            logger.warning(f"[IA] Anthropic indisponible: {exc}")
            if settings.AI_PROVIDER == "anthropic":
                return None
    if _ollama_actif():
        try:
            return await _ollama_genere(system, messages, max_tokens, json_mode)
        except Exception as exc:
            logger.warning(f"[IA] Ollama indisponible: {exc}")
    return None


def _extraire_json(texte: str) -> Optional[dict]:
    try:
        start = texte.find("{")
        end = texte.rfind("}") + 1
        return json.loads(texte[start:end])
    except Exception:
        return None


async def ai_status() -> dict:
    """Renvoie le provider actif et sa disponibilité (pour l'interface)."""
    if _anthropic_dispo():
        return {"provider": "anthropic", "label": "IA Cloud (Claude)", "disponible": True, "modele": "claude-haiku-4-5"}
    if _ollama_actif():
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{settings.OLLAMA_URL}/api/tags")
                r.raise_for_status()
            return {"provider": "ollama", "label": "IA Locale (hors-ligne)", "disponible": True, "modele": settings.OLLAMA_MODEL}
        except Exception:
            return {"provider": "ollama", "label": "IA Locale (modèle non démarré)", "disponible": False, "modele": settings.OLLAMA_MODEL}
    return {"provider": "aucun", "label": "IA non configurée", "disponible": False, "modele": None}


async def chat_with_assistant(messages: list[dict], context: Optional[dict] = None) -> str:
    """Interaction avec l'assistant IA médical."""
    system = SYSTEME_SANTE_CAMEROUN
    if context:
        system += f"\n\nCONTEXTE PATIENT ACTUEL :\n{_format_context(context)}"
    texte = await _generer(system, messages, max_tokens=1500)
    if texte is None:
        return _fallback_response(messages[-1].get("content", ""), context)
    return texte


async def evaluer_urgence(symptomes: str, signes_vitaux: Optional[dict] = None) -> dict:
    """Évalue le niveau d'urgence d'un patient."""
    prompt = f"""Évalue le niveau d'urgence pour ce patient avec les informations suivantes :

Symptômes : {symptomes}
{"Signes vitaux : " + str(signes_vitaux) if signes_vitaux else ""}

Réponds UNIQUEMENT en JSON avec :
{{
  "niveau": "vert|jaune|orange|rouge",
  "score_urgence": 1-10,
  "raison": "explication courte",
  "actions_immediates": ["action 1", "action 2"],
  "diagnostics_possibles": ["diagnostic 1", "diagnostic 2", "diagnostic 3"],
  "examens_recommandes": ["examen 1", "examen 2"]
}}"""
    texte = await _generer(SYSTEME_SANTE_CAMEROUN, [{"role": "user", "content": prompt}], max_tokens=600, json_mode=True)
    if texte is None:
        return {"niveau": "jaune", "raison": "IA non disponible - évaluation manuelle requise", "actions_immediates": [], "diagnostics_possibles": [], "examens_recommandes": []}
    data = _extraire_json(texte)
    return data or {"niveau": "jaune", "raison": "Erreur analyse IA", "actions_immediates": [], "diagnostics_possibles": [], "examens_recommandes": []}


async def suggerer_prescription(diagnostic: str, patient_info: dict, symptomes: str) -> dict:
    """Suggère une prescription basée sur le diagnostic."""
    age = patient_info.get("age", "adulte")
    poids = patient_info.get("poids", "")
    allergies = patient_info.get("allergies", "aucune connue")
    prompt = f"""Propose une prescription pour ce patient :
Diagnostic : {diagnostic}
Symptômes : {symptomes}
Patient : {age} ans, poids {poids}kg, allergies : {allergies}

Réponds UNIQUEMENT en JSON :
{{
  "medicaments": [
    {{"dci": "nom DCI", "posologie": "posologie détaillée", "duree": "durée", "instructions": "instructions spéciales"}}
  ],
  "examens_complementaires": ["examen 1"],
  "conseils_hygiene": ["conseil 1", "conseil 2"],
  "rdv_controle": "délai recommandé",
  "signes_alarme": ["signe 1", "signe 2"]
}}"""
    texte = await _generer(SYSTEME_SANTE_CAMEROUN, [{"role": "user", "content": prompt}], max_tokens=800, json_mode=True)
    if texte is None:
        return {"medicaments": [], "note": "IA non disponible"}
    data = _extraire_json(texte)
    return data or {"medicaments": [], "note": "Erreur lors de la suggestion"}


def _format_context(context: dict) -> str:
    lines = []
    if "patient" in context:
        p = context["patient"]
        lines.append(f"Patient : {p.get('nom', '')} {p.get('prenom', '')}, {p.get('age', '')} ans, {p.get('sexe', '')}")
        if p.get("allergies"):
            lines.append(f"Allergies : {p['allergies']}")
        if p.get("antecedents"):
            lines.append(f"Antécédents : {p['antecedents']}")
    if "consultation" in context:
        c = context["consultation"]
        lines.append(f"Motif : {c.get('motif', '')}")
        if c.get("signes_vitaux"):
            lines.append(f"Signes vitaux : {c['signes_vitaux']}")
    return "\n".join(lines)


def _fallback_response(message: str, context: Optional[dict] = None) -> str:
    msg_lower = message.lower()
    if any(w in msg_lower for w in ["paludisme", "malaria", "fièvre", "fievre"]):
        return "Pour le paludisme : confirmez par TDR ou GE. Traitement de première ligne : Artéméther-Luméfantrine (AL) selon le poids. Pour enfants < 5kg : référer. Éviter l'aspirine. ⚠️ L'IA Claude n'est pas connectée - réponse basée sur les protocoles MINSANTÉ."
    if any(w in msg_lower for w in ["urgence", "rouge", "inconscient"]):
        return "🚨 URGENCE DÉTECTÉE - Stabilisez le patient (ABCDE), voie veineuse, monitoring. Appelez le médecin immédiatement. ⚠️ L'IA Claude n'est pas connectée."
    return "ℹ️ L'assistant IA nécessite une connexion internet et une clé API Anthropic configurée. Consultez le médecin responsable. Configurez ANTHROPIC_API_KEY dans le fichier .env pour activer l'IA complète."

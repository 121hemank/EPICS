import asyncio
import gc
import logging
import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

import torch
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from transformers import AutoTokenizer, AutoModelForSequenceClassification

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="EPICS Sentiment API")

# ---------------------------------------------------------------------------
# Rate limiting (slowapi)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:5173")
cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
cors_origin_regex = os.getenv("CORS_ORIGIN_REGEX", "")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex if cors_origin_regex else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Authentication (optional API key)
# ---------------------------------------------------------------------------
API_KEY = os.getenv("API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(api_key: str = Depends(api_key_header)):
    if API_KEY:
        if not api_key or api_key != API_KEY:
            raise HTTPException(status_code=403, detail="Invalid or missing API key")
    return api_key


# ---------------------------------------------------------------------------
# Request ID middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
MODELS_DIR = os.getenv("MODELS_DIR", DEFAULT_MODELS_DIR)

AVAILABLE_MODELS_ENV = os.getenv("AVAILABLE_MODELS", "bertweet,roberta")
AVAILABLE_MODELS = [m.strip() for m in AVAILABLE_MODELS_ENV.split(",") if m.strip()]

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32

logger.info("GPU available: %s", torch.cuda.is_available())
logger.info("Preferred device: %s", DEVICE)

executor = ThreadPoolExecutor(max_workers=2)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class PredictionRequest(BaseModel):
    text: str = Field(max_length=2048, min_length=1)

    @field_validator("text")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


label_maps = {
    "bertweet": ["Negative", "Neutral", "Positive"],
    "roberta": ["Negative", "Neutral", "Positive"],
}

# ---------------------------------------------------------------------------
# Model loading / unloading (thread-safe)
# ---------------------------------------------------------------------------
loaded_models = {}
current_model_name = None
model_lock = threading.Lock()


def get_model_device():
    return DEVICE


def unload_all_models():
    global loaded_models, current_model_name
    with model_lock:
        for _, (_, model, _) in loaded_models.items():
            del model
        loaded_models = {}
        current_model_name = None
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    logger.info("All models unloaded")


def _load_single_model(model_name: str):
    with model_lock:
        if model_name in loaded_models:
            return loaded_models[model_name]

    model_path = os.path.join(MODELS_DIR, model_name)
    target_device = get_model_device()

    logger.info("Loading tokenizer: %s", model_name)
    if model_name == "bertweet":
        tokenizer = AutoTokenizer.from_pretrained(
            model_path, use_fast=False, trust_remote_code=False
        )
    else:
        tokenizer = AutoTokenizer.from_pretrained(
            model_path, trust_remote_code=False
        )

    logger.info("Loading model: %s", model_name)
    model = AutoModelForSequenceClassification.from_pretrained(
        model_path, torch_dtype=DTYPE, trust_remote_code=False
    )

    logger.info("Moving model to device: %s -> %s", model_name, target_device)
    model.to(target_device)
    model.eval()

    with model_lock:
        loaded_models[model_name] = (tokenizer, model, target_device)
        return loaded_models[model_name]


def load_model(model_name: str):
    global current_model_name
    unload_all_models()
    result = _load_single_model(model_name)
    with model_lock:
        current_model_name = model_name
    logger.info("Loaded model: %s", model_name)
    return result


# ---------------------------------------------------------------------------
# Prediction helpers
# ---------------------------------------------------------------------------
def predict_text(model, tokenizer, text: str, model_name: str, model_device):
    max_len = 128 if model_name == "bertweet" else 512
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=max_len,
    )
    inputs = {k: v.to(model_device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
        pred_idx = torch.argmax(probs, dim=1).item()
        confidence = probs[0][pred_idx].item()
    return pred_idx, confidence


async def async_predict_text(model, tokenizer, text: str, model_name: str, model_device):
    loop = asyncio.get_event_loop()
    try:
        pred_idx, confidence = await asyncio.wait_for(
            loop.run_in_executor(
                executor, predict_text, model, tokenizer, text, model_name, model_device
            ),
            timeout=30.0,
        )
        return pred_idx, confidence
    except asyncio.TimeoutError:
        logger.warning("Inference timed out for model: %s", model_name)
        raise HTTPException(
            status_code=504, detail="Inference timed out after 30 seconds"
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
@limiter.exempt
async def health(request: Request):
    return {"status": "ok"}


@app.get("/")
async def home(request: Request):
    return {
        "message": "Backend is running",
        "available_models": AVAILABLE_MODELS,
        "gpu_available": torch.cuda.is_available(),
        "preferred_device": DEVICE.type,
    }


@app.get("/models")
async def get_models(request: Request):
    return {"available_models": AVAILABLE_MODELS}


@app.post("/predict/{model_name}", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def predict_single_model(
    request: Request, model_name: str, prediction_request: PredictionRequest
):
    if model_name not in label_maps:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    try:
        tokenizer, model, model_device = load_model(model_name)
        pred_idx, confidence = await async_predict_text(
            model=model,
            tokenizer=tokenizer,
            text=prediction_request.text,
            model_name=model_name,
            model_device=model_device,
        )
        label = label_maps[model_name][pred_idx]
        return {
            "model": model_name,
            "prediction": label,
            "confidence": round(confidence, 4),
            "device": model_device.type,
        }
    except HTTPException:
        raise
    except Exception as e:
        unload_all_models()
        logger.exception("Failed to run model '%s'", model_name)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/compare", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def compare_models(
    request: Request, prediction_request: PredictionRequest
):
    results = {}
    loaded_model_names = []
    try:
        for model_name in ["bertweet", "roberta"]:
            if model_name not in label_maps:
                raise HTTPException(
                    status_code=404, detail=f"Model '{model_name}' not found"
                )
            tokenizer, model, model_device = _load_single_model(model_name)
            loaded_model_names.append(model_name)
            pred_idx, confidence = await async_predict_text(
                model=model,
                tokenizer=tokenizer,
                text=prediction_request.text,
                model_name=model_name,
                model_device=model_device,
            )
            label = label_maps[model_name][pred_idx]
            results[model_name] = {
                "prediction": label,
                "confidence": round(confidence, 4),
                "device": model_device.type,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Compare failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if loaded_model_names:
            unload_all_models()
    return results


# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------
@app.on_event("shutdown")
def shutdown():
    logger.info("Shutting down, unloading all models")
    unload_all_models()
    executor.shutdown(wait=False)

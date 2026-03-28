from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os
import gc

app = FastAPI(title="EPICS Sentiment API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")

GPU_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CPU_DEVICE = torch.device("cpu")

print("GPU available:", torch.cuda.is_available(), flush=True)
print("Preferred device:", GPU_DEVICE, flush=True)

class PredictionRequest(BaseModel):
    text: str

label_maps = {
    "bertweet": ["Negative", "Neutral", "Positive"],
    "roberta": ["Negative", "Neutral", "Positive"]
}

loaded_models = {}
current_model_name = None

def get_model_device(model_name: str):
    if model_name == "bertweet" and torch.cuda.is_available():
        return GPU_DEVICE
    return CPU_DEVICE

def unload_all_models():
    global loaded_models, current_model_name

    for _, (_, model, _) in loaded_models.items():
        del model

    loaded_models = {}
    current_model_name = None

    gc.collect()

    if torch.cuda.is_available():
        torch.cuda.empty_cache()

def load_model(model_name: str):
    global current_model_name

    if model_name in loaded_models:
        return loaded_models[model_name]

    unload_all_models()
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    model_path = os.path.join(MODELS_DIR, model_name)
    target_device = get_model_device(model_name)

    print(f"Loading tokenizer: {model_name}", flush=True)

    if model_name == "bertweet":
        tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=False)
    else:
        tokenizer = AutoTokenizer.from_pretrained(model_path)

    print(f"Loading model: {model_name}", flush=True)
    model = AutoModelForSequenceClassification.from_pretrained(model_path)

    print(f"Moving model to device: {model_name} -> {target_device}", flush=True)
    model.to(target_device)
    model.eval()

    loaded_models[model_name] = (tokenizer, model, target_device)
    current_model_name = model_name

    print(f"Loaded successfully: {model_name}", flush=True)
    return loaded_models[model_name]

def predict_text(model, tokenizer, text: str, model_name: str, model_device):
    max_len = 128 if model_name == "bertweet" else 512

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=max_len
    )

    inputs = {k: v.to(model_device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
        pred_idx = torch.argmax(probs, dim=1).item()
        confidence = probs[0][pred_idx].item()

    return pred_idx, confidence

@app.get("/")
def home():
    return {
        "message": "Backend is running",
        "available_models": ["bertweet", "roberta"],
        "gpu_available": torch.cuda.is_available(),
        "preferred_device": GPU_DEVICE.type
    }

@app.get("/models")
def get_models():
    return {
        "available_models": ["bertweet", "roberta"]
    }

@app.post("/predict/{model_name}")
def predict_single_model(model_name: str, request: PredictionRequest):
    if model_name not in label_maps:
        return {"error": f"Model '{model_name}' not found"}

    try:
        tokenizer, model, model_device = load_model(model_name)
        pred_idx, confidence = predict_text(
            model=model,
            tokenizer=tokenizer,
            text=request.text,
            model_name=model_name,
            model_device=model_device
        )
        label = label_maps[model_name][pred_idx]

        return {
            "model": model_name,
            "prediction": label,
            "confidence": round(confidence, 4),
            "device": model_device.type
        }

    except Exception as e:
        unload_all_models()
        return {
            "error": f"Failed to run model '{model_name}'",
            "details": str(e)
        }

@app.post("/compare")
def compare_models(request: PredictionRequest):
    results = {}

    for model_name in ["bertweet", "roberta"]:
        try:
            tokenizer, model, model_device = load_model(model_name)
            pred_idx, confidence = predict_text(
                model=model,
                tokenizer=tokenizer,
                text=request.text,
                model_name=model_name,
                model_device=model_device
            )
            label = label_maps[model_name][pred_idx]

            results[model_name] = {
                "prediction": label,
                "confidence": round(confidence, 4),
                "device": model_device.type
            }

        except Exception as e:
            unload_all_models()
            results[model_name] = {
                "error": str(e)
            }

    return results
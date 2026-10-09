from fastapi import FastAPI
from pydantic import BaseModel
from llm_client import chat_with_model

app = FastAPI(title="Local AI Backend")

class ChatRequest(BaseModel):
    message: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/chat")
def chat(request: ChatRequest):
    try:
        reply = chat_with_model(request.message)
        return {"reply": reply}
    except Exception as e:
        return {"error": str(e)}
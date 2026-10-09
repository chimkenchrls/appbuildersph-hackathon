from openai import OpenAI
from config import LLM_BASE_URL, LLM_API_KEY, LLM_MODEL

client = OpenAI(
    base_url=LLM_BASE_URL,
    api_key=LLM_API_KEY,
)

def chat_with_model(user_message: str) -> str:
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a helpful local AI assistant."},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content or ""
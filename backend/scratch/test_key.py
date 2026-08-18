import google.generativeai as genai

genai.configure(api_key="")
try:
    for m in genai.list_models():
        print(m.name)
except Exception as e:
    print("Error:", e)

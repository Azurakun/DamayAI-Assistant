import google.generativeai as genai

<<<<<<< HEAD
genai.configure(api_key="")
=======
genai.configure(api_key="")
>>>>>>> 3bbb5d59ee22489906a69f2e3ab42f15aed4438c
try:
    for m in genai.list_models():
        print(m.name)
except Exception as e:
    print("Error:", e)

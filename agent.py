import os
import requests
import json
import time
import re

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_KEY:
    print("❌ এরর: GEMINI_API_KEY সেট করা নেই!")
    exit(1)

MODELS_TO_TRY = [
    "gemini-3.6-flash",
    "gemini-2.5-flash"
]

SYSTEM_PROMPT = """
You are a ZERO-TOUCH AUTONOMOUS SOFTWARE FACTORY.
Your goal:
1. Discover 1 high-impact real-world software problem.
2. Build a complete, functional, production-ready web application (HTML5, modern CSS, and JavaScript).

Format your output EXACTLY as follows for each file:

[FILE: README.md]
# Project Title
Full markdown documentation with problem and architecture...
[END_FILE]

[FILE: index.html]
<!DOCTYPE html>
<html lang="en">
...
</html>
[END_FILE]

[FILE: style.css]
/* Complete responsive styles */
...
[END_FILE]

[FILE: app.js]
// Complete working JavaScript logic
...
[END_FILE]

Do NOT output anything outside the [FILE: ...] and [END_FILE] blocks.
"""

payload = {
    "contents": [{
        "parts": [{
            "text": "Discover today's top software pain point and build a complete working web app solution with all files."
        }]
    }],
    "systemInstruction": {
        "parts": [{"text": SYSTEM_PROMPT}]
    },
    "generationConfig": {
        "temperature": 0.3
    }
}

headers = {"Content-Type": "application/json"}
success = False

for model_name in MODELS_TO_TRY:
    print(f"🤖 প্রজেক্ট বিল্ড করা হচ্ছে ({model_name})...")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_KEY}"
    
    for attempt in range(1, 4):
        try:
            # টাইমআউট ১৮০ সেকেন্ড রাখা হয়েছে যাতে বড় কোড সহজে ডাউনলোড হয়
            response = requests.post(url, headers=headers, json=payload, timeout=180)
            
            if response.status_code == 200:
                data = response.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                
                # [FILE: path] ... [END_FILE] এক্সট্র্যাক্ট করা
                pattern = r"\[FILE:\s*([^\]]+)\]\s*\n(.*?)\n\[END_FILE\]"
                matches = re.findall(pattern, raw_text, re.DOTALL)
                
                project_dir = os.path.join("builds", "latest_project")
                os.makedirs(project_dir, exist_ok=True)
                
                saved_files = 0
                if matches:
                    for file_path, content in matches:
                        file_path = file_path.strip().strip("'\"")
                        full_path = os.path.join(project_dir, file_path)
                        os.makedirs(os.path.dirname(full_path), exist_ok=True)
                        with open(full_path, "w", encoding="utf-8") as f:
                            f.write(content.strip())
                        print(f"  📄 তৈরি হয়েছে: {file_path}")
                        saved_files += 1
                
                # যদি কোনো ডেলিমিটার মিস হয় তবে ব্যাকআপ হিসেবে র ফাইল সেভ
                if saved_files == 0:
                    with open(os.path.join(project_dir, "FULL_OUTPUT.md"), "w", encoding="utf-8") as f:
                        f.write(raw_text)
                    print("  📄 তৈরি হয়েছে: FULL_OUTPUT.md")
                
                print(f"\n🎉 সম্পূর্ণ সফল! প্রজেক্টের ফাইলগুলো তৈরি হয়েছে।")
                print(f"📁 প্রজেক্ট লোকেশন: {project_dir}\n")
                success = True
                break
                
            elif response.status_code in [503, 429, 500]:
                wait_time = attempt * 5
                print(f"⚠️ সার্ভার ব্যস্ত ({response.status_code})। {wait_time} সেকেন্ড অপেক্ষা...")
                time.sleep(wait_time)
            else:
                print(f"❌ এরর ({response.status_code}): {response.text[:120]}")
                break
                
        except requests.exceptions.Timeout:
            print("⚠️ নেটওয়ার্ক টাইমআউট হয়েছে, পুনরায় চেষ্টা করা হচ্ছে...")
            time.sleep(4)
        except Exception as e:
            print(f"⚠️ সমস্যা: {e}")
            time.sleep(3)
            
    if success:
        break

if not success:
    print("❌ এই মুহূর্তে সম্পন্ন করা যায়নি। অনুগ্রহ করে একটু পর চেষ্টা করুন।")


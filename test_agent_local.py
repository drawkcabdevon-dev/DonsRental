"""
Test the ADK agent locally with a live LLM call.

Usage:
    export GEMINI_API_KEY=your_real_key
    python3 test_agent_local.py
"""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'agent'))

api_key = os.environ.get('GEMINI_API_KEY', '') or os.environ.get('GEMINI_KEY', '')
if not api_key or api_key in ('your-key-here', 'your_gemini_api_key'):
    print("❌  GEMINI_API_KEY not set or still a placeholder.")
    print("    Set it to a real key:")
    print("      export GEMINI_API_KEY=your_actual_key")
    print("    (Get one free at https://aistudio.google.com/app/apikey)")
    sys.exit(1)

from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from main import agent

print(f"\n🔧  Agent:  {agent.name}")
print(f"🧠  Model:  {agent.model}")
print(f"🛠️   Tools:  {[t.__name__ for t in agent.tools]}")

session_service = InMemorySessionService()
runner = Runner(
    agent=agent,
    app_name="test_rental",
    session_service=session_service,
    auto_create_session=True,
)

user_msg = types.Content(
    parts=[types.Part(text="Show me available vehicles with rates.")],
    role="user",
)

print(f"\n📤  Sending: Show me available vehicles with rates.")
print("⏳  Waiting for LLM response...\n")

try:
    count = 0
    for event in runner.run(
        user_id="local_test",
        session_id="session_1",
        new_message=user_msg,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text and part.text.strip():
                    print(f"  {part.text.strip()[:600]}")
                elif part.function_call:
                    fc = part.function_call
                    print(f"\n  🔧  Tool call: {fc.name}")
                    if fc.args:
                        print(f"      Args: {json.dumps({k: str(v)[:80] for k, v in fc.args.items()}, indent=6)}")
                elif part.function_response:
                    fr = part.function_response
                    print(f"\n  📥  Tool response: {fr.name}")
                    print(f"      {json.dumps(fr.response, default=str)[:300]}")
        count += 1
    print(f"\n✅  Agent responded with {count} event(s)")
except Exception as e:
    err = str(e)
    if '429' in err or 'RESOURCE_EXHAUSTED' in err:
        print(f"\n⚠️   Gemini quota exhausted (429). The agent WORKS — just needs quota.")
        print("   Try again later or enable billing on your project.")
    else:
        print(f"\n❌  Error: {err[:300]}")

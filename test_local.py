"""
Local test for Don's Rental ADK agent.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'agent'))

print("=" * 60)
print("1. Loading agent module...")
print("=" * 60)

try:
    from main import get_vehicles, scan_license, create_booking, agent
    print("  ✅  Agent module loaded successfully")
except Exception as e:
    print(f"  ❌  {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("2. get_vehicles() tool")
print("=" * 60)
vehicles = get_vehicles()
print(f"   Returned {len(vehicles)} vehicles:")
for v in vehicles:
    print(f"     {v['icon']} {v['name']} — ${v['rate']}/day")
assert len(vehicles) > 0, "get_vehicles returned empty"
print("  ✅  PASS")

print("\n" + "=" * 60)
print("3. scan_license() — error handling")
print("=" * 60)
result = scan_license("not-valid-base64!!")
print(f"   Result: {result}")
assert 'error' in result, "Should return error for bad input"
print("  ✅  PASS (handles bad input gracefully)")

print("\n" + "=" * 60)
print("4. create_booking() — signature check")
print("=" * 60)
import inspect
sig = inspect.signature(create_booking)
params = list(sig.parameters.keys())
print(f"   Parameters ({len(params)}): {', '.join(params)}")
assert 'vehicle_id' in params
assert 'customer_name' in params
assert 'license_number' in params
print("  ✅  PASS")

print("\n" + "=" * 60)
print("5. Agent definition")
print("=" * 60)
print(f"   Name:  {agent.name}")
print(f"   Model: {agent.model}")
tools = agent.tools if hasattr(agent, 'tools') else []
print(f"   Tools: {len(tools)}")
for t in tools:
    print(f"     - {t.__name__}")
assert len(tools) == 3, "Expected 3 tools"
print("  ✅  PASS")

print("\n" + "=" * 60)
print("ALL TESTS PASSED  ✅")
print("=" * 60)
print()
print("Next: deploy to Agent Engine with:")
print("  cd agent && python deploy.py")

# Run this in your Python shell to diagnose the issue
# python -c "from check_deep_dive import *; check_deep_dive_data()"

from app.config import get_db
import json

def check_deep_dive_data():
    """Check what's actually in the database for deep dive versions"""
    db = get_db()
    
    # Find all versions with is_deep_dive flag
    versions = list(db.versions.find(
        {"analysis_response.is_deep_dive": True}
    ).limit(5))
    
    if not versions:
        print("❌ No deep dive versions found in database")
        return
    
    print(f"✅ Found {len(versions)} deep dive version(s)\n")
    
    for version_doc in versions:
        version_id = version_doc["version_id"]
        version_number = version_doc["version_number"]
        analysis_response = version_doc.get("analysis_response", {})
        
        print(f"{'='*60}")
        print(f"Version: {version_id} (v{version_number})")
        print(f"{'='*60}")
        
        # Check flags
        print(f"\n🔍 FLAGS:")
        print(f"  is_deep_dive (root): {analysis_response.get('is_deep_dive')}")
        
        # Check deep_dive_metrics
        print(f"\n📊 DEEP_DIVE_METRICS:")
        ddm = analysis_response.get("deep_dive_metrics")
        if ddm is None:
            print("  ❌ Missing entirely")
        elif isinstance(ddm, dict):
            if len(ddm) == 0:
                print("  ⚠️  Empty dictionary {}")
            else:
                print(f"  ✅ Present with {len(ddm)} keys:")
                for key in ddm.keys():
                    print(f"     - {key}")
        else:
            print(f"  ⚠️  Wrong type: {type(ddm)}")
        
        # Check visualization_data
        print(f"\n📈 VISUALIZATION_DATA:")
        vd = analysis_response.get("visualization_data")
        if vd is None:
            print("  ❌ Missing entirely")
        elif isinstance(vd, dict):
            if len(vd) == 0:
                print("  ⚠️  Empty dictionary {}")
            else:
                print(f"  ✅ Present with {len(vd)} keys:")
                for key in vd.keys():
                    print(f"     - {key}")
                    if key == "metrics_comparison":
                        mc = vd[key]
                        if isinstance(mc, dict):
                            print(f"       • labels: {mc.get('labels', [])}")
                            print(f"       • old_scores: {mc.get('old_scores', [])}")
                            print(f"       • new_scores: {mc.get('new_scores', [])}")
        else:
            print(f"  ⚠️  Wrong type: {type(vd)}")
        
        # Check what keys ARE present
        print(f"\n🔑 ALL KEYS IN analysis_response:")
        for key in sorted(analysis_response.keys()):
            value = analysis_response[key]
            value_type = type(value).__name__
            if isinstance(value, dict):
                value_summary = f"dict with {len(value)} keys"
            elif isinstance(value, list):
                value_summary = f"list with {len(value)} items"
            elif isinstance(value, str):
                value_summary = f"string ({len(value)} chars)"
            else:
                value_summary = value_type
            print(f"  • {key}: {value_summary}")
        
        print("\n")

if __name__ == "__main__":
    check_deep_dive_data()
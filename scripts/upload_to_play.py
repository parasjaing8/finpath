#!/usr/bin/env python3
"""
Upload FinPath AAB to Google Play Store.
Requires: pip install google-api-python-client google-auth

Usage:
  python3 scripts/upload_to_play.py                          # upload to internal track
  python3 scripts/upload_to_play.py --track internal         # same
  python3 scripts/upload_to_play.py --track production       # production release
  python3 scripts/upload_to_play.py --promote internal production  # promote without upload

Key location: ~/.secrets/finpath-play-key.json (never committed to git)
"""
import os, sys, json, argparse, re
from pathlib import Path

PACKAGE_NAME = "com.aihomecloud.finpath"
KEY_FILE = os.path.expanduser("~/.secrets/finpath-play-key.json")
PROJECT_ROOT = Path(__file__).parent.parent
AAB_PATH = PROJECT_ROOT / "android/app/build/outputs/bundle/release/app-release.aab"
BUILD_GRADLE = PROJECT_ROOT / "android/app/build.gradle"

def get_version_info():
    content = BUILD_GRADLE.read_text()
    code = re.search(r'versionCode\s+(\d+)', content)
    name = re.search(r'versionName\s+"([^"]+)"', content)
    return (int(code.group(1)) if code else 0), (name.group(1) if name else "1.0")

def get_service(key_file):
    import socket
    import httplib2
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    socket.setdefaulttimeout(600)
    creds = service_account.Credentials.from_service_account_file(
        key_file,
        scopes=["https://www.googleapis.com/auth/androidpublisher"]
    )
    http = httplib2.Http(timeout=600)
    return build("androidpublisher", "v3", credentials=creds, cache_discovery=False)

def upload_aab(service, edit_id, aab_path):
    from googleapiclient.http import MediaFileUpload
    import time
    size_mb = Path(aab_path).stat().st_size // 1024 // 1024
    print(f"  Uploading {Path(aab_path).name} ({size_mb}MB) in 10MB chunks...")
    media = MediaFileUpload(
        str(aab_path),
        mimetype="application/octet-stream",
        resumable=True,
        chunksize=10 * 1024 * 1024,  # 10MB chunks
    )
    request = service.edits().bundles().upload(
        packageName=PACKAGE_NAME,
        editId=edit_id,
        media_body=media,
    )
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            pct = int(status.progress() * 100)
            print(f"  ... {pct}%", end="\r", flush=True)
    print(f"  Uploaded: versionCode {response['versionCode']}")
    return response["versionCode"]

def update_track(service, edit_id, track, version_codes, release_notes=None):
    notes = release_notes or [{"language": "en-US", "text": f"Bug fixes and improvements (build {version_codes[0]})"}]
    body = {
        "releases": [{
            "versionCodes": [str(vc) for vc in version_codes],
            "status": "completed" if track == "production" else "completed",
            "releaseNotes": notes,
        }]
    }
    result = service.edits().tracks().update(
        packageName=PACKAGE_NAME,
        editId=edit_id,
        track=track,
        body=body
    ).execute()
    print(f"  Track '{track}' updated with versionCodes {version_codes}")
    return result

def promote(service, from_track, to_track):
    """Promote existing release from one track to another without re-uploading."""
    edit = service.edits().insert(packageName=PACKAGE_NAME, body={}).execute()
    edit_id = edit["id"]
    try:
        track_info = service.edits().tracks().get(
            packageName=PACKAGE_NAME, editId=edit_id, track=from_track
        ).execute()
        releases = track_info.get("releases", [])
        if not releases:
            print(f"No releases found in {from_track} track.")
            service.edits().delete(packageName=PACKAGE_NAME, editId=edit_id).execute()
            return
        version_codes = releases[0].get("versionCodes", [])
        print(f"  Promoting versionCodes {version_codes} from {from_track} → {to_track}")
        update_track(service, edit_id, to_track, [int(v) for v in version_codes])
        service.edits().commit(packageName=PACKAGE_NAME, editId=edit_id).execute()
        print(f"  ✓ Promoted to {to_track}")
    except Exception as e:
        service.edits().delete(packageName=PACKAGE_NAME, editId=edit_id).execute()
        raise e

def main():
    parser = argparse.ArgumentParser(description="Upload FinPath to Google Play Store")
    parser.add_argument("--track", default="internal", choices=["internal", "alpha", "beta", "production"])
    parser.add_argument("--promote", nargs=2, metavar=("FROM", "TO"), help="Promote between tracks")
    parser.add_argument("--notes", help="Release notes text")
    args = parser.parse_args()

    if not Path(KEY_FILE).exists():
        print(f"ERROR: Key file not found at {KEY_FILE}")
        print("Place your service account JSON at ~/.secrets/finpath-play-key.json")
        sys.exit(1)

    version_code, version_name = get_version_info()
    print(f"FinPath {version_name} (versionCode {version_code})")
    print(f"Package: {PACKAGE_NAME}")

    print("Authenticating with Google Play API...")
    service = get_service(KEY_FILE)

    if args.promote:
        from_track, to_track = args.promote
        print(f"Promoting {from_track} → {to_track}...")
        promote(service, from_track, to_track)
        return

    if not AAB_PATH.exists():
        print(f"ERROR: AAB not found at {AAB_PATH}")
        print("Run: cd android && ./gradlew bundleRelease")
        sys.exit(1)

    print(f"Target track: {args.track}")
    print("Creating edit...")
    edit = service.edits().insert(packageName=PACKAGE_NAME, body={}).execute()
    edit_id = edit["id"]
    print(f"  Edit ID: {edit_id}")

    try:
        vc = upload_aab(service, edit_id, AAB_PATH)
        release_notes = None
        if args.notes:
            release_notes = [{"language": "en-US", "text": args.notes}]
        update_track(service, edit_id, args.track, [vc], release_notes)
        result = service.edits().commit(packageName=PACKAGE_NAME, editId=edit_id).execute()
        print(f"\n✓ Successfully uploaded to '{args.track}' track!")
        print(f"  Edit committed: {result.get('id')}")
        print(f"  View in Play Console: https://play.google.com/console/u/0/developers")
    except Exception as e:
        print(f"ERROR: {e}")
        print("Rolling back edit...")
        try:
            service.edits().delete(packageName=PACKAGE_NAME, editId=edit_id).execute()
        except:
            pass
        sys.exit(1)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Replace all phoneScreenshots in the Play Store listing with 5 new images.
Order: Dream → Wealth → Planning → Trust → Mission
"""
import os, sys
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

PACKAGE_NAME = "com.aihomecloud.finpath"
KEY_FILE     = os.path.expanduser("~/.secrets/finpath-play-key.json")
LANGUAGE     = "en-US"
IMAGE_TYPE   = "phoneScreenshots"

# Dream → Wealth → Planning → Trust → Mission
SCREENSHOTS = [
    ("Dream",    "/Users/parasjain/.claude/uploads/e8a7c370-f341-433a-b9b8-62aa2c50946a/1a7efd69-1000659351.png"),
    ("Wealth",   "/Users/parasjain/.claude/uploads/e8a7c370-f341-433a-b9b8-62aa2c50946a/d5154251-1000659666.png"),
    ("Planning", "/Users/parasjain/.claude/uploads/e8a7c370-f341-433a-b9b8-62aa2c50946a/b4bab0ac-1000659669.png"),
    ("Trust",    "/Users/parasjain/.claude/uploads/e8a7c370-f341-433a-b9b8-62aa2c50946a/9e8c508d-1000659671.png"),
    ("Mission",  "/Users/parasjain/.claude/uploads/e8a7c370-f341-433a-b9b8-62aa2c50946a/bd458ad7-1000659670.png"),
]

def main():
    creds = service_account.Credentials.from_service_account_file(
        KEY_FILE, scopes=["https://www.googleapis.com/auth/androidpublisher"]
    )
    service = build("androidpublisher", "v3", credentials=creds, cache_discovery=False)

    print(f"Creating edit for {PACKAGE_NAME}...")
    edit = service.edits().insert(packageName=PACKAGE_NAME, body={}).execute()
    edit_id = edit["id"]
    print(f"  Edit ID: {edit_id}")

    try:
        # Delete all existing phone screenshots first
        print(f"\nClearing existing {IMAGE_TYPE} ({LANGUAGE})...")
        service.edits().images().deleteall(
            packageName=PACKAGE_NAME,
            editId=edit_id,
            language=LANGUAGE,
            imageType=IMAGE_TYPE,
        ).execute()
        print("  Cleared.")

        # Upload each screenshot in order
        print(f"\nUploading {len(SCREENSHOTS)} screenshots...")
        for i, (label, path) in enumerate(SCREENSHOTS, 1):
            size_kb = Path(path).stat().st_size // 1024
            print(f"  [{i}/5] {label} ({size_kb} KB)...", end=" ", flush=True)
            media = MediaFileUpload(path, mimetype="image/png", resumable=False)
            result = service.edits().images().upload(
                packageName=PACKAGE_NAME,
                editId=edit_id,
                language=LANGUAGE,
                imageType=IMAGE_TYPE,
                media_body=media,
            ).execute()
            print(f"✓ id={result['image']['id']}")

        # Commit
        print("\nCommitting edit...")
        committed = service.edits().commit(packageName=PACKAGE_NAME, editId=edit_id).execute()
        print(f"  ✓ Committed: {committed.get('id')}")
        print("\nDone. Screenshots live on Play Store listing.")

    except Exception as e:
        print(f"\nERROR: {e}")
        print("Rolling back edit...")
        try:
            service.edits().delete(packageName=PACKAGE_NAME, editId=edit_id).execute()
        except:
            pass
        sys.exit(1)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Update FinPath Play Store listing (title, short description, full description).
Only updates en-US. Other languages need separate translated updates.

Usage:
  python3 scripts/update_listing.py [--dry-run]
"""
import os, sys, argparse
from pathlib import Path

PACKAGE_NAME = "com.aihomecloud.finpath"
KEY_FILE = os.path.expanduser("~/.secrets/finpath-play-key.json")

TITLE = "FinPath: Financial Freedom"

SHORT_DESCRIPTION = "Will your money last a lifetime? Financial freedom calculator."

FULL_DESCRIPTION = """Most people don't want to retire at 40.
They just want to stop working for money.

There's a difference. Financial freedom means reaching a point where your corpus generates enough passive income that work becomes a choice — not a necessity. You can pick any work, any passion, any pace. Or nothing at all.

FinPath helps you plan that point.

HOW IT WORKS

Tell FinPath what you have and what you need. It does the math.

1. ADD YOUR ASSETS
Split into two types: assets that generate returns (mutual funds, EPF, PPF, NPS, stocks, gold, FDs) and assets that don't (your home). FinPath only counts money that works for you.

2. ADD YOUR EXPENSES
Current expenses like rent and EMIs. Future one-time spends like a car or your child's education. Future recurring costs. FinPath knows which ones your salary covers and which ones your corpus must fund.

3. SET YOUR GOALS
At what age do you want financial freedom? How much monthly income do you need from your corpus? How long should it last — age 85? 90? 100?

4. GET YOUR NUMBER
FinPath calculates the exact monthly SIP you need to start today for your corpus to survive as long as you need it to.

5. SIMULATE
Adjust the SIP, change return assumptions, tweak the step-up rate. See year by year how your corpus grows — and whether it runs out.

BUILT FOR INDIA

Understands EPF, PPF, NPS, SIP step-up, and Indian inflation. Not a US tool with the currency symbol swapped.

COMPLETELY OFFLINE. COMPLETELY PRIVATE.

No account. No cloud. No ads. Your financial data never leaves your phone.

OUR COMMITMENT

51% of FinPath's profits go to underprivileged children in rural India — food, education, and a better start."""


def main():
    parser = argparse.ArgumentParser(description="Update FinPath Play Store listing")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be sent without updating")
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN ===")
        print(f"Title ({len(TITLE)} chars): {TITLE}")
        print(f"Short ({len(SHORT_DESCRIPTION)} chars): {SHORT_DESCRIPTION}")
        print(f"Full ({len(FULL_DESCRIPTION)} chars):\n{FULL_DESCRIPTION[:200]}...")
        return

    if not Path(KEY_FILE).exists():
        print(f"ERROR: Key file not found at {KEY_FILE}")
        sys.exit(1)

    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    print("Authenticating...")
    creds = service_account.Credentials.from_service_account_file(
        KEY_FILE, scopes=["https://www.googleapis.com/auth/androidpublisher"]
    )
    service = build("androidpublisher", "v3", credentials=creds, cache_discovery=False)

    print("Creating edit...")
    edit = service.edits().insert(packageName=PACKAGE_NAME, body={}).execute()
    edit_id = edit["id"]
    print(f"  Edit ID: {edit_id}")

    try:
        print("Updating en-US listing...")
        service.edits().listings().update(
            packageName=PACKAGE_NAME,
            editId=edit_id,
            language="en-US",
            body={
                "language": "en-US",
                "title": TITLE,
                "shortDescription": SHORT_DESCRIPTION,
                "fullDescription": FULL_DESCRIPTION,
            }
        ).execute()

        print("Committing edit...")
        result = service.edits().commit(packageName=PACKAGE_NAME, editId=edit_id).execute()
        print(f"\n✓ Listing updated successfully!")
        print(f"  Short: {SHORT_DESCRIPTION}")
        print(f"  Full: {len(FULL_DESCRIPTION)} chars")
        print(f"  View: https://play.google.com/console")
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

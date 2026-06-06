#!/usr/bin/env python3
"""
Update FinPath Play Store listing across all languages.

en-US + hi-IN  → India-specific description (EPF, PPF, NPS, SIP)
ar, cs-CZ, zh-CN, da-DK, id → Generic international description

Usage:
  python3 scripts/update_listing.py [--dry-run]
"""
import os, sys, argparse
from pathlib import Path

PACKAGE_NAME = "com.aihomecloud.finpath"
KEY_FILE = os.path.expanduser("~/.secrets/finpath-play-key.json")

# ── India description (en-US + hi-IN) ─────────────────────────────────────────

TITLE_EN = "FinPath: Financial Freedom"
SHORT_EN = "Will your money last a lifetime? Financial freedom calculator."
FULL_EN = """\
Most people don't want to retire at 40.
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

51% of FinPath's profits go to underprivileged children in rural India — food, education, and a better start.\
"""

TITLE_HI = "FinPath: वित्तीय स्वतंत्रता"
SHORT_HI = "क्या आपका पैसा जीवनभर चलेगा? वित्तीय स्वतंत्रता कैलकुलेटर।"
FULL_HI = """\
ज़्यादातर लोग 40 की उम्र में रिटायर नहीं होना चाहते।
वे बस पैसों के लिए काम करना बंद करना चाहते हैं।

फ़र्क है इसमें। वित्तीय स्वतंत्रता का मतलब है उस बिंदु तक पहुँचना जहाँ आपका निवेश इतनी आय बनाए कि काम करना एक विकल्प बन जाए — मजबूरी नहीं। आप कोई भी काम चुन सकते हैं — जुनून का, मकसद का, या बिल्कुल भी नहीं।

FinPath आपको वह बिंदु प्लान करने में मदद करता है।

यह कैसे काम करता है

FinPath को बताएं आपके पास क्या है और आपको क्या चाहिए। बाकी गणित यह करेगा।

1. संपत्ति जोड़ें
दो प्रकार: रिटर्न देने वाली संपत्ति (म्यूचुअल फंड, EPF, PPF, NPS, शेयर, सोना, FD) और जो नहीं देती (आपका घर)। FinPath सिर्फ वह पैसा गिनता है जो आपके लिए काम करता है।

2. खर्चे जोड़ें
मौजूदा खर्चे जैसे किराया और EMI। भविष्य के एकमुश्त खर्चे जैसे गाड़ी या बच्चे की पढ़ाई। नियमित भविष्य के खर्चे। FinPath जानता है कि कौन से खर्चे सैलरी से चलेंगे और कौन से कॉर्पस से।

3. लक्ष्य तय करें
किस उम्र में वित्तीय आज़ादी चाहिए? रिटायरमेंट के बाद हर महीने कितनी आय चाहिए? कॉर्पस कितने साल तक चलना चाहिए — 85, 90, या 100 तक?

4. अपना नंबर पाएं
FinPath हिसाब लगाता है कि आज से कितनी SIP शुरू करनी होगी ताकि आपका कॉर्पस ज़रूरत भर चले।

5. सिमुलेशन करें
SIP बदलें, रिटर्न की दर बदलें, स्टेप-अप बदलें। साल दर साल देखें कि आपका कॉर्पस कैसे बढ़ता है — और कहीं खत्म तो नहीं होता।

भारत के लिए बना

EPF, PPF, NPS, SIP स्टेप-अप और भारतीय महंगाई को समझता है। कोई विदेशी टूल नहीं जिसमें बस रुपये का निशान लगा दिया हो।

पूरी तरह ऑफलाइन। पूरी तरह निजी।

कोई अकाउंट नहीं। कोई क्लाउड नहीं। कोई विज्ञापन नहीं। आपका वित्तीय डेटा आपके फोन से बाहर नहीं जाता।

हमारी प्रतिबद्धता

FinPath के मुनाफे का 51% ग्रामीण भारत के वंचित बच्चों को जाता है — खाना, शिक्षा और एक बेहतर शुरुआत।\
"""

# ── International description (all other languages) ───────────────────────────

SHORT_INTL = "Will your money last a lifetime? Financial freedom calculator."
FULL_INTL = """\
Most people don't want to retire at 40.
They just want to stop working for money.

There's a difference. Financial freedom means reaching a point where your corpus generates enough passive income that work becomes a choice — not a necessity. You can pick any work, any passion, any pace. Or nothing at all.

FinPath helps you plan that point.

HOW IT WORKS

Tell FinPath what you have and what you need. It does the math.

1. ADD YOUR ASSETS
Split into two types: assets that generate returns (investments, savings funds, stocks, gold, bonds) and assets that don't (your home). FinPath only counts money that works for you.

2. ADD YOUR EXPENSES
Current expenses like rent and loan payments. Future one-time spends like a car or your child's education. Future recurring costs. FinPath knows which ones your income covers and which ones your corpus must fund.

3. SET YOUR GOALS
At what age do you want financial freedom? How much monthly income do you need from your corpus? How long should it last — age 85? 90? 100?

4. GET YOUR NUMBER
FinPath calculates the exact monthly investment you need to start today for your corpus to survive as long as you need it to.

5. SIMULATE
Adjust the investment amount, change return assumptions, tweak the step-up rate. See year by year how your corpus grows — and whether it runs out.

COMPLETELY OFFLINE. COMPLETELY PRIVATE.

No account. No cloud. No ads. Your financial data never leaves your phone.

OUR COMMITMENT

51% of FinPath's profits go to underprivileged children in rural India — food, education, and a better start.\
"""

# Language → (title, short, full)
LISTINGS = {
    "en-US": (TITLE_EN,  SHORT_EN,   FULL_EN),
    "hi-IN": (TITLE_HI,  SHORT_HI,   FULL_HI),
    "ar":    ("FinPath: التحرر المالي",    SHORT_INTL, FULL_INTL),
    "cs-CZ": ("FinPath: Finanční Svoboda", SHORT_INTL, FULL_INTL),
    "zh-CN": ("FinPath: 财务自由规划",      SHORT_INTL, FULL_INTL),
    "da-DK": ("FinPath: Finansiel Frihed", SHORT_INTL, FULL_INTL),
    "id":    ("FinPath: Kebebasan Finansial", SHORT_INTL, FULL_INTL),
}


def main():
    parser = argparse.ArgumentParser(description="Update FinPath Play Store listings")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--lang", help="Update single language only (e.g. hi-IN)")
    args = parser.parse_args()

    targets = {args.lang: LISTINGS[args.lang]} if args.lang else LISTINGS

    if args.dry_run:
        for lang, (title, short, full) in targets.items():
            print(f"\n[{lang}]")
            print(f"  Title ({len(title)}): {title}")
            print(f"  Short ({len(short)}): {short}")
            print(f"  Full  ({len(full)} chars)")
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
        for lang, (title, short, full) in targets.items():
            print(f"  Updating {lang}...")
            service.edits().listings().update(
                packageName=PACKAGE_NAME,
                editId=edit_id,
                language=lang,
                body={"language": lang, "title": title, "shortDescription": short, "fullDescription": full},
            ).execute()

        print("Committing...")
        service.edits().commit(packageName=PACKAGE_NAME, editId=edit_id).execute()
        print(f"\n✓ Updated {len(targets)} listing(s): {', '.join(targets.keys())}")
    except Exception as e:
        print(f"ERROR: {e}")
        try:
            service.edits().delete(packageName=PACKAGE_NAME, editId=edit_id).execute()
        except:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()

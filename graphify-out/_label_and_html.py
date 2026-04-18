import json
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_html
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text())
detection  = json.loads(Path('graphify-out/.graphify_detect.json').read_text())
analysis   = json.loads(Path('graphify-out/.graphify_analysis.json').read_text())

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

labels = {
    0: "DB Queries Layer",
    1: "AES Encryption Helpers",
    2: "UI Components",
    3: "Core App Context",
    4: "FIRE Calculator Engine",
    5: "Calculator Tests",
    6: "Auth / PIN Storage",
    7: "Currency & CSV Export",
    8: "Error Boundary",
    9: "Android Native Module",
    10: "Login Screen",
    11: "Assets Screen",
    12: "Date Input Component",
    13: "Corpus Primer Dialog",
    14: "Android MainActivity",
    15: "AppProvider & State",
    16: "Onboarding Create Profile",
    17: "Session Lock",
    18: "Goals Screen",
    19: "Profile Screen",
    20: "Expenses Screen",
    21: "Onboarding Edit Profile",
    22: "Schema Migrations",
    23: "Profile Hook",
    24: "Pro IAP Hook",
    25: "SQLite Schema",
    26: "Onboarding Layout",
    27: "Android Security Plugins",
    28: "Keyboard Scroll Compat",
    29: "Insight Card Component",
    30: "Pro Paywall Component",
    31: "Colors Hook",
    32: "Engine Types",
    33: "AES-JS Declaration",
    34: "App Entry Point",
    35: "Root Layout",
    36: "Dashboard Screen",
    37: "Tabs Layout",
    38: "Release Signing Plugin",
    39: "Projection Table Component",
    40: "Test Mocks",
    41: "Tabs Layout Config",
    42: "useColors Hook",
}

questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, '.', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report)
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}))

to_html(G, communities, 'graphify-out/graph.html', community_labels=labels)
print('Report and graph.html updated with community labels')

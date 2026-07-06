"""
Deploy Don's Rental agent to Vertex AI Agent Engine.

Usage:
    python deploy.py                        # interactive (prompts for keys)
    python deploy.py --auto                 # uses env vars (for CI/CD)

Requires:
    - gcloud auth login (or application-default)
    - Vertex AI API enabled on the project
"""

import os
import sys
import subprocess
import json
from getpass import getpass

from vertexai.preview.reasoning_engines import AdkApp
from vertexai import agent_engines
import vertexai

from main import agent

# ── CONFIG ─────────────────────────────────
PROJECT  = os.environ.get('VERTEX_AI_PROJECT', 'renal-car-booking')
LOCATION = os.environ.get('VERTEX_AI_LOCATION', 'us-central1')
DISPLAY_NAME = os.environ.get('AGENT_DISPLAY_NAME', "Don's Rental Agent")

# ── INTERACTIVE SETUP ──────────────────────
def interactive_setup():
    print('\n=== Don\'s Rental — Agent Engine Setup ===\n')

    env = {}

    env['PROJECT'] = input(f'Vertex AI Project ID [{PROJECT}]: ').strip() or PROJECT
    env['LOCATION'] = input(f'Vertex AI Location [{LOCATION}]: ').strip() or LOCATION

    print('\n--- Required Keys ---')
    env['GEMINI_API_KEY'] = getpass('Gemini API Key (https://aistudio.google.com): ').strip()
    env['SENDGRID_API_KEY'] = getpass('SendGrid API Key (https://sendgrid.com): ').strip()
    env['SPREADSHEET_ID'] = input('Google Sheet ID (from sheet URL): ').strip()

    print('\n--- Google Sheets Service Account ---')
    print('Paste the entire service account JSON, then type DONE on a new line:')
    lines = []
    while True:
        line = input()
        if line.strip().upper() == 'DONE':
            break
        lines.append(line)
    env['GOOGLE_SHEETS_CREDENTIALS'] = ''.join(lines)

    print('\n--- Optional ---')
    env['COMPANY_NAME'] = input(f'Company Name [Don\'s Rental]: ').strip() or "Don's Rental"
    env['COMPANY_EMAIL'] = input('Invoice FROM email (verified in SendGrid): ').strip()
    env['COMPANY_PHONE'] = input('Company Phone: ').strip()
    env['OWNER_EMAIL'] = input('Your email (get notified on bookings) [blank=skip]: ').strip()

    return env


# ── DEPLOY ─────────────────────────────────
def deploy(env_vars: dict):
    """Deploy the ADK agent to Vertex AI Agent Engine."""
    print(f'\nDeploying to {env_vars.get("PROJECT", PROJECT)} / {env_vars.get("LOCATION", LOCATION)}...')

    # Set env vars so the agent module picks them up
    for k, v in env_vars.items():
        os.environ[k] = v

    vertexai.init(
        project=env_vars.get('PROJECT', PROJECT),
        location=env_vars.get('LOCATION', LOCATION),
        staging_bucket='gs://renal-car-booking-agent-staging-069495',
    )

    # Build env vars for the deployed agent
    agent_env = {
        'GEMINI_API_KEY': env_vars.get('GEMINI_API_KEY', os.environ.get('GEMINI_API_KEY', '')),
        'SPREADSHEET_ID': env_vars.get('SPREADSHEET_ID', os.environ.get('SPREADSHEET_ID', '')),
        'GOOGLE_SHEETS_CREDENTIALS': env_vars.get('GOOGLE_SHEETS_CREDENTIALS', os.environ.get('GOOGLE_SHEETS_CREDENTIALS', '')),
        'SENDGRID_API_KEY': env_vars.get('SENDGRID_API_KEY', os.environ.get('SENDGRID_API_KEY', '')),
        'COMPANY_NAME': env_vars.get('COMPANY_NAME', os.environ.get('COMPANY_NAME', "Don's Rental")),
        'COMPANY_EMAIL': env_vars.get('COMPANY_EMAIL', os.environ.get('COMPANY_EMAIL', '')),
        'COMPANY_PHONE': env_vars.get('COMPANY_PHONE', os.environ.get('COMPANY_PHONE', '')),
        'OWNER_EMAIL': env_vars.get('OWNER_EMAIL', os.environ.get('OWNER_EMAIL', '')),
    }
    agent_env = {k: v for k, v in agent_env.items() if v}

    app = AdkApp(
        agent=agent,
        env_vars=agent_env,
    )

    print('Uploading to Agent Engine (this takes ~2 minutes)...')
    with open('requirements.txt') as f:
        requirements_list = [l.strip() for l in f if l.strip() and not l.startswith('#')]
    print(f'Requirements: {requirements_list}')

    remote = agent_engines.create(
        agent_engine=app,
        display_name=DISPLAY_NAME,
        requirements=requirements_list,
        extra_packages=['./'],
        env_vars=agent_env,
    )

    print(f'\n{"="*50}')
    print(f'✅  DEPLOYED SUCCESSFULLY!')
    print(f'{"="*50}')
    print(f'Resource Name: {remote.resource_name}')
    print(f'\nTo query the agent:')
    print(f'  from vertexai import agent_engines')
    print(f'  remote = agent_engines.get("{remote.resource_name}")')
    print(f'  remote.query(input="Show me available vehicles")')
    print(f'\nTo wire the frontend backend (Cloud Run):')
    print(f'  export AGENT_ENGINE="{remote.resource_name}"')
    print(f'  ./deploy-cloudrun.sh')
    print(f'{"="*50}\n')


# ── ENTRY ──────────────────────────────────
if __name__ == '__main__':
    auto = '--auto' in sys.argv

    if auto:
        env = {
            'GEMINI_API_KEY': os.environ.get('GEMINI_API_KEY', ''),
            'SENDGRID_API_KEY': os.environ.get('SENDGRID_API_KEY', ''),
            'SPREADSHEET_ID': os.environ.get('SPREADSHEET_ID', ''),
            'GOOGLE_SHEETS_CREDENTIALS': os.environ.get('GOOGLE_SHEETS_CREDENTIALS', ''),
            'COMPANY_NAME': os.environ.get('COMPANY_NAME', "Don's Rental"),
            'COMPANY_EMAIL': os.environ.get('COMPANY_EMAIL', ''),
            'COMPANY_PHONE': os.environ.get('COMPANY_PHONE', ''),
            'OWNER_EMAIL': os.environ.get('OWNER_EMAIL', ''),
            'PROJECT': os.environ.get('VERTEX_AI_PROJECT', PROJECT),
            'LOCATION': os.environ.get('VERTEX_AI_LOCATION', LOCATION),
        }
        missing = [k for k, v in env.items() if not v and k not in ('COMPANY_PHONE', 'OWNER_EMAIL', 'COMPANY_EMAIL', 'GOOGLE_SHEETS_CREDENTIALS', 'SENDGRID_API_KEY')]
        if missing:
            print(f'Missing required env vars: {", ".join(missing)}')
            sys.exit(1)
    else:
        env = interactive_setup()

    deploy(env)

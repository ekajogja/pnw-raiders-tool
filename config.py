import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("PNW_API_KEY")
if not API_KEY:
    raise ValueError("API key not found. Please set PNW_API_KEY in .env file.")

# Maximum number of pages to fetch from the API
MAX_PAGES = 10

# Raid war specific settings (optimized for loot)
MIN_SCORE_RATIO = 0.75  # Can down-declare to 25% of your score for raid wars
MAX_SCORE_RATIO = 1.5  # Can up-declare to 150% of your score for raid wars

# Web app settings
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

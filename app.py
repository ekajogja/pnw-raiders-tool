from flask import Flask, render_template, request, redirect, url_for # Removed jsonify
import os
from datetime import datetime, timedelta # Added for rate limiting
from config import MAX_PAGES # Assuming MAX_PAGES is defined in config.py

# Import refactored functions
# It's good practice to alias them if they have the same name
from raid import get_raid_targets as find_raid_targets
from beige import get_raid_targets as find_beige_targets

app = Flask(__name__)

DEFAULT_TARGET_LIMIT = 10 # Or get from config if defined there

# Rate Limiting Configuration
MAX_REQUESTS_PER_DAY = 10
RATE_LIMIT_WINDOW = timedelta(days=1) # 24 hours
nation_request_logs = {} # Initialize the log

# PROGRESS_TRACKER removed

def check_rate_limit(nation_id):
    current_time = datetime.now()
    if nation_id not in nation_request_logs:
        nation_request_logs[nation_id] = []

    # Filter out old timestamps
    valid_requests = [
        timestamp for timestamp in nation_request_logs[nation_id]
        if current_time - timestamp < RATE_LIMIT_WINDOW
    ]
    nation_request_logs[nation_id] = valid_requests

    if len(valid_requests) >= MAX_REQUESTS_PER_DAY:
        return False # Rate limit exceeded
    return True # Allowed

def record_request(nation_id):
    # This function is called only if the request is allowed by check_rate_limit 
    # and after the main processing (like fetching targets) is done.
    current_time = datetime.now()
    if nation_id not in nation_request_logs: # Should not happen if check_rate_limit was called first
        nation_request_logs[nation_id] = []
    nation_request_logs[nation_id].append(current_time)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/raid', methods=['POST'])
def raid_results():
    nation_id_str = request.form.get('nation_id')
    if not nation_id_str:
        app.logger.warning("Nation ID not provided in form.")
        return render_template('results.html',
                               error_message="Nation ID is required. Please enter a Nation ID.",
                               search_title="Input Error",
                               targets=None), 400
    
    try:
        nation_id = int(nation_id_str)
    except ValueError:
        app.logger.warning(f"Invalid Nation ID format received: {nation_id_str}")
        return render_template('results.html',
                               error_message="Invalid Nation ID format. Please enter a number.",
                               search_title="Invalid Input",
                               targets=None), 400

    api_key = os.environ.get("PNW_API_KEY")
    if not api_key:
        app.logger.error("PNW_API_KEY not configured on server.")
        return render_template('results.html',
                               error_message="Critical error: API key not configured on the server. Please contact the administrator.",
                               search_title="Server Configuration Error",
                               targets=None), 500

    if not check_rate_limit(nation_id): # nation_id is now guaranteed to be an int
        app.logger.warning(f"Rate limit exceeded for Nation ID {nation_id}")
        return render_template('results.html', 
                               error_message=f"Rate limit exceeded for Nation ID {nation_id}. Only {MAX_REQUESTS_PER_DAY} requests allowed per 24 hours.",
                               search_title=f"Rate Limit Exceeded for Nation ID {nation_id}",
                               targets=None), 429 # 429 Too Many Requests
    
    # PROGRESS_TRACKER related lines removed
    try:
        # Call the refactored function from raid.py
        _, targets = find_raid_targets(api_key, nation_id, limit=DEFAULT_TARGET_LIMIT, max_pages=MAX_PAGES) # Removed progress_tracker and request_id
        record_request(nation_id) # Record the request *after* successful processing
        # PROGRESS_TRACKER update removed
        return render_template('results.html', targets=targets, search_title=f"Raid Targets for Nation ID {nation_id}")
    except ValueError as e:
        app.logger.error(f"ValueError in /raid for Nation ID {nation_id}: {e}")
        # PROGRESS_TRACKER update removed
        return render_template('results.html',
                               error_message=str(e), # Pass the error message from the exception
                               search_title=f"Error for Nation ID {nation_id}",
                               targets=None), 400 # Or another appropriate status code like 404 if "not found"
    except Exception as e:
        app.logger.error(f"Unexpected error in /raid for Nation ID {nation_id_str if 'nation_id_str' in locals() else 'unknown'}: {e}", exc_info=True)
        # PROGRESS_TRACKER update removed
        return render_template('results.html',
                               error_message="An unexpected server error occurred. Please try again later or contact support.",
                               search_title="Unexpected Server Error",
                               targets=None), 500


@app.route('/beige', methods=['POST'])
def beige_results():
    nation_id_str = request.form.get('nation_id')
    if not nation_id_str:
        app.logger.warning("Nation ID not provided in form.")
        return render_template('results.html',
                               error_message="Nation ID is required. Please enter a Nation ID.",
                               search_title="Input Error",
                               targets=None), 400
    
    try:
        nation_id = int(nation_id_str)
    except ValueError:
        app.logger.warning(f"Invalid Nation ID format received: {nation_id_str}")
        return render_template('results.html',
                               error_message="Invalid Nation ID format. Please enter a number.",
                               search_title="Invalid Input",
                               targets=None), 400

    api_key = os.environ.get("PNW_API_KEY")
    if not api_key:
        app.logger.error("PNW_API_KEY not configured on server.")
        return render_template('results.html',
                               error_message="Critical error: API key not configured on the server. Please contact the administrator.",
                               search_title="Server Configuration Error",
                               targets=None), 500
    
    if not check_rate_limit(nation_id): # nation_id is now guaranteed to be an int
        app.logger.warning(f"Rate limit exceeded for Nation ID {nation_id}")
        return render_template('results.html', 
                               error_message=f"Rate limit exceeded for Nation ID {nation_id}. Only {MAX_REQUESTS_PER_DAY} requests allowed per 24 hours.",
                               search_title=f"Rate Limit Exceeded for Nation ID {nation_id}",
                               targets=None), 429 # 429 Too Many Requests
    
    # PROGRESS_TRACKER related lines removed
    try:
        # Call the refactored function from beige.py
        _, targets = find_beige_targets(api_key, nation_id, limit=DEFAULT_TARGET_LIMIT, max_pages=MAX_PAGES) # Removed progress_tracker and request_id
        record_request(nation_id) # Record the request *after* successful processing
        # PROGRESS_TRACKER update removed
        return render_template('results.html', targets=targets, search_title=f"Beige Targets for Nation ID {nation_id}")
    except ValueError as e:
        app.logger.error(f"ValueError in /beige for Nation ID {nation_id}: {e}")
        # PROGRESS_TRACKER update removed
        return render_template('results.html',
                               error_message=str(e),
                               search_title=f"Error for Nation ID {nation_id}",
                               targets=None), 400 # Or another appropriate status code
    except Exception as e:
        app.logger.error(f"Unexpected error in /beige for Nation ID {nation_id_str if 'nation_id_str' in locals() else 'unknown'}: {e}", exc_info=True)
        # PROGRESS_TRACKER update removed
        return render_template('results.html',
                               error_message="An unexpected server error occurred. Please try again later or contact support.",
                               search_title="Unexpected Server Error",
                               targets=None), 500

# Removed /progress/<request_id> route

if __name__ == '__main__':
    # Make sure to load .env variables if you are using python-dotenv and running directly
    # from dotenv import load_dotenv
    # load_dotenv()
    app.run(debug=True, port=8080)

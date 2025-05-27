from pnw_api import get_nations, has_treaty, run_query, get_nation_by_id
from tqdm import tqdm
import traceback
import argparse
import os
import time
from datetime import datetime
from config import MAX_PAGES, MIN_SCORE_RATIO, MAX_SCORE_RATIO

def get_last_updated():
    try:
        import subprocess
        result = subprocess.run(['git', 'log', '-1', '--format=%cd', '--date=short'],
                              capture_output=True, text=True)
        return result.stdout.strip()
    except Exception:
        return datetime.now().strftime("%Y-%m-%d")  # Fallback to current date

def parse_args():
    parser = argparse.ArgumentParser(description='PnW Raid Recon - Find optimal raiding targets')
    parser.add_argument('--json', action='store_true', help='Output results in JSON format')
    parser.add_argument('--limit', type=int, default=10, help='Limit number of results (default: 10)')
    parser.add_argument('--max-pages', type=int, default=MAX_PAGES,
                      help=f'Maximum number of pages to fetch (default: {MAX_PAGES}, use smaller number for testing)')
    parser.add_argument('--nationid', type=int, help='Specify the Nation ID to use for the script', required=True)
    return parser.parse_args()

def format_param_info(name, value, description=None):
    if description:
        return f"  {name}: {value} - {description}"
    return f"  {name}: {value}"

def format_money(amount):
    if amount >= 1000000000:
        return f"${amount/1000000000:.1f}B"
    if amount >= 1000000:
        return f"${amount/1000000:.1f}M"
    return f"${amount:,.0f}"

def format_hours(hours):
    if hours is None:
        return "no previous wars"
    return f"{int(hours)}h" if hours < 48 else f"{int(hours/24)}d {int(hours%24)}h"

def format_loot(loot, loot_value=None):
    if not loot:
        return "No loss data"
    if loot["money"] > 0:
        return f"Lost ${loot['money']:,.0f}"
    return "No losses"

def get_raid_targets(api_key: str, nation_id: int, limit: int, max_pages: int): # Removed progress_tracker and request_id
    # Get my nation's info first
    try:
        # We now directly use the nation_id passed to the function
        my_nation = get_nation_by_id(api_key, nation_id)
        # CLI-specific print: print(f"Fetching data for Nation ID: {nation_id}")
    except ValueError as e:
        # CLI-specific print: print(f"Error: Could not fetch data for Nation ID {nation_id}. {e}")
        raise  # Re-raise for the caller to handle

    # The "Current Parameters" and "Target" info will be printed by the CLI caller (main function)
    # This function will now focus on fetching and filtering data.
    # min_score and max_score are calculated here as they are used in filtering logic below.
    min_score = my_nation['score'] * MIN_SCORE_RATIO
    max_score = my_nation['score'] * MAX_SCORE_RATIO

    page = 1
    all_nations = []
    filtered = []

    pbar = tqdm(desc="Fetching nations", unit="page", total=max_pages)

    while True:
        try:
            # CLI-specific print: tqdm progress bar handles page fetching status for CLI.
            # If not using tqdm, a print like: print(f"Fetching page {page}...") might be used for CLI.
            nations_data = get_nations(api_key, page)

            if not nations_data["data"]:  # No more nations to fetch
                break

            # Process nations and filter in a single pass
            current_page_nations = nations_data["data"]
            pbar.update(1)
            # Removed progress_tracker update block
            
            for nation in current_page_nations:
                # Skip processing if we already have enough targets
                if len(filtered) >= limit: # Use limit parameter
                    break

                # Implement the new filtering logic
                include_nation = True # Assume nation is included unless filtered out

                # 1. Initial State Filter (War Range, Vacation, Beige, Inactive)
                nation_score = nation.get('score', 0)
                min_score = my_nation['score'] * MIN_SCORE_RATIO
                max_score = my_nation['score'] * MAX_SCORE_RATIO

                if not (min_score <= nation_score <= max_score):
                    include_nation = False

                if include_nation and nation.get('vacation_mode_turns', 0) > 0:
                    include_nation = False
                    
                if include_nation and nation.get('color', '').lower() == 'beige':
                    include_nation = False

                # 2. Always respect treaties
                if include_nation:
                    if (nation.get('alliance_id') is not None and
                        my_nation.get('alliance') is not None and
                        nation.get('alliance') is not None and # Ensure target nation has alliance data
                        has_treaty(my_nation['alliance'], nation['alliance'])):
                        include_nation = False

                # 3. Filter out nations with stronger military (ships, missiles, nukes)
                if include_nation:
                    if (nation.get('ships', 0) > my_nation.get('ships', 0) or
                        nation.get('missiles', 0) > my_nation.get('missiles', 0) or
                        nation.get('nukes', 0) > my_nation.get('nukes', 0) or
                        nation.get('spies', 0) > my_nation.get('spies', 0)):
                        include_nation = False

                # Calculate 7-day stolen money
                seven_days_stolen = 0
                # Calculate 1-day stolen money
                one_day_stolen = 0
                if include_nation and nation.get('wars') and isinstance(nation['wars'], list):
                    for war in nation['wars']:
                        if war.get('def_id') == nation['id']:  # Only defensive wars
                            war_date = datetime.strptime(war['date'], '%Y-%m-%dT%H:%M:%S%z')
                            now_aware = datetime.now(war_date.tzinfo) # Make now timezone-aware
                            
                            # 7-day calculation
                            if (now_aware - war_date).days <= 7:
                                if war.get('attacks'):
                                    for attack in war['attacks']:
                                        if attack.get('def_id') == nation['id']:
                                            seven_days_stolen += attack.get('money_stolen', 0)
                            
                            # 1-day calculation
                            if (now_aware - war_date).days <= 1:
                                if war.get('attacks'):
                                    for attack in war['attacks']:
                                        if attack.get('def_id') == nation['id']:
                                            one_day_stolen += attack.get('money_stolen', 0)

                # Skip nations with zero 7-day stolen money (main filter criteria)
                if seven_days_stolen == 0:
                    continue

                # Use defensive_wars_count from API response
                defensive_war_count = nation.get('defensive_wars_count', 0)
                
                if defensive_war_count >= 3:
                    continue

                # Calculate stolen money from defensive wars
                total_money_stolen_recent_def_war = 0
                most_recent_def_war_date_obj = None # Store as datetime object first
                most_recent_def_war_date_str = 'N/A'
                last_stolen_time_ago_str = "N/A"

                if nation.get('wars') and isinstance(nation['wars'], list):
                    defensive_wars = [w for w in nation['wars'] if w.get('def_id') == nation['id']]
                    if defensive_wars:
                        most_recent_def_war = sorted(defensive_wars, 
                                                   key=lambda x: datetime.strptime(x['date'], '%Y-%m-%dT%H:%M:%S%z'),
                                                   reverse=True)[0]
                        most_recent_def_war_date_obj = datetime.strptime(most_recent_def_war['date'], '%Y-%m-%dT%H:%M:%S%z')
                        most_recent_def_war_date_str = most_recent_def_war_date_obj.strftime('%Y-%m-%d %H:%M:%S%z')
                        
                        if most_recent_def_war.get('attacks'):
                            for attack in most_recent_def_war['attacks']:
                                if attack.get('def_id') == nation['id']:
                                    total_money_stolen_recent_def_war += attack.get('money_stolen', 0)
                        
                        # Calculate time ago string
                        if most_recent_def_war_date_obj:
                            try:
                                hours_ago = int((datetime.now(most_recent_def_war_date_obj.tzinfo) - most_recent_def_war_date_obj).total_seconds() / 3600)
                                days = hours_ago // 24
                                hours = hours_ago % 24
                                if days > 0:
                                    last_stolen_time_ago_str = f"{days}d {hours}h ago"
                                else:
                                    last_stolen_time_ago_str = f"{hours_ago}h ago"
                            except Exception:
                                last_stolen_time_ago_str = "timestamp unavailable"
                
                # Calculate commerce buildings totals
                supermarket = 0
                bank = 0
                shopping_mall = 0
                stadium = 0
                subway = 0
                if nation.get('cities'):
                    for city in nation['cities']:
                        supermarket += city.get('supermarket', 0)
                        bank += city.get('bank', 0)
                        shopping_mall += city.get('shopping_mall', 0)
                        stadium += city.get('stadium', 0)
                        subway += city.get('subway', 0)

                # Add relevant data to the filtered nation dictionary
                filtered_nation_data = {
                    'id': nation.get('id'),
                    'name': nation.get('nation_name'),
                    'score': nation.get('score'),
                    'alliance': nation.get('alliance').get('name', 'No Alliance') if nation.get('alliance') else 'No Alliance',
                    'money_stolen_recent_def_war': total_money_stolen_recent_def_war,
                    'seven_days_stolen': seven_days_stolen,
                    'one_day_stolen': one_day_stolen, # Added
                    'most_recent_def_war_date': most_recent_def_war_date_str, # Use the string version
                    'last_stolen_time_ago_str': last_stolen_time_ago_str, # Added
                    'gni': nation.get('gross_national_income', 0),
                    'daily_income': nation.get('gross_national_income', 0) / 365.0 if nation.get('gross_national_income') else 0,
                    'raw_gni': nation.get('gross_national_income'),  # For debugging
                    'nation_url': f"https://politicsandwar.com/nation/id={nation.get('id')}", # Added
                    'city_count': nation.get('city_count', '?'),
                    'soldiers': nation.get('soldiers', 0),
                    'tanks': nation.get('tanks', 0),
                    'aircraft': nation.get('aircraft', 0),
                    'ships': nation.get('ships', 0),
                    'missiles': nation.get('missiles', 0),
                    'nukes': nation.get('nukes', 0),
                    'spies': nation.get('spies', 0),
                    'supermarket': supermarket,
                    'bank': bank,
                    'shopping_mall': shopping_mall,
                    'stadium': stadium,
                    'subway': subway,
                    'defensive_wars_count': defensive_war_count # Added
                }
                filtered.append(filtered_nation_data)

            # Early exit if we have enough targets
            if len(filtered) >= limit: # Use limit parameter
                # CLI-specific print: print(f"\nFound {len(filtered)} targets, stopping search")
                break

            # Check pagination
            paginator = nations_data.get("paginatorInfo", {})
            if not paginator.get("hasMorePages") or page >= max_pages: # Use max_pages parameter
                # CLI-specific print: print(f"\nReached page limit ({page}/{max_pages})")
                break

            page += 1
        except Exception as e:
            print(f"\n❌ Error fetching page {page}: {str(e)}")
            traceback.print_exc()

            # If we already have some nations, just use what we have
            if all_nations:
                print(f"\n✅ Using {len(all_nations)} nations already fetched before error")
                break
            else:
                # No nations fetched yet, try one more time with a delay
                try:
                    print("Retrying with a 5-second delay...")
                    time.sleep(5)
                    nations_data = get_nations(api_key, page)
                    all_nations.extend(nations_data["data"])
                    pbar.update(1)
                    page += 1
                except Exception as retry_e:
                    print(f"\n❌ Retry also failed: {str(retry_e)}")
                    # Terminate with an error if we can't fetch any data
                    if not all_nations:
                        raise ValueError("Could not fetch any nation data from API after retries")
                    break

    try:
        return my_nation, filtered
    finally:
        pbar.close()
        # CLI-specific print: print(f"\nProcessed {len(all_nations)} total nations")

def main():
    try:
        args = parse_args()
        print("[⚔️] Samurai Raid Scanner - Finding optimal targets...\n")

        # For CLI usage, the API key still needs to come from the environment
        # This part of the code is for the CLI, not the web interface
        api_key = os.getenv("PNW_API_KEY")
        if not api_key:
             raise ValueError("PNW_API_KEY environment variable is not set for CLI usage.")

        # Call the refactored function with parameters from args
        my_nation, filtered = get_raid_targets(api_key, args.nationid, args.limit, args.max_pages)
        
        # CLI-specific output based on the returned my_nation
        print("Current Parameters:")
        print("  My Nation:")
        print(f"    {my_nation.get('nation_name', 'Unknown')} | {my_nation.get('alliance', {}).get('name', 'No Alliance')}")
        print(f"    Score: {float(my_nation['score']):,.2f}")
        print(f"    Military: sol {my_nation.get('soldiers', 0):,} tank {my_nation.get('tanks', 0):,} air {my_nation.get('aircraft', 0):,} ship {my_nation.get('ships', 0):,} miss {my_nation.get('missiles', 0):,} nuke {my_nation.get('nukes', 0):,} spy {my_nation.get('spies', 0):,}")
        
        print("  Target:")
        # Calculate min_score and max_score again for CLI display based on the returned my_nation
        min_score_cli = my_nation['score'] * MIN_SCORE_RATIO
        max_score_cli = my_nation['score'] * MAX_SCORE_RATIO
        print(f"    War Range: {min_score_cli:,.2f} - {max_score_cli:,.2f}")
        
        if my_nation.get('alliance') and my_nation['alliance'].get('treaties'):
            treaty_alliances = set()
            alliance_names = []
            for treaty in my_nation['alliance']['treaties']:
                if treaty['alliance1_id'] != my_nation['alliance']['id']:
                    treaty_alliances.add(treaty['alliance1_id'])
                else:
                    treaty_alliances.add(treaty['alliance2_id'])
            
            # This loop to fetch alliance names is duplicated from get_raid_targets.
            # For CLI, this is acceptable. A deeper refactor could avoid this.
            for alliance_id_cli in treaty_alliances:
                query = f"""
                {{
                  alliances(id: {alliance_id_cli}) {{
                    data {{
                      name
                    }}
                  }}
                }}
                """
                try:
                    data = run_query(api_key, query) # api_key needs to be available here
                    if data.get('data', {}).get('alliances', {}).get('data'):
                        alliance_names.append(data['data']['alliances']['data'][0]['name'])
                except Exception as e:
                    # CLI-specific print: print(f"Error fetching alliance name for ID {alliance_id_cli}: {str(e)}")
                    alliance_names.append(f"UnknownAlliance({alliance_id_cli})") # Keep this for context
            
            print(f"    DNR: {', '.join(alliance_names)}")
        
        print(f"    Military: ship < {my_nation.get('ships', 0)} miss < {my_nation.get('missiles', 0)} nuke < {my_nation.get('nukes', 0)} spy < {my_nation.get('spies', 0)}")
        print("")

        # Sort targets by defensive war count (ascending) then by 7-day stolen money (descending)
        filtered.sort(key=lambda x: (x.get('defensive_wars_count', 0), -x['seven_days_stolen']))

        if args.json:
            import json
            print(json.dumps(filtered, indent=2))
            return

        # Print summary first
        print("\n📊 Summary:")
        print(f"  Found {len(filtered)} potential raid targets with stolen money")

        # Print detailed target information
        print(f"\n🎯 Top {len(filtered)} Raid Targets (by stolen money last 7 days):")
        for i, t in enumerate(filtered, 1):
            nation_url = f"https://politicsandwar.com/nation/id={t['id']}"
            print(f"{i}. {t['name']} | {t['alliance']}")
            print(f"  Score: {t['score']:,.2f} | Daily income: ${t.get('daily_income', 0):,.2f}")
            print(f"  Money stolen: last 7d: {format_money(t['seven_days_stolen'])} | last 1d: {format_money(t.get('one_day_stolen', 0))}") # Uses one_day_stolen
            print(f"  Defensive wars: {t.get('defensive_wars_count', 0)}")

            # Print last stolen info if available
            money_stolen_amount = format_money(t.get('money_stolen_recent_def_war', 0))
            # Use the pre-calculated last_stolen_time_ago_str
            if t.get('money_stolen_recent_def_war', 0) > 0 and t.get('last_stolen_time_ago_str') != 'N/A':
                 print(f"  Last stolen: {money_stolen_amount} - {t['last_stolen_time_ago_str']}")
            elif t.get('money_stolen_recent_def_war', 0) > 0 : # If money was stolen but time string is N/A (e.g. error)
                 print(f"  Last stolen: {money_stolen_amount} - timestamp unavailable")


            # Print military and commerce info
            print(f"  Military: sold {t.get('soldiers', 0):,} tank {t.get('tanks', 0):,} air {t.get('aircraft', 0):,} ship {t.get('ships', 0):,} miss {t.get('missiles', 0):,} nuke {t.get('nukes', 0):,} spy {t.get('spies', 0):,}")
            print(f"  Commerce: mrkt {t.get('supermarket', 0)} bank {t.get('bank', 0)} mall {t.get('shopping_mall', 0)} stad {t.get('stadium', 0)} subw {t.get('subway', 0)}")
            print(f"  URL: {t.get('nation_url', 'N/A')}") # Uses nation_url
            print()

        # Print usage tips
        print("\nRaid Options:")
        print("  --json               Output results in JSON format")
        print("  --limit N            Limit number of results (current: {})".format(args.limit))
        print("  --max-pages N        Maximum number of pages to fetch (current: {})".format(args.max_pages))

        # Print footer
        print("\n" + "=" * 80)
        print(f"Samurai Raid Scanner - last updated {get_last_updated()}")
        print("built with ❤️ by the weakest of the Samurai: Bako Gayo")
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        traceback.print_exc()

if __name__ == "__main__":
    main()

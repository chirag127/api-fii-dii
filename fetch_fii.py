import requests
import pandas as pd
import matplotlib.pyplot as plt
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
import time

# Constants
NSE_URL = "https://www.nseindia.com/api/fiidiiTradeReact"
MONEYCONTROL_URL = "https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php"
JSON_FILE = "fii_history.json"
IMAGE_FILE = "money_flow.png"

# Headers to mimic a browser
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

def fetch_nse_data():
    """Fetches FII/DII data from NSE API."""
    try:
        session = requests.Session()
        # First request to get cookies
        session.get("https://www.nseindia.com", headers=HEADERS, timeout=10)

        # Now fetch the actual API
        response = session.get(NSE_URL, headers=HEADERS, timeout=10)

        if response.status_code == 200:
            data = response.json()
            # Process NSE data
            fii_data = next((item for item in data if item["category"] == "FII/FPI"), None)
            dii_data = next((item for item in data if item["category"] == "DII"), None)

            if fii_data and dii_data:
                return {
                    "date": fii_data["date"],
                    "fii_net_crores": float(fii_data["netValue"]),
                    "dii_net_crores": float(dii_data["netValue"])
                }
    except Exception as e:
        print(f"NSE fetch failed: {e}")
    return None

def fetch_moneycontrol_data():
    """Fallback: Scrapes FII/DII data from Moneycontrol."""
    try:
        response = requests.get(MONEYCONTROL_URL, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, "lxml")

            # Look for the header and then the table
            header = soup.find(string=lambda t: t and "FII & DII TRADING ACTIVITY" in t)
            if header:
                container = header.find_parent("div")
                # Sometimes the header is within a few levels of nesting
                # Try finding the table in the proximity
                table = container.find_next("table")

                if table:
                    # Iterate rows to find the daily data
                    rows = table.find_all("tr")
                    for row in rows:
                        cols = row.find_all("td")
                        col_text = [col.get_text(strip=True) for col in cols]

                        # Expected structure: [Date, FII Buy, FII Sell, FII Net, DII Buy, DII Sell, DII Net]
                        # We need to make sure we are looking at a row with date and data, not header or summary
                        if len(col_text) >= 7:
                            date_str = col_text[0]

                            # Simple validation: checks if date looks real (has hyphens or spaces)
                            # and if the net values are numbers
                            try:
                                # Clean up values (remove commas)
                                fii_net_str = col_text[3].replace(",", "")
                                dii_net_str = col_text[6].replace(",", "")

                                # Verify they are numbers
                                fii_net = float(fii_net_str)
                                dii_net = float(dii_net_str)

                                # If we parsed successfully, this is likely our row
                                # Moneycontrol usually puts the latest date first or second (after headers)

                                # Normalize date to NSE format if needed or keep as is
                                # Moneycontrol: "16-Feb-2026" usually

                                print(f"Moneycontrol Scrape Success: {date_str}, FII: {fii_net}, DII: {dii_net}")
                                return {
                                    "date": date_str,
                                    "fii_net_crores": fii_net,
                                    "dii_net_crores": dii_net
                                }
                            except ValueError:
                                # Not a data row (e.g., header with text)
                                continue

            print("Moneycontrol scraping: Could not find valid data row.")
            return None

    except Exception as e:
        print(f"Moneycontrol fetch failed: {e}")
    return None

def update_json(new_data):
    """Updates the JSON file with new data."""
    if not new_data:
        return

    history = []
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, "r") as f:
            try:
                history = json.load(f)
            except json.JSONDecodeError:
                history = []

    # Check if date already exists
    if not any(entry["date"] == new_data["date"] for entry in history):
        history.append(new_data)
        with open(JSON_FILE, "w") as f:
            json.dump(history, f, indent=4)
        print(f"Added data for {new_data['date']}")
    else:
        print(f"Data for {new_data['date']} already exists.")

    return history

def generate_chart(history):
    """Generates a bar chart from the history data."""
    if not history:
        return

    df = pd.DataFrame(history)

    # Sort by date just in case (assuming date format allows sorting or convert to datetime)
    try:
         df['date_obj'] = pd.to_datetime(df['date'], format='%d-%b-%Y')
    except:
         # NSE date format is usually '16-Feb-2026'
         pass

    df = df.sort_values(by='date_obj' if 'date_obj' in df.columns else 'date')

    # Take last 30 days
    last_30 = df.tail(30)

    plt.figure(figsize=(12, 6))

    # Plotting
    x = range(len(last_30))
    width = 0.35

    # FII Bars
    fii_colors = ['green' if x > 0 else 'red' for x in last_30['fii_net_crores']]
    plt.bar([i - width/2 for i in x], last_30['fii_net_crores'], width, label='FII Net', color=fii_colors, alpha=0.7)

    # DII Bars
    dii_colors = ['green' if x > 0 else 'red' for x in last_30['dii_net_crores']]
    plt.bar([i + width/2 for i in x], last_30['dii_net_crores'], width, label='DII Net', color=dii_colors, alpha=0.7, hatch='//')

    plt.xlabel('Date')
    plt.ylabel('Net Investment (Crores)')
    plt.title('FII & DII Net Investment (Last 30 Days)')
    plt.xticks(x, last_30['date'], rotation=45, ha='right')
    plt.legend()
    plt.grid(axis='y', linestyle='--', alpha=0.5)
    plt.tight_layout()

    plt.savefig(IMAGE_FILE)
    print(f"Chart saved to {IMAGE_FILE}")

def main():
    print("Fetching data...")
    data = fetch_nse_data()

    if not data:
        print("NSE failed. Trying Moneycontrol...")
        data = fetch_moneycontrol_data()

    if data:
        print(f"Fetched Data: {data}")
        history = update_json(data)
        generate_chart(history)
    else:
        print("Failed to fetch data from both sources.")

if __name__ == "__main__":
    main()

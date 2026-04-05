import os
import time
import subprocess
from supabase import create_client, Client
from dotenv import load_dotenv

# Load credentials
load_dotenv()

URL = os.getenv("SUPABASE_URL")
KEY = os.getenv("SUPABASE_KEY")

if not URL or not KEY:
    print("❌ Error: SUPABASE_URL or SUPABASE_KEY missing in .env")
    exit(1)

supabase: Client = create_client(URL, KEY)

def trigger_phone_call(number):
    print(f"📞 Attempting to dial {number} via USB cable...")
    try:
        # This command tells the connected Android phone to dial the number
        cmd = ["adb", "shell", "am", "start", "-a", "android.intent.action.CALL", "-d", f"tel:{number}"]
        subprocess.run(cmd, check=True)
        print(f"✅ Dial command sent for {number}")
    except Exception as e:
        print(f"❌ Failed to dial: {str(e)}")
        print("💡 Make sure your phone is connected via USB and 'USB Debugging' is ON.")

def monitor_calls():
    print("📡 Local Call Bridge Active. Listening for cloud triggers...")
    
    # We poll the 'Call' table for any 'initiating' status
    while True:
        try:
            response = supabase.table("Call").select("*").eq("status", "initiating").execute()
            calls = response.data

            for call in calls:
                target_number = call.get("to")
                call_id = call.get("id")
                
                if target_number:
                    trigger_phone_call(target_number)
                    
                    # Update status to 'completed' so we don't dial again
                    supabase.table("Call").update({
                        "status": "connected", 
                        "duration": "Live"
                    }).eq("id", call_id).execute()
                    
            time.sleep(2) # Check every 2 seconds
        except Exception as e:
            print(f"⚠️ Error polling: {e}")
            time.sleep(5)

if __name__ == "__main__":
    monitor_calls()

import time
import os
from playwright.sync_api import sync_playwright

output_dir = "C:/Users/Raiyan/.gemini/antigravity-ide/brain/aaa517a9-000f-4327-b8cc-3ef28e551ce7/audit"
os.makedirs(output_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 850})

    # Student Flow
    print("Logging in as student...")
    page.goto("http://localhost:5173/login")
    page.fill("input[type='email']", "student001@college.edu")
    page.fill("input[type='password']", "Demo@1234")
    page.click("button[type='submit']")
    page.wait_for_url("**/student**", timeout=8000)

    # Student Risk Page with Simulator & Remedial Targets
    print("Navigating to /student/risk...")
    page.goto("http://localhost:5173/student/risk")
    time.sleep(2)
    page.screenshot(path=f"{output_dir}/student_whatif_simulator.png", full_page=True)
    print("Captured student_whatif_simulator.png")

    # Student Actions Page with Closed-Loop Efficacy Badges
    print("Navigating to /student/actions...")
    page.goto("http://localhost:5173/student/actions")
    time.sleep(2)
    page.screenshot(path=f"{output_dir}/student_actions_efficacy.png", full_page=True)
    print("Captured student_actions_efficacy.png")

    # Mentor Flow
    print("Logging in as mentor...")
    page.goto("http://localhost:5173/login")
    page.fill("input[type='email']", "mentor1@college.edu")
    page.fill("input[type='password']", "Demo@1234")
    page.click("button[type='submit']")
    page.wait_for_url("**/mentor**", timeout=8000)

    # Mentor Student Detail (Student 2)
    print("Navigating to /mentor/students/2...")
    page.goto("http://localhost:5173/mentor/students/2")
    time.sleep(2)

    # Click Academic Records Tab
    page.click("button:has-text('Academic Records')")
    time.sleep(1)
    page.screenshot(path=f"{output_dir}/mentor_student2_remedial_targets.png", full_page=True)
    print("Captured mentor_student2_remedial_targets.png")

    # Click Risk Analysis Tab
    page.click("button:has-text('Risk Analysis')")
    time.sleep(1)
    page.screenshot(path=f"{output_dir}/mentor_student2_whatif.png", full_page=True)
    print("Captured mentor_student2_whatif.png")

    browser.close()
    print("All visual verification tests completed successfully!")

"""Optional demo visual regression smoke; run outside pytest/CI browser downloads."""

import argparse
import json
import shutil
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(
    description="Review the bundled TruthLens demo in a real browser; screenshots stay local."
)
parser.add_argument("--url", default="http://127.0.0.1:4173")
parser.add_argument("--output", default="/tmp/truthlens-visual-review")
parser.add_argument("--axe", help="Optional local axe.min.js for WCAG checks on the final view")
args = parser.parse_args()
Path(args.output).mkdir(parents=True, exist_ok=True)
ROOT = str(Path(args.output).resolve()) + "/"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=shutil.which("chromium"), args=["--no-sandbox"])
    page = b.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(args.url)
    page.wait_for_selector(".tl-review-focus")
    for width in [360, 390, 768, 1280, 1600]:
        page.set_viewport_size({"width": width, "height": 900})
        page.wait_for_timeout(240)
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"), width
        page.screenshot(path=ROOT + f"final-overview-{width}.png")
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_role("button", name="Review this run").click()
    expect(page.locator(".rk-criterion").first).to_contain_text("Check failed")
    page.wait_for_timeout(240)
    page.screenshot(path=ROOT + "final-run-review-390.png")
    page.get_by_role("button", name="View recorded source").first.click()
    expect(page.get_by_role("dialog")).to_be_visible()
    page.wait_for_timeout(260)
    expect(page.locator(".rk-json")).to_be_visible()
    page.screenshot(path=ROOT + "final-source-390.png")
    page.get_by_role("dialog").get_by_role("button", name="expand JSON").first.focus()
    page.keyboard.press("Enter")
    page.keyboard.press("Escape")
    expect(page.get_by_role("dialog")).to_have_count(0)
    expect(page.get_by_role("button", name="View recorded source").first).to_be_focused()
    page.get_by_test_id("nav-results").click()
    page.get_by_test_id("artifact-open").filter(has_text="git_diff").first.click()
    expect(page.locator(".rk-canvas")).to_be_visible()
    page.get_by_role("button", name="Raw source", exact=True).click()
    expect(page.locator(".rk-stage pre")).to_be_visible()
    page.get_by_role("button", name="Rendered", exact=True).click()
    page.get_by_role("button", name="Wrap lines").click()
    expect(page.locator(".rk-canvas")).not_to_have_class("rk-wrap")
    page.get_by_test_id("nav-evidence").click()
    expect(page.locator(".tl-graph")).to_be_visible()
    graphnode = page.locator('.tl-graph svg [role="button"]').first
    graphnode.focus()
    page.keyboard.press("Enter")
    expect(page.locator(".tl-graph-selection")).to_be_visible()
    page.get_by_role("button", name="Zoom in graph").click()
    expect(page.get_by_role("button", name="Reset graph zoom")).to_have_text("120%")
    page.locator('.tl-iconrail [aria-label="More views"]').click()
    page.get_by_test_id("nav-sources").click()
    page.get_by_role("button", name="Use with Codex", exact=True).click()
    expect(page.get_by_label("Add TruthLens to Codex")).to_contain_text("codex mcp add")
    page.get_by_role("button", name="Use with ChatGPT", exact=True).click()
    expect(page.get_by_text("ChatGPT needs a hosted connection")).to_be_visible()
    page.screenshot(path=ROOT + "final-connections-390.png")
    for name in ["Obsidian", "Midnight", "Paper"]:
        page.locator('.tl-iconrail [aria-label="More views"]').click()
        page.get_by_test_id("nav-appearance").click()
        page.get_by_role("button", name=name, exact=False).click()
        page.wait_for_timeout(200)
        page.screenshot(path=ROOT + f"final-theme-{name}-390.png")
        page.get_by_test_id("nav-overview").click()
        page.set_viewport_size({"width": 1280, "height": 900})
        page.wait_for_timeout(240)
        page.screenshot(path=ROOT + f"final-overview-{name}-1280.png")
        page.set_viewport_size({"width": 390, "height": 844})
    page.emulate_media(reduced_motion="reduce")
    page.get_by_role("button", name="Review this run").click()
    page.get_by_role("button", name="View recorded source").first.click()
    assert page.evaluate('document.getAnimations().filter(a=>a.playState==="running").length') == 0
    if args.axe:
        page.add_script_tag(path=str(Path(args.axe).resolve()))
        violations = page.evaluate(
            "async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations"
        )
        Path(ROOT + "axe-results.json").write_text(json.dumps(violations, indent=2))
        assert not violations, [(v["id"], v["impact"]) for v in violations]
    assert not errors, errors
    print(
        "PASS: 5 widths, failure-first review, source JSON + keyboard + focus return, raw renderer, graph selection+zoom, connection guides, 3 themes, reduced motion, no JS errors"
    )
    b.close()

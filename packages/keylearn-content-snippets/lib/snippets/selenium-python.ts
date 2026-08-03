import { type Snippet } from "../types.ts";

/**
 * Selenium WebDriver, in Python.
 *
 * Selenium 4 and no earlier: `find_element_by_id` and the implicit-wait habits
 * that went with it are gone, and a corpus that taught them would be teaching
 * a decade-old API. The recurring theme is waiting — Selenium, unlike Cypress
 * and Playwright, retries nothing at all unless you ask it to, and that single
 * fact is the origin of most flaky Selenium suites.
 */
export const seleniumPython: readonly Snippet[] = [
  {
    id: "se-py-imports",
    title: "The imports a real suite needs",
    level: 1,
    tags: ["structure"],
    code: `# By, WebDriverWait and expected_conditions travel together: almost no
# useful Selenium code is written without all three.
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.support.wait import WebDriverWait`,
  },
  {
    id: "se-py-driver",
    title: "Start a browser and always close it",
    level: 1,
    tags: ["structure"],
    code: `# The with block quits the driver even if the test raises. Without it a
# failing run leaves browser processes behind until the machine runs out.
with webdriver.Chrome() as driver:
    driver.get("https://example.com/login")`,
  },
  {
    id: "se-py-headless",
    title: "Headless, with the options CI needs",
    level: 2,
    tags: ["structure", "config"],
    code: `# A fixed window size matters more than it looks: the default headless
# viewport is small enough that a responsive site serves the mobile layout.
options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--window-size=1280,720")
driver = webdriver.Chrome(options=options)`,
  },
  {
    id: "se-py-fixture",
    title: "A pytest fixture for the driver",
    level: 3,
    tags: ["structure"],
    code: `# yield hands the driver to the test and resumes afterwards, so the quit
# happens even when the test fails. scope="function" gives each test a
# clean browser, which is worth the startup cost.
import pytest


@pytest.fixture()
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    browser = webdriver.Chrome(options=options)
    yield browser
    browser.quit()`,
  },
  {
    id: "se-py-find",
    title: "Find one element",
    level: 1,
    tags: ["locators"],
    code: `# The Selenium 4 signature: a By strategy and a value. The old
# find_element_by_id family was removed, not merely deprecated.
email = driver.find_element(By.CSS_SELECTOR, "[data-test=email]")`,
  },
  {
    id: "se-py-find-elements",
    title: "Find several, and the difference that matters",
    level: 2,
    tags: ["locators"],
    code: `# find_elements returns an empty list when nothing matches; find_element
# raises NoSuchElementException. Only the plural form is safe to test with.
rows = driver.find_elements(By.CSS_SELECTOR, "[data-test=row]")
assert len(rows) == 3`,
  },
  {
    id: "se-py-by-strategies",
    title: "The locator strategies, and which to prefer",
    level: 2,
    tags: ["locators"],
    code: `# ID is fastest and most stable. CSS covers nearly everything else.
# XPath is the last resort — powerful, slow, and brittle against a redesign.
driver.find_element(By.ID, "submit")
driver.find_element(By.CSS_SELECTOR, "form.login input[type=password]")
driver.find_element(By.XPATH, "//button[normalize-space()='Sign in']")`,
  },
  {
    id: "se-py-relative-locator",
    title: "Locate relative to another element",
    level: 4,
    tags: ["locators"],
    code: `# Selenium 4's relative locators describe position on the rendered page,
# which sometimes says what you mean better than the DOM structure does.
from selenium.webdriver.support.relative_locator import locate_with

label = driver.find_element(By.ID, "quantity-label")
field = driver.find_element(locate_with(By.TAG_NAME, "input").below(label))`,
  },
  {
    id: "se-py-nested",
    title: "Search inside an element",
    level: 2,
    tags: ["locators"],
    code: `# find_element on an element scopes the search to its subtree, which is
# how you avoid a selector matching the same control in the page header.
cart = driver.find_element(By.CSS_SELECTOR, "[data-test=cart]")
total = cart.find_element(By.CSS_SELECTOR, "[data-test=total]")`,
  },
  {
    id: "se-py-explicit-wait",
    title: "Wait for a condition, not for a duration",
    level: 3,
    tags: ["waits"],
    code: `# The single most important habit in Selenium. It polls until the
# condition holds or the timeout expires, and returns the element.
wait = WebDriverWait(driver, timeout=10)
button = wait.until(ec.element_to_be_clickable((By.ID, "submit")))
button.click()`,
  },
  {
    id: "se-py-wait-conditions",
    title: "The conditions worth knowing",
    level: 3,
    tags: ["waits"],
    code: `# presence means it is in the DOM; visibility means it can be seen;
# clickable means it can also be interacted with. They fail differently.
wait.until(ec.presence_of_element_located((By.ID, "results")))
wait.until(ec.visibility_of_element_located((By.ID, "results")))
wait.until(ec.text_to_be_present_in_element((By.ID, "status"), "Complete"))`,
  },
  {
    id: "se-py-wait-stale",
    title: "Wait for an element to go away",
    level: 4,
    tags: ["waits"],
    code: `# Waiting for the spinner to disappear is more reliable than waiting for
# the content to arrive, because the content may render in stages.
wait.until(ec.invisibility_of_element_located((By.ID, "spinner")))`,
  },
  {
    id: "se-py-custom-wait",
    title: "A condition of your own",
    level: 4,
    tags: ["waits"],
    code: `# until() takes any callable that returns something truthy. A lambda
# covers the cases the built-in conditions do not.
wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, ".row")) >= 10)`,
  },
  {
    id: "se-py-no-implicit-wait",
    title: "Why implicit and explicit waits do not mix",
    level: 5,
    tags: ["waits"],
    code: `# Setting both makes the timeouts compound unpredictably — a documented
# Selenium warning. Pick explicit waits and leave the implicit one at zero.
driver.implicitly_wait(0)`,
  },
  {
    id: "se-py-no-sleep",
    title: "The line to delete on sight",
    level: 3,
    tags: ["waits"],
    code: `# time.sleep(2) is slower than it needs to be on a fast machine and
# shorter than it needs to be on a loaded CI runner. It is the wrong tool
# in both directions.
wait.until(ec.visibility_of_element_located((By.ID, "results")))`,
  },
  {
    id: "se-py-type",
    title: "Fill in a field",
    level: 1,
    tags: ["actions"],
    code: `# send_keys appends. On a field that may already hold something, clear()
# first or the two values run together.
field = driver.find_element(By.ID, "email")
field.clear()
field.send_keys("ada@example.com")`,
  },
  {
    id: "se-py-keys",
    title: "Send a key that has no character",
    level: 2,
    tags: ["actions"],
    code: `# The Keys enum covers Enter, Tab, the arrows and the modifiers. Chaining
# it onto the text submits the form in one call.
from selenium.webdriver.common.keys import Keys

driver.find_element(By.ID, "search").send_keys("keyboard" + Keys.RETURN)`,
  },
  {
    id: "se-py-select",
    title: "A native select element",
    level: 2,
    tags: ["actions"],
    code: `# The Select helper understands option elements. Clicking a select and
# then clicking an option works sometimes and is not worth relying on.
from selenium.webdriver.support.select import Select

Select(driver.find_element(By.ID, "country")).select_by_visible_text("Australia")`,
  },
  {
    id: "se-py-actions",
    title: "Hover, drag and the other pointer gestures",
    level: 4,
    tags: ["actions"],
    code: `# ActionChains builds a sequence and perform() sends it as one. Without
# the perform() nothing happens at all, which is the usual first mistake.
from selenium.webdriver.common.action_chains import ActionChains

menu = driver.find_element(By.ID, "menu")
item = driver.find_element(By.ID, "settings")
ActionChains(driver).move_to_element(menu).click(item).perform()`,
  },
  {
    id: "se-py-scroll",
    title: "Scroll an element into view",
    level: 3,
    tags: ["actions"],
    code: `# Selenium scrolls automatically before a click, but not before reading
# a value, and a lazily-loaded list may not have rendered until you do.
driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)`,
  },
  {
    id: "se-py-upload",
    title: "Upload a file",
    level: 3,
    tags: ["actions"],
    code: `# Send the path to the hidden input rather than clicking the button: the
# native file dialog it opens is outside the browser and out of reach.
driver.find_element(By.CSS_SELECTOR, "input[type=file]").send_keys(str(path))`,
  },
  {
    id: "se-py-assert-text",
    title: "Assert on visible text",
    level: 2,
    tags: ["assertions"],
    code: `# .text is the rendered text, so it excludes anything hidden by CSS —
# which is usually what a user-facing assertion should be checking.
heading = wait.until(ec.visibility_of_element_located((By.TAG_NAME, "h1")))
assert heading.text == "Your orders"`,
  },
  {
    id: "se-py-assert-attribute",
    title: "Attributes, properties and the difference",
    level: 4,
    tags: ["assertions"],
    code: `# get_attribute reads the HTML as written; get_property reads the live
# DOM. For an input the user has typed into, only the property is current.
assert field.get_property("value") == "ada@example.com"
assert field.get_attribute("placeholder") == "Email address"`,
  },
  {
    id: "se-py-assert-state",
    title: "Assert on state, not appearance",
    level: 3,
    tags: ["assertions"],
    code: `# All three are computed from the live element, so they reflect what the
# user can actually do rather than what the markup claims.
assert button.is_displayed()
assert button.is_enabled()
assert not checkbox.is_selected()`,
  },
  {
    id: "se-py-page-object",
    title: "A page object",
    level: 4,
    tags: ["structure"],
    code: `# The locators live in one place, so a renamed field is one edit rather
# than a search across the suite. The methods say what the page does.
class LoginPage:
    EMAIL = (By.ID, "email")
    PASSWORD = (By.ID, "password")
    SUBMIT = (By.ID, "submit")

    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, timeout=10)

    def sign_in(self, email, password):
        self.wait.until(ec.visibility_of_element_located(self.EMAIL)).send_keys(email)
        self.driver.find_element(*self.PASSWORD).send_keys(password)
        self.driver.find_element(*self.SUBMIT).click()`,
  },
  {
    id: "se-py-page-object-return",
    title: "A page object method that returns the next page",
    level: 5,
    tags: ["structure"],
    code: `# Returning the page you land on makes the flow readable as a chain and
# gives the type checker something to work with.
def sign_in(self, email, password) -> "DashboardPage":
    self.driver.find_element(*self.EMAIL).send_keys(email)
    self.driver.find_element(*self.SUBMIT).click()
    return DashboardPage(self.driver)`,
  },
  {
    id: "se-py-frames",
    title: "Work inside an iframe",
    level: 4,
    tags: ["browser"],
    code: `# Nothing inside a frame is reachable until you switch into it, and
# nothing outside it is reachable until you switch back.
driver.switch_to.frame(driver.find_element(By.ID, "payment-frame"))
driver.find_element(By.ID, "card-number").send_keys("4111111111111111")
driver.switch_to.default_content()`,
  },
  {
    id: "se-py-windows",
    title: "Handle a second window",
    level: 4,
    tags: ["browser"],
    code: `# window_handles is in no guaranteed order, so take the handle that was
# not there before rather than assuming the new one is last.
before = set(driver.window_handles)
driver.find_element(By.ID, "open-docs").click()
wait.until(ec.number_of_windows_to_be(len(before) + 1))
(new_window,) = set(driver.window_handles) - before
driver.switch_to.window(new_window)`,
  },
  {
    id: "se-py-alert",
    title: "Accept a native dialog",
    level: 3,
    tags: ["browser"],
    code: `# A JavaScript alert blocks every other command until it is dealt with,
# so this is not optional cleanup — it is the only way to carry on.
alert = wait.until(ec.alert_is_present())
alert.accept()`,
  },
  {
    id: "se-py-cookies",
    title: "Set a cookie to skip the login screen",
    level: 4,
    tags: ["browser"],
    code: `# The domain has to match, so visit the site first — a cookie cannot be
# added for a domain the browser is not currently on.
driver.get("https://example.com")
driver.add_cookie({"name": "session", "value": token, "path": "/"})
driver.get("https://example.com/dashboard")`,
  },
  {
    id: "se-py-screenshot",
    title: "Capture a screenshot on failure",
    level: 3,
    tags: ["structure"],
    code: `# A screenshot taken at the moment of failure explains more than the
# stack trace does, and costs nothing on a passing run.
def take_screenshot(driver, name):
    driver.save_screenshot(f"artifacts/{name}.png")`,
  },
  {
    id: "se-py-logs",
    title: "Read the browser console",
    level: 5,
    tags: ["browser"],
    code: `# A test that passed while the console filled with errors has told you
# less than it appears to. Worth asserting on in a smoke suite.
for entry in driver.get_log("browser"):
    assert entry["level"] != "SEVERE", entry["message"]`,
  },
  {
    id: "se-py-grid",
    title: "Run against a remote grid",
    level: 4,
    tags: ["config"],
    code: `# The same test, executed elsewhere. Only the driver construction
# changes, which is the argument for keeping it in one fixture.
driver = webdriver.Remote(
    command_executor="http://selenium-hub:4444/wd/hub",
    options=webdriver.ChromeOptions(),
)`,
  },
  {
    id: "se-py-timeouts",
    title: "Set the page and script timeouts",
    level: 3,
    tags: ["config"],
    code: `# These are separate from the WebDriverWait timeout: they bound how long
# a navigation or an injected script may take before the driver gives up.
driver.set_page_load_timeout(30)
driver.set_script_timeout(10)`,
  },
  {
    id: "se-py-retry-stale",
    title: "Survive a stale element",
    level: 5,
    tags: ["waits"],
    code: `# A re-render invalidates every reference you were holding. Re-finding
# inside the wait is the fix; caching the element outside it is the cause.
from selenium.common.exceptions import StaleElementReferenceException

wait = WebDriverWait(
    driver,
    timeout=10,
    ignored_exceptions=[StaleElementReferenceException],
)
wait.until(ec.text_to_be_present_in_element((By.ID, "total"), "$51.25"))`,
  },
];

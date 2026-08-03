import { type Snippet } from "../types.ts";

/**
 * Selenium WebDriver, in Java.
 *
 * The same framework as the Python corpus and deliberately the same subjects,
 * so switching the language radio compares two ways of saying one thing rather
 * than moving to a different topic. Java is where Selenium started and still
 * where most enterprise suites live, so the JUnit 5 and Page Factory shapes
 * here are the ones a tester is most likely to meet.
 */
export const seleniumJava: readonly Snippet[] = [
  {
    id: "se-java-imports",
    title: "The imports a real suite needs",
    level: 1,
    tags: ["structure"],
    code: `// By, WebDriverWait and ExpectedConditions travel together, as they do
// in every other binding.
import java.time.Duration;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;`,
  },
  {
    id: "se-java-driver",
    title: "Start a browser and always quit it",
    level: 1,
    tags: ["structure"],
    scope: "statement",
    code: `// Since Selenium 4.6 the driver binary is located automatically, so the
// WebDriverManager dependency that every old tutorial adds is no longer
// needed.
WebDriver driver = new ChromeDriver();
driver.get("https://example.com/login");`,
  },
  {
    id: "se-java-junit",
    title: "A JUnit 5 test with proper setup and teardown",
    level: 3,
    tags: ["structure"],
    code: `// @AfterEach runs even when the test fails, which is what keeps a failing
// build from leaving browsers running on the agent.
class LoginTest {

  private WebDriver driver;

  @BeforeEach
  void setUp() {
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless=new", "--window-size=1280,720");
    driver = new ChromeDriver(options);
  }

  @AfterEach
  void tearDown() {
    driver.quit();
  }
}`,
  },
  {
    id: "se-java-find",
    title: "Find one element",
    level: 1,
    tags: ["locators"],
    scope: "statement",
    code: `// By.cssSelector for nearly everything. By.id where the page offers one,
// because it is both the fastest lookup and the least likely to move.
WebElement email = driver.findElement(By.cssSelector("[data-test=email]"));`,
  },
  {
    id: "se-java-find-elements",
    title: "Find several, and the difference that matters",
    level: 2,
    tags: ["locators"],
    scope: "statement",
    code: `// findElements returns an empty list; findElement throws
// NoSuchElementException. Only the plural form can express "there are none".
List<WebElement> rows = driver.findElements(By.cssSelector("[data-test=row]"));
assertEquals(3, rows.size());`,
  },
  {
    id: "se-java-nested",
    title: "Search inside an element",
    level: 2,
    tags: ["locators"],
    scope: "statement",
    code: `// Calling findElement on an element scopes the search to its subtree,
// which stops a generic selector matching something in the page header.
WebElement cart = driver.findElement(By.cssSelector("[data-test=cart]"));
WebElement total = cart.findElement(By.cssSelector("[data-test=total]"));`,
  },
  {
    id: "se-java-explicit-wait",
    title: "Wait for a condition, not for a duration",
    level: 3,
    tags: ["waits"],
    scope: "statement",
    code: `// Duration rather than a bare int since Selenium 4: the unit is in the
// type, so a timeout can no longer be read as the wrong one.
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
WebElement button = wait.until(ExpectedConditions.elementToBeClickable(By.id("submit")));
button.click();`,
  },
  {
    id: "se-java-wait-conditions",
    title: "The conditions worth knowing",
    level: 3,
    tags: ["waits"],
    scope: "statement",
    code: `// Presence means it is in the DOM, visibility means it can be seen, and
// clickable means it can also be interacted with. They fail differently.
wait.until(ExpectedConditions.presenceOfElementLocated(By.id("results")));
wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("results")));
wait.until(ExpectedConditions.textToBe(By.id("status"), "Complete"));`,
  },
  {
    id: "se-java-wait-invisible",
    title: "Wait for something to go away",
    level: 4,
    tags: ["waits"],
    scope: "statement",
    code: `// Waiting for the spinner to leave is more reliable than waiting for the
// content to arrive, which may render in stages.
wait.until(ExpectedConditions.invisibilityOfElementLocated(By.id("spinner")));`,
  },
  {
    id: "se-java-custom-wait",
    title: "A condition of your own",
    level: 4,
    tags: ["waits"],
    scope: "statement",
    code: `// until takes any Function returning a truthy value, so a lambda covers
// what the built-in conditions do not.
wait.until(d -> d.findElements(By.cssSelector(".row")).size() >= 10);`,
  },
  {
    id: "se-java-fluent-wait",
    title: "Control the polling interval and what to ignore",
    level: 5,
    tags: ["waits"],
    scope: "statement",
    code: `// The long form of WebDriverWait. Ignoring StaleElementReferenceException
// is what lets a wait survive the page re-rendering underneath it.
Wait<WebDriver> wait =
    new FluentWait<>(driver)
        .withTimeout(Duration.ofSeconds(10))
        .pollingEvery(Duration.ofMillis(250))
        .ignoring(StaleElementReferenceException.class);`,
  },
  {
    id: "se-java-no-implicit",
    title: "Why implicit and explicit waits do not mix",
    level: 5,
    tags: ["waits"],
    scope: "statement",
    code: `// Setting both makes the timeouts compound unpredictably — Selenium's own
// documentation warns against it. Choose explicit waits and leave this zero.
driver.manage().timeouts().implicitlyWait(Duration.ZERO);`,
  },
  {
    id: "se-java-type",
    title: "Fill in a field",
    level: 1,
    tags: ["actions"],
    scope: "statement",
    code: `// sendKeys appends, so clear() first on any field that may already hold
// a value.
WebElement field = driver.findElement(By.id("email"));
field.clear();
field.sendKeys("ada@example.com");`,
  },
  {
    id: "se-java-keys",
    title: "Send a key that has no character",
    level: 2,
    tags: ["actions"],
    scope: "statement",
    code: `// The Keys enum covers Enter, Tab, the arrows and the modifiers, and
// chains onto the text in the same call.
driver.findElement(By.id("search")).sendKeys("keyboard" + Keys.RETURN);`,
  },
  {
    id: "se-java-select",
    title: "A native select element",
    level: 2,
    tags: ["actions"],
    scope: "statement",
    code: `// The Select helper understands option elements. Clicking the select and
// then the option works sometimes, which is worse than not working.
Select country = new Select(driver.findElement(By.id("country")));
country.selectByVisibleText("Australia");`,
  },
  {
    id: "se-java-actions",
    title: "Hover, drag and the other pointer gestures",
    level: 4,
    tags: ["actions"],
    scope: "statement",
    code: `// Actions builds a sequence and perform() sends it. Without the perform()
// nothing happens at all, which is the usual first mistake.
new Actions(driver)
    .moveToElement(driver.findElement(By.id("menu")))
    .click(driver.findElement(By.id("settings")))
    .perform();`,
  },
  {
    id: "se-java-scroll",
    title: "Scroll an element into view",
    level: 3,
    tags: ["actions"],
    scope: "statement",
    code: `// Selenium scrolls before a click but not before reading a value, and a
// lazily-loaded row may not exist until it has been scrolled to.
((JavascriptExecutor) driver)
    .executeScript("arguments[0].scrollIntoView({block: 'center'});", element);`,
  },
  {
    id: "se-java-upload",
    title: "Upload a file",
    level: 3,
    tags: ["actions"],
    scope: "statement",
    code: `// Send the path to the input rather than clicking the button: the native
// file dialog is outside the browser and WebDriver cannot reach it.
driver.findElement(By.cssSelector("input[type=file]")).sendKeys(path.toString());`,
  },
  {
    id: "se-java-assert-text",
    title: "Assert on visible text",
    level: 2,
    tags: ["assertions"],
    scope: "statement",
    code: `// getText() returns the rendered text, so anything hidden by CSS is
// excluded — which is what a user-facing assertion wants.
WebElement heading =
    wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("h1")));
assertEquals("Your orders", heading.getText());`,
  },
  {
    id: "se-java-assert-attribute",
    title: "Attributes, properties and the difference",
    level: 4,
    tags: ["assertions"],
    scope: "statement",
    code: `// getDomAttribute reads the HTML as written and getDomProperty reads the
// live DOM. For an input the user typed into, only the property is current.
assertEquals("ada@example.com", field.getDomProperty("value"));
assertEquals("Email address", field.getDomAttribute("placeholder"));`,
  },
  {
    id: "se-java-assert-state",
    title: "Assert on state, not appearance",
    level: 3,
    tags: ["assertions"],
    scope: "statement",
    code: `// All three are computed from the live element, so they describe what a
// user could actually do rather than what the markup claims.
assertTrue(button.isDisplayed());
assertTrue(button.isEnabled());
assertFalse(checkbox.isSelected());`,
  },
  {
    id: "se-java-assertall",
    title: "Report every failed assertion, not only the first",
    level: 4,
    tags: ["assertions"],
    scope: "statement",
    code: `// A test that stops at the first mismatch hides the other two. assertAll
// runs them all and reports the lot, which halves the number of runs.
assertAll(
    () -> assertEquals("Your orders", heading.getText()),
    () -> assertEquals(3, rows.size()),
    () -> assertTrue(exportButton.isEnabled()));`,
  },
  {
    id: "se-java-page-object",
    title: "A page object",
    level: 4,
    tags: ["structure"],
    code: `// Locators in one place, so a renamed field is one edit. The methods
// describe what the page does, not how it is put together.
class LoginPage {

  private static final By EMAIL = By.id("email");
  private static final By PASSWORD = By.id("password");
  private static final By SUBMIT = By.id("submit");

  private final WebDriver driver;
  private final WebDriverWait wait;

  LoginPage(WebDriver driver) {
    this.driver = driver;
    this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
  }

  DashboardPage signIn(String email, String password) {
    wait.until(ExpectedConditions.visibilityOfElementLocated(EMAIL)).sendKeys(email);
    driver.findElement(PASSWORD).sendKeys(password);
    driver.findElement(SUBMIT).click();
    return new DashboardPage(driver);
  }
}`,
  },
  {
    id: "se-java-page-factory",
    title: "Page Factory, and why it is now discouraged",
    level: 5,
    tags: ["structure"],
    scope: "member",
    code: `// @FindBy proxies re-find the element on every call, which reads nicely
// and hides where the lookups happen. Selenium's own docs now advise plain
// By constants instead; recognise this, and do not write new code with it.
@FindBy(id = "submit")
private WebElement submitButton;`,
  },
  {
    id: "se-java-frames",
    title: "Work inside an iframe",
    level: 4,
    tags: ["browser"],
    scope: "statement",
    code: `// Nothing inside the frame is reachable until you switch into it, and
// nothing outside it is reachable until you switch back.
driver.switchTo().frame(driver.findElement(By.id("payment-frame")));
driver.findElement(By.id("card-number")).sendKeys("4111111111111111");
driver.switchTo().defaultContent();`,
  },
  {
    id: "se-java-windows",
    title: "Handle a second window",
    level: 4,
    tags: ["browser"],
    scope: "statement",
    code: `// The handles come back in no guaranteed order, so take the one that was
// not there before rather than assuming the new window is last.
Set<String> before = driver.getWindowHandles();
driver.findElement(By.id("open-docs")).click();
wait.until(ExpectedConditions.numberOfWindowsToBe(before.size() + 1));
Set<String> after = new HashSet<>(driver.getWindowHandles());
after.removeAll(before);
driver.switchTo().window(after.iterator().next());`,
  },
  {
    id: "se-java-alert",
    title: "Accept a native dialog",
    level: 3,
    tags: ["browser"],
    scope: "statement",
    code: `// A JavaScript alert blocks every other command until it is handled, so
// this is not cleanup — it is the only way to continue.
Alert alert = wait.until(ExpectedConditions.alertIsPresent());
alert.accept();`,
  },
  {
    id: "se-java-cookies",
    title: "Set a cookie to skip the login screen",
    level: 4,
    tags: ["browser"],
    scope: "statement",
    code: `// The domain must match, so navigate to the site first: a cookie cannot
// be added for a domain the browser is not currently on.
driver.get("https://example.com");
driver.manage().addCookie(new Cookie("session", token, "/"));
driver.get("https://example.com/dashboard");`,
  },
  {
    id: "se-java-screenshot",
    title: "Capture a screenshot on failure",
    level: 3,
    tags: ["structure"],
    scope: "statement",
    code: `// A screenshot from the moment of failure explains more than the stack
// trace, and costs nothing on a passing run.
File image = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
Files.copy(image.toPath(), Path.of("artifacts", name + ".png"));`,
  },
  {
    id: "se-java-parameterised",
    title: "One test over several inputs",
    level: 4,
    tags: ["structure"],
    scope: "member",
    code: `// Three named cases in the report rather than one test with a loop
// inside it, so a failure says which input caused it.
@ParameterizedTest
@ValueSource(strings = {"basic", "standard", "premium"})
void showsThePriceFor(String plan) {
  driver.get("https://example.com/plans/" + plan);
  assertTrue(driver.findElement(By.id("price")).isDisplayed());
}`,
  },
  {
    id: "se-java-grid",
    title: "Run against a remote grid",
    level: 4,
    tags: ["config"],
    scope: "statement",
    code: `// The same test executed elsewhere. Only the construction changes, which
// is the argument for keeping it in one place.
WebDriver driver =
    new RemoteWebDriver(new URL("http://selenium-hub:4444/wd/hub"), new ChromeOptions());`,
  },
  {
    id: "se-java-timeouts",
    title: "Set the page and script timeouts",
    level: 3,
    tags: ["config"],
    scope: "statement",
    code: `// Separate from the WebDriverWait timeout: these bound how long a
// navigation or an injected script may take before the driver gives up.
driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(30));
driver.manage().timeouts().scriptTimeout(Duration.ofSeconds(10));`,
  },
];

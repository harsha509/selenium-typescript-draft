import * as by from './by';
import * as error from './error';
import * as webdriver from './webdriver';

const { Condition, WebElementCondition } = webdriver;


function ableToSwitchToFrame(frame: number | webdriver.WebElement | webdriver.By | Function) {
    let condition: webdriver.Condition;
    if (typeof frame === 'number' || frame instanceof webdriver.WebElement) {
        condition = (driver: any) => attemptToSwitchFrames(driver, frame);
    } else {
        condition = function (driver: { findElements: (arg0: any) => Promise<string | any[]>; }) {
            let locator = /** @type {!(webdriver.By|Function)} */ (frame);
            return driver.findElements(locator).then(function (els: string | any[]) {
                if (els.length) {
                    return attemptToSwitchFrames(driver, els[0]);
                }
            });
        };
    }

    return new webdriver.Condition('to be able to switch to frame', condition);

    function attemptToSwitchFrames(driver: { findElements?: (arg0: any) => Promise<string | any[]>; switchTo?: any; }, frame: any) {
        return driver
            .switchTo()
            .frame(frame)
            .then(
                function () {
                    return true;
                },
                function (e: any) {
                    if (!(e instanceof error.NoSuchFrameError)) {
                        throw e;
                    }
                }
            );
    }
}

function alertIsPresent() {
    return new Condition('for alert to be present', function (driver: any) {
        return driver
            .switchTo()
            .alert()
            .catch(function (e: any) {
                if (
                    !(
                        e instanceof error.NoSuchAlertError ||
                        // XXX: Workaround for GeckoDriver error `TypeError: can't convert null
                        // to object`. For more details, see
                        // https://github.com/SeleniumHQ/selenium/pull/2137
                        (e instanceof error.WebDriverError &&
                            e.message === `can't convert null to object`)
                    )
                ) {
                    throw e
                }
            })
    });
}

function titleIs(title: string) {
    return new Condition(`for title to be ${JSON.stringify(title)}`, (driver: { getTitle: () => Promise<any>; }) => {
        return driver.getTitle().then((t) => {
            return t === title;
        });
    });
}

function titleContains(substr: string) {
    return new Condition(
        `for title to contain ${JSON.stringify(substr)}`,
        async (driver: { getTitle: () => Promise<any>; }) => {
            const title = await driver.getTitle();
            return title.indexOf(substr) !== -1;
        }
    );
}

function titleMatches(regex: RegExp) {
    return new Condition(`for title to match ${regex}`, async (driver: { getTitle: () => Promise<any>; }) => {
        const title = await driver.getTitle();
        return regex.test(title);
    });
}

function urlIs(url: string) {
    return new Condition(`for URL to be ${JSON.stringify(url)}`, async (driver: { getCurrentUrl: () => Promise<any>; }) => {
        const u = await driver.getCurrentUrl();
        return u === url;
    });
}


function urlContains(substrUrl: string) {
    return new Condition(
        `for URL to contain ${JSON.stringify(substrUrl)}`,
        async (driver: { getCurrentUrl: () => Promise<string | string[]>; }) => {
            const url = await driver.getCurrentUrl();
            return url && url.includes(substrUrl);
        }
    );
}

/**
 * Creates a condition that will wait for the current page's url to match the
 * given regular expression.
 *
 * @param {!RegExp} regex The regular expression to test against.
 * @return {!Condition<boolean>} The new condition.
 */
function urlMatches(regex: RegExp) {
    return new Condition(`for URL to match ${regex}`, async (driver: { getCurrentUrl: () => Promise<string>; }) => {
        const url = await driver.getCurrentUrl();
        return regex.test(url);
    });
}

/**
 * Creates a condition that will loop until an element is
 * {@link ./webdriver.WebDriver#findElement found} with the given locator.
 *
 * @param {!(By|Function)} locator The locator to use.
 * @return {!WebElementCondition} The new condition.
 */
function elementLocated(locator: any) {
    const checkedLocator = by.checkedLocator(locator);
    let locatorStr = typeof checkedLocator === 'function' ? 'by function()' : checkedLocator + '';
    return new WebElementCondition(
        `for element to be located ${locatorStr}`,
        (driver: { findElements: (arg0: any) => Promise<any>; }) => {
            return driver.findElements(checkedLocator).then((elements) => {
                return elements[0];
            });
        }
    );
}

function elementsLocated(locator: string) {
    locator = by.checkedLocator(locator)
    let locatorStr =
        typeof locator === 'function' ? 'by function()' : locator + ''
    return new Condition(
        'for at least one element to be located ' + locatorStr,
        function (driver: any) {
            return driver.findElements(locator).then(function (elements: string | any[]) {
                return elements.length > 0 ? elements : null
            })
        }
    )
}


function stalenessOf(element: { getTagName: () => Promise<any>; }){
    return new Condition('element to become stale', function () {
        return element.getTagName().then(
            function () {
                return false
            },
            function (e: any) {
                if (e instanceof error.StaleElementReferenceError) {
                    return true
                }
                throw e
            }
        )
    })
}

function elementIsVisible(element : any) {
    return new WebElementCondition('until element is visible', function () {
        return element.isDisplayed().then((v: any) => (v ? element : null))
    })
}

function elementIsNotVisible(element: any) {
    return new WebElementCondition('until element is not visible', function () {
        return element.isDisplayed().then((v: any) => (v ? null : element))
    })
}

function elementIsEnabled(element: any) {
    return new WebElementCondition('until element is enabled', function () {
        return element.isEnabled().then((v: any) => (v ? element : null))
    })
}

function elementIsDisabled(element: any) {
    return new WebElementCondition('until element is disabled', function () {
        return element.isEnabled().then((v: any) => (v ? null : element))
    })
}

function elementIsSelected(element: any) {
    return new WebElementCondition('until element is selected', function () {
        return element.isSelected().then((v: any) => (v ? element : null))
    })
}

function elementIsNotSelected(element: any) {
    return new WebElementCondition('until element is not selected', function () {
        return element.isSelected().then((v: any) => (v ? null : element))
    })
}

function elementTextIs(element: any, text: string) {
    return new WebElementCondition('until element text is', function () {
        return element.getText().then((t: any) => (t === text ? element : null))
    })
}

function elementTextContains(element: any, substr: string) {
    return new WebElementCondition('until element text contains', function () {
        return element
            .getText()
            .then((t: any) => (t.indexOf(substr) != -1 ? element : null))
    })
}

function elementTextMatches(element: any, regex: RegExp) {
    return new WebElementCondition('until element text matches', function () {
        return element.getText().then((t: any) => (regex.test(t) ? element : null))
    })
}




export {
    elementTextMatches,
    elementTextContains,
    elementTextIs,
    elementIsNotSelected,
    elementIsSelected,
    elementIsDisabled,
    ableToSwitchToFrame,
    elementIsEnabled,
    elementIsNotVisible,
    elementIsVisible,
    stalenessOf,
    elementsLocated,
    elementLocated,
    urlMatches,
    urlContains,
    urlIs,
    titleMatches,
    titleContains,
    alertIsPresent,
    titleIs,
}



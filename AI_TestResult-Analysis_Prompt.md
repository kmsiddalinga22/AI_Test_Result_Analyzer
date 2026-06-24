You are a senior test reliability engineer. Analyse the Playwright JSON test result below and produce a structured report.

TEST RESULT JSON:
{file}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — PARSE THE JSON (follow this exactly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The JSON is a Playwright reporter output. Navigate it like this:

TOTAL COUNTS → read from the top-level "stats" object:
  stats.expected   = total PASSED tests
  stats.unexpected = total FAILED tests
  stats.flaky      = total FLAKY tests
  stats.skipped    = total SKIPPED tests
  stats.duration   = run duration in milliseconds

FIND FAILED TESTS → loop through:
  root.suites[] → suites[] → specs[]
  A spec is FAILED if:  spec.ok === false
  OR if any:  spec.tests[].results[].status === "failed" OR "unexpected"

FOR EACH FAILED SPEC, extract:
  - Test name:     spec.title
  - Error message: spec.tests[].results[].errors[].message  (first non-empty value)
  - Retry count:   spec.tests[].results[].retry  (highest value across all results)

FLAKY = retry > 0 AND at least one result has status "passed"
CONSISTENT FAILURE = all results have status "failed" (retry did not help)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CLASSIFY EACH FAILED TEST ERROR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EACH failed test, scan its error message text for the keywords below.
Rule: does the error message STRING CONTAIN the keyword as a substring? (case-insensitive)
Assign the FIRST matching bucket (top-to-bottom). If NO keyword matches, use Unknown.

IMPORTANT: "contains" means the keyword appears ANYWHERE inside the error string.
Example: error "TimeoutError: page.waitForURL: Timeout 60000ms exceeded"
  → contains "TimeoutError"? YES → bucket = Performance ✓
  → Do NOT try to guess meaning — only check substring presence.

Bucket                  | Match if error message CONTAINS any of these substrings (| = OR)
------------------------|----------------------------------------------------------------------
1. TestScript_UIChange  = Invalid syntax | NoSuchElementException occurred | Failed - negative check criteria | Did not find element | com.mdi.core.db.EnhancedSQLException | Kindly modify the search criteria to find a Single mail
2. Assertion            = Log:Assertion | Failed to integrate
3. Performance          = Alert did not appear within | message did not appear | Unable to navigate to | TimeoutException occurred | TimeoutException | TimeoutError | Timeout 60000ms | Page did not load within | Saved Successfully! message did not appear within 300 seconds
4. Build                = Service Unavailable | Internal Server Error | Temporarily down for maintenance
5. UnexpectedAlertMsg   = UnhandledAlertException | Found an unexpected alert | unexpected alert open
6. Application          = Did not find record with columns | Failed identify table using locator | Unable to locate element | Failed: No records found by executing SQL | Element not found | Did not find row having column with value | Error: Unable to find Label | java.lang.NumberFormatException | Failed to execute KeyWordExecutionStatus | ElementNotVisibleException | Frame mdiWindowPopupFrame was not available to switch
7. UIFrameWork          = WebDriverException occurred | File download location
8. Compare_PDF_Excel_EMail = Expected and actual files are not same | Error while fetching mail from Webmail
9. Unknown              = (no keyword above was found in the error message)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — WRITE THE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output ONLY the 6 sections below, in this exact order.
Each header = **SECTION_NAME** alone on its own line.
Write "None." if a section has no items. No extra text outside these sections.

**FLAKY_TESTS**

1. "[test name]" - Hypothesis: [one sentence: timing / retry / data / parallelism / network]

**CONSISTENT_FAILURES**

1. "[test name]" - Root Cause: [one sentence probable root cause from the error message]

**RERUN_RECOMMENDATION**

Rerun (flaky): [comma-separated names, or "None"]
Send to Engineering (bugs): [comma-separated names, or "None"]

**ERROR_CLASSIFICATION**

1. [BUCKET]: "[test name]" — [matched keyword or short error snippet]

**SUMMARY**

Counts — Total: X | Passed: X | Failed: X | Flaky: X | Consistent Failures: X | Skipped: X
[One sentence suite health verdict.]

**ERROR_BUCKET_SUMMARY**

[BUCKET]: X tests
(only buckets with count > 0, sorted by count descending)
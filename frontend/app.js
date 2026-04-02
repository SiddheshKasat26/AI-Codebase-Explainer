   /*
   app.js — All JavaScript logic for AI Code Reviewer

   Structure:
   1. Global state
   2. runReview() — main function, calls backend
   3. renderReport() — parses AI response into 8 cards
   4. onCodeInput() — live updates while typing
   5. copyReport() — copies report to clipboard
   6. tryAgain() — resets everything
   7. UI helpers — show/hide/error functions
   */

 
   // CONSTANTS — defined once at the top of app.js
   // Change the value here = updates everywhere automatically
   const MAX_CODE_LENGTH = 50000;
   const WARN_CODE_LENGTH = 20000;

   /*
   1. GLOBAL STATE

   Variables declared outside functions are "global"
   meaning ALL functions in this file can access them.

   We only store things here that multiple functions need.
   Don't overuse globals — only when necessary!
   */

   // Stores the full AI report text so copyReport() can access it
   // even though renderReport() is the one that receives it
   let fullReportText = '';

   /*
   2. runReview()

   This is the MAIN function — called when user clicks
   "Run Deep Code Review" button.

   Flow:
   1. Get code from textarea
   2. Validate it
   3. Show loading state
   4. Send POST request to our backend /explain route
   5. Pass response to renderReport()
   */

   async function runReview() {
    
    // Step 1: Get the code
    // .value reads what the user typed into the textarea
    const code = document.getElementById('code-input').value;

    // Step 2: Validate 
    // .trim() removes whitespace from start and end
    // so "   " (just spaces) is treated as empty

    if (!code.trim()) {
        showError('Please paste some code first!');
        return; // stop the function here — don't proceed
    }

    // Warn user if code is very large (but don't block them)
    // 20000 chars ≈ ~400 lines — genuinely large file
    if (code.length > WARN_CODE_LENGTH) {

        // Show a soft warning — not an error, just information
        showWarning('Large file detected. Review may take 10-15 seconds...');

    } else {
        // Clear any previous warning if code is normal size
        hideWarning();
    }

    // Step 3: Update UI for loading state
    setLoading(true); // show spinner, disable button
    hideError(); // clear any previous error
    hideResult(); // hide previous results

    // Step 4: Call our backend
    // "try" means: attempt this, but don't crash if it fails
    try {
        // fetch() sends an HTTP request — same as curl but from browser
        // We're calling OUR OWN server at /explain
        const response = await fetch('/explain', {
            method: 'POST',
            headers: {
                // Tell server we're sending JSON data
                'Content-Type' : 'application/json'
            },
            // JSON.stringify converts JS object → JSON string
            // { code: "function..." } → '{"code":"function..."}'
            body: JSON.stringify({ code })
        });

        // Parse the JSON response back into a JS object
        const data = await response.json();

        // response.ok is false if server returned 400 or 500 error
        if (!response.ok) {
            showError(data.error || 'Something went wrong!');
        return;
        }

        // Step 5: Render the result
        // Store full text globally (for copy button)
        fullReportText = data.explanation;

        // Detect language and render the 8 section cards
        const language = detectLanguage(code);
        renderReport(data.explanation, language);

    } catch (err) {
        // This catches NETWORK errors (e.g. server not running)
        // Different from server errors — this means no response at all
        showError('Could not reach the server. Is it running?');
        console.error('Network error:', err);

    } finally {
        // "finally" runs no matter what — success OR failure
        // Always hide loading when done, even if there was an error
        setLoading(false);
     }
   }

   /*
   3. renderReport(text, language)

   Takes the AI's full text response and splits it into
   8 pieces — one per section card in the HTML.

   KEY CONCEPT — String splitting:
   The AI returns one big string like:
   "🧠 1. Code Summary\n...\n❌ 2. Errors...\n..."

   We split it at each numbered section heading
   then put each piece into the matching HTML div.
   */

   function renderReport(text, language) {

    // --- Map section numbers to HTML element IDs ---
    // This object is like a lookup table:
    // "which div does section number X go into?"
    const sectionMap = {
        '1': 'section-1', // Code Summary
        '2': 'section-2', // Errors & Bugs
        '3': 'section-3', // Edge Cases
        '4': 'section-4', // Improvements
        '5': 'section-5', // Best Practices
        '6': 'section-6', // Fixed Code
        '7': 'section-7', // Complexity Analysis
        '8': 'section-8', // Confidence Score
    };

    // --- Split the AI response into sections ---
    // This regex splits text BEFORE numbered sections like "1. ", "2. ", etc.
    // (?=...) → Lookahead: split BEFORE this pattern (don’t remove it)
    // (?: ... )? → Optional group (may or may not exist)
    // [\u{1F300}-\u{1FFFF}]? → Optional emoji (like 🧠, ❌, etc.)
    // This just means: "there might be one emoji before the number"
    // \s* → Optional spaces after emoji (handles "🧠 1." or "🧠    1.")
    // \d+ → One or more digits (1, 2, 10...)
    // \.\s → A dot and a space ("1. ") ... means "a dot followed by a space"  (". ")
    const parts = text.split(/(?=(?:[\u{1F300}-\u{1FFFF}]?\s*)?\d+\.\s)/u);

    // --- Put each section into the right card ---
    parts.forEach(part => {

        // Find the section number in this chunk of text
        // match() returns an array — index [1] is the first capture group
        const match = part.match(/(\d+)\./);

        // If no number found, skip this chunk
        if (!match) return;

        const sectionNumber = match[1]; // e.g. "1", "2", "3"
        const divId = sectionMap[sectionNumber]; // e.g. "section-1"

        // Skip if section number isn't in our map (e.g. "10.")
        if (!divId) return;

        const cardElement = document.getElementById(divId);

        if (cardElement) {
            // marked.parse() converts markdown → HTML
            // e.g. "**bold**" becomes "<strong>bold</strong>"
            // e.g. "- item"   becomes "<ul><li>item</li></ul>"
            cardElement.innerHTML = marked.parse(part.trim());
        }
    });

    // --- Fallback: if parsing failed, show everything ---
    // Sometimes the AI formats differently than expected.
    // If section-1 is still empty, dump the whole response there.
    const firstCard = document.getElementById('section-1');
    if (firstCard && firstCard.innerHTML.trim() === '') {
        firstCard.innerHTML = marked.parse(text);
    }

    // --- Update language badge ---
    document.getElementById('lang-badge').innerText = language;

    // --- Show the result section ---
    const resultSection = document.getElementById('result-section');
    resultSection.style.display = 'block';

    // Smoothly scroll down so user sees the results
    resultSection.scrollIntoView({ behavior: 'smooth' });
   }

   /* 
   4. onCodeInput()

   Called every time the user types in the textarea
   (because of oninput="onCodeInput()" in the HTML)

   Does two things live, without any button click:
   A) Updates the character counter
   B) Detects and shows the programming language
   */

   function onCodeInput() {
    const code = document.getElementById('code-input').value;
    const count = code.length;

    // --- A) Update character counter ---
    const counter = document.getElementById('char-counter');
    counter.innerText = `${count} / ${MAX_CODE_LENGTH}`;

    // Change color as user approaches the limit:
    // grey (normal) → yellow (caution) → red (danger)

    if (count > MAX_CODE_LENGTH * 0.95) {
        counter.style.color = '#ff6b6b'; // red   — above 95%
    } else if (count > MAX_CODE_LENGTH * 0.80) {
    counter.style.color = '#f8c555'; // yellow — above 80%
    } else {
        counter.style.color = '#888'; // grey  — all good
    }

    // --- B) Live language detection ---
    const langEl = document.getElementById('lang-detect');
    
    if (code.trim()) {
        const lang = detectLanguage(code);
        langEl.innerText = `Detected: ${lang}`; 
    } else {
        langEl.innerText = 'Waiting for code...';
    }
   }

   /* 
   5. detectLanguage(code)

   Looks for language-specific keywords in the code
   to guess what language it is.

   This is a simple heuristic (rule-based guess).
   Not 100% accurate but works well for common languages.
   In Phase 4 we could replace this with an ML classifier!
   */

   function detectLanguage(code) {

    // Each line checks for unique patterns of that language
    // The checks are ordered from most-specific to least-specific
    if (code.includes('def ')
      || (code.includes('import ') && !code.includes('{')))
      return 'Python';

    if (code.includes('public class')
      || code.includes('System.out')
      || code.includes('void main'))
      return 'Java';

    if (code.includes('#include')
      || code.includes('cout')
      || code.includes('cin'))
      return 'C++';

    if (code.includes('func ')
      && code.includes(':='))
      return 'Go';

    if (code.includes('fn ')
      && code.includes('let mut'))
      return 'Rust';

    if (code.includes('<html')
      || code.includes('<div')
      || code.includes('</'))
      return 'HTML';

    if (code.includes('function')
      || code.includes('const ')
      || code.includes('var ')
      || code.includes('console.log')
      || code.includes('=>'))
      return 'JavaScript';

    if (code.includes('SELECT')
      || code.includes('FROM')
      || code.includes('WHERE'))
      return 'SQL';

    // If nothing matched, return a generic label
    return 'Code';
   }

   /*
   6. copyReport()

   Copies the full AI report text to the user's clipboard.
   Uses the modern navigator.clipboard API.
   Gives visual feedback by changing the button text.
   */

   async function copyReport() {

    // navigator.clipboard.writeText() copies text to clipboard
    // It's async — we await it to know when it's done
    await navigator.clipboard.writeText(fullReportText);

    // Visual feedback — button text changes temporarily
    const btn = document.getElementById('copy-btn');
    btn.innerText = '✅ Copied!';
    btn.style.color = '#7c83fd';

    // Reset button back to normal after 2 seconds
    // setTimeout(function, milliseconds) — runs after a delay
    setTimeout(() => {
        btn.innerText = '📋 Copy Report';
        btn.style.color = ''; // removes inline style, restores CSS
    }, 2000);
   }

   /*
   7. tryAgain()

   Resets the entire page back to initial state.
   Called when user clicks "Review Another Snippet".
   */

   function tryAgain() {

    // Clear the textarea
    document.getElementById('code-input').value = '';

    // Reset counter and language detector
    document.getElementById('char-counter').innerText = `0 / ${MAX_CODE_LENGTH}`;
    document.getElementById('char-counter').style.color = '#888';
    document.getElementById('lang-detect').innerText = 'Waiting for code...';

    // Clear ALL 8 section cards so old content doesn't show next time
    // Object.values() turns the object values into an array we can loop
    const sectionIds = [
        'section-1', 'section-2', 'section-3', 'section-4',
        'section-5', 'section-6', 'section-7', 'section-8'
    ];

    sectionIds.forEach(id => {
        document.getElementById(id).innerHTML = '';
    });

    // Hide results and errors
    hideResult();
    hideError();

    // Clear global state
    fullReportText = '';

    // Scroll back to the top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Put cursor back in textarea so user can type immediately
    document.getElementById('code-input').focus();
   }

   /*
   8. UI HELPER FUNCTIONS

   Small, focused functions that each do ONE thing.
   Used by multiple functions above.

   This follows the DRY principle:
   Don't Repeat Yourself — write once, use everywhere.
   */

   // Show/hide the loading spinner + disable/enable the button
   function setLoading(isLoading) {
    document.getElementById('loading').style.display = isLoading ? 'block' : 'none';
    document.getElementById('review-btn').disabled = isLoading;
   }

   // Hide the result section
   function hideResult() {
    document.getElementById('result-section').style.display = 'none';
   }

   // Show a red error message below the textarea
   function showError(message) {
    const el = document.getElementById('error-msg');
    el.innerText = '⚠️ ' + message;
    el.style.display = 'block';
   }

   // Hide the error message
   function hideError() {
    document.getElementById('error-msg').style.display = 'none';
   }

   // showWarning / hideWarning
   // Different from showError — this is NOT blocking.
   // User can still proceed. It's just informational.
   // Yellow instead of red — different severity level.

   function showWarning(message) {
    const el = document.getElementById('error-msg');
    el.innerText = '⏳ ' + message;
    el.style.display = 'block';

    // Yellow warning — not as alarming as red error
    el.style.background = '#2a2200';
    el.style.borderColor = '#f8c555';
    el.style.color = '#f8c555';
   }

   function hideWarning() {
    // Only hide if it's currently showing a warning (not an error)
    const el = document.getElementById('error-msg');
    if (el.style.color === 'rgb(248, 197, 85)') {
        el.style.display = 'none';
    }
   }
# Cleaning Lead Quote Assistant

Chrome extension logic for preliminary cleaning estimates on Yelp. It does not send messages or automate any external submission.

The maintained operational specification is in [../docs/EXTENSION-SPEC.md](../docs/EXTENSION-SPEC.md). It documents the business rules for KACS and Jhey's, the approval flow, Yelp extraction, message limitations, debugging, and test procedure.

## Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this folder.
4. Open a Yelp (including `biz.yelp.com.br`) or Thumbtack lead page. The review panel appears in the upper-right corner.
5. Select **Save for approval**. The button changes to confirm the local save. Select the `☰` button in the lead panel to open the Approval queue and mark a saved lead as approved, adjusted or discarded. The queue is also available from the extension icon. These actions remain local and do not send any message.

When **Approve** is selected, the extension copies the approved message to the clipboard. Paste it manually into Yelp with `Ctrl+V`; the extension never sends it itself.

For KACS, the copied message follows the approved first-contact templates for First Cleaning, Deep Cleaning and Move-in/Move-out Cleaning. It includes the extracted home details when available, the hourly rate, the estimated time, and the Move-in/Move-out checklist when relevant. It never states an estimated total price.

## Quote rules

- **KACS:** returns only an estimated duration from the hourly table. The panel shows base hours plus 1.5 hours tolerance and recommends hourly pricing. It never produces a dollar total for the lead.
- **Jhey's Cleaning:** returns the fixed price from the original table.
- The next larger square-footage tier is used. When square footage is absent, bedrooms/bathrooms infer a tier; ambiguous mappings use the higher tier.
- Any new Yelp lead labeled `Regular home cleaning` is mapped to First Cleaning, including weekly, biweekly and monthly requests. Recurring rates are reserved for existing clients after their First or Deep Cleaning and are outside this extension's new-lead flow.
- Above 3,000 sq. ft., the panel requires manual review.
- Only the names KACS and Jhey's Cleaning select a price table automatically. Any other or missing company name requires an explicit selection.
- Every computed result must be saved as `pending_human_approval`; nothing is sent to Yelp or Thumbtack.

## Current boundary

Yelp and Thumbtack can change their page structure. The extraction layer is deliberately isolated in `extractors.js`; update its patterns/selectors after testing against the actual lead pages.

The Yelp extractor reads the page's `react_apollo_state` only for the lead identified in the current `/leads/<id>` URL. It pulls the business name, project title, bedrooms, bathrooms and any stated square footage. The generic fallback remains available if Yelp changes that data structure.

The lead panel follows Yelp's internal navigation. When the URL changes to another individual lead, the extension reloads the lead data and resets the panel. It hides itself outside an individual Yelp lead page.

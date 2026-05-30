# Design System Document: Financial Editorial Excellence

## 1. Overview & Creative North Star
**Creative North Star: "The Architectural Authority"**

This design system moves away from the "SaaS-standard" look of generic blue boxes and instead embraces the sophisticated layout of a high-end financial journal. We are building a digital environment that feels structured yet breathable—prioritizing white space as a functional tool rather than a void. 

By leveraging **intentional asymmetry**, we guide the user's eye through complex financial data without overwhelming them. We break the rigid grid by allowing certain "Display" elements to hang in the margins or overlap surface boundaries, creating a sense of layered depth and premium craftsmanship. This system isn't just a UI; it’s a curated experience designed to instill deep-seated trust through precision and tonal restraint.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a deep, authoritative blue core, supported by an expansive range of "cool-white" and "slate-tinted" surfaces.

### The "No-Line" Rule
**Lines are a failure of hierarchy.** In this system, 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined solely through background color shifts or subtle tonal transitions. 
*   **Application:** Use `surface-container-low` for a page section sitting on a `surface` background. The change in hex code provides the edge; the eye does not need a black line to understand where a container ends.

### Surface Hierarchy & Nesting
We treat the UI as a series of physical layers—like stacked sheets of frosted glass. 
*   **Base:** `surface` (#f7f9fb)
*   **Sectioning:** `surface-container-low` (#f2f4f6)
*   **Interactive Cards:** `surface-container-lowest` (#ffffff)
*   **System Overlays:** `surface-container-highest` (#e0e3e5)

### The "Glass & Gradient" Rule
To elevate the "Financial Enterprise" feel, use Glassmorphism for floating navigation or header elements. Apply a backdrop-blur (12px–20px) to `surface` colors at 80% opacity. For primary CTAs, do not use flat colors. Use a subtle linear gradient transitioning from `primary` (#00288e) to `primary_container` (#1e40af) at a 135-degree angle to provide a sense of "visual soul."

---

## 3. Typography: The Editorial Scale
We use **Inter** not as a utility font, but as a brand signature. The hierarchy is extreme, using high contrast between `display` and `body` scales to mimic the layout of an annual report.

*   **Display (lg/md/sm):** Used for large-scale balance and high-level portfolio overviews. These should be set with a tight letter-spacing (-0.02em) to feel authoritative.
*   **Headline & Title:** The workhorses of the system. Use `headline-sm` for section headers. Ensure there is generous top-margin (3x the bottom-margin) to create an "asymmetric anchor" for content.
*   **Body & Labels:** `body-md` is the standard for financial data tables. `label-sm` is reserved for metadata and micro-copy, always set in `on_surface_variant` (#444653) to ensure a clear distinction from primary content.

---

## 4. Elevation & Depth
We eschew traditional drop shadows in favor of **Tonal Layering**.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` background. This creates a "Natural Lift."
*   **Ambient Shadows:** If a floating element (like a modal) is required, use a shadow with a 40px blur and 4% opacity. The shadow color must be the `on_surface` token (#191c1e), never pure black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., in high-glare environments), use the `outline_variant` (#c4c5d5) at **15% opacity**. A 100% opaque border is considered a design bug.
*   **Glassmorphism:** Use semi-transparent surface tokens to allow background data to softly "bleed" through headers, keeping the user grounded in their financial context.

---

## 5. Components

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. White text. Border radius `DEFAULT` (0.5rem).
*   **Secondary:** `secondary_container` background with `on_secondary_container` text. No border.
*   **Tertiary:** Transparent background. Text in `primary`. These must align perfectly with the baseline of surrounding text.

### Input Fields
*   **Structure:** No 4-sided borders. Use a `surface-container-high` background with a 2px bottom-accent in `outline` when focused.
*   **States:** Error states use the `error` (#ba1a1a) token for the bottom accent and helper text.

### Cards & Lists
*   **Forbidden:** Divider lines between list items. 
*   **Standard:** Use vertical white space (1.5rem / `xl` spacing) to separate items. For lists, use a alternating `surface` and `surface-container-low` background for row distinction ("Zebra striping" but with subtle tones).

### Chips
*   **Filter Chips:** Use `secondary_fixed` with `on_secondary_fixed`. Radius must be `full` (9999px) to contrast against the `DEFAULT` (0.5rem) radius of data cards.

### Financial Data Modules (Custom)
*   **Trend Indicators:** Replace emerald green with `primary_fixed` (#dde1ff) for positive trends and `error` for negative. Use weight, not just color, to signify importance.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use `display-lg` typography for single, impactful data points (e.g., Net Worth).
*   **Do** use asymmetrical margins (e.g., a wider left margin than right) to create an editorial, high-end feel.
*   **Do** nest containers to create hierarchy (Lowest inside Low inside Base).

### Don't
*   **Don't** use 1px solid borders to separate sections.
*   **Don't** use pure black (#000000) for shadows; use the `on_surface` tint.
*   **Don't** use "Alert Green." This is an enterprise blue system; use primary-blue tones for "success" and reserved red for "errors."
*   **Don't** crowd the interface. If a screen feels "full," increase the spacing scale and move elements into a secondary layer or progressive disclosure.
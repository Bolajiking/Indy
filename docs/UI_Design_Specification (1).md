# UI/UX Design Specification

## Extracted from Messaging App Interface Analysis

---

## 1. DESIGN PHILOSOPHY

The interface follows what can be described as **"Playful Minimalism"** — a stripped-back, content-first layout that uses extreme negative space and zero decorative chrome, but offsets the clinical feel with expressive, textured avatar artwork (hand-drawn illustrations, pixel art, retro computing references). The result is an interface that feels premium and calm without being sterile.

**Core principles:**

- Content floats on a blank canvas — no cards, no containers, no shadows
- Personality is expressed through user-generated imagery, never through the UI frame itself
- The interface is a stage; the users and communities are the performers
- Every interactive element has maximum clarity with minimum visual weight
- Information hierarchy is achieved through spacing and weight, not color or decoration

---

## 2. COLOR SYSTEM

### 2.1 Background & Surfaces

| Token             | Hex Value | Usage                                                    |
| ----------------- | --------- | -------------------------------------------------------- |
| `surface-primary` | `#FFFFFF` | Main background — used everywhere, no secondary surfaces |
| `surface-input`   | `#F5F5F5` | Search bar fill, input fields                            |
| `surface-badge`   | `#E8EDF2` | Timestamp badges, metadata chips                         |
| `surface-overlay` | `#FFFFFF` | Modal/sheet backgrounds (New Chat screen)                |

**Key decision:** There is NO secondary surface color. No cards, no elevated containers. Content sits directly on white. This is a deliberate design choice that creates the app's distinctive airiness.

### 2.2 Text Colors

| Token              | Hex Value | Usage                                                                                     |
| ------------------ | --------- | ----------------------------------------------------------------------------------------- |
| `text-primary`     | `#000000` | Page titles ("Home"), chat names ("Notebook", "patchland"), tab labels                    |
| `text-secondary`   | `#8E8E93` | Subtitles, timestamps, metadata ("controlla:", "iragaki: hmm"), inactive tabs ("For You") |
| `text-placeholder` | `#C7C7CC` | Search placeholder text ("Search or jump to", "Search people")                            |
| `text-on-action`   | `#FFFFFF` | Text/icons inside blue action buttons                                                     |

### 2.3 Accent & Action Colors

| Token            | Hex Value                    | Usage                                                          |
| ---------------- | ---------------------------- | -------------------------------------------------------------- |
| `accent-primary` | `#FF2D78` (hot pink/magenta) | Active tab indicator underline ONLY — used extremely sparingly |
| `action-primary` | `#2D7CF6`                    | CTA icons (Create private/public chat circles)                 |
| `status-online`  | `#34C759`                    | Online presence dot                                            |
| `border-input`   | `#E5E5EA`                    | Search field border, section dividers                          |
| `icon-secondary` | `#C7C7CC`                    | Chevrons, "+" buttons, secondary action icons                  |

### 2.4 Color Usage Rules

- **Hot pink is surgical:** It appears ONLY as the active tab underline. Nowhere else. This restraint is what makes it punchy.
- **Blue is for creation:** The two "Create" buttons on the New Chat screen. Blue = "make something new."
- **Black is for primary content only:** Titles and chat names. Nothing else.
- **Gray does all the heavy lifting:** Secondary text, borders, icons, badges — all gray, but at different opacities to create subtle hierarchy.
- **No gradients anywhere in the UI chrome.** Gradients only appear in user-uploaded avatar images.

---

## 3. TYPOGRAPHY

### 3.1 Font Stack

The app uses the iOS system font (SF Pro). For cross-platform replication:

```
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
             "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue",
             Arial, sans-serif;
```

### 3.2 Type Scale

| Element                                           | Size (pt) | Weight         | Letter Spacing | Color     |
| ------------------------------------------------- | --------- | -------------- | -------------- | --------- |
| Page title ("Home")                               | 34pt      | Bold (700)     | -0.4px         | `#000000` |
| Modal title ("New chat")                          | 17pt      | Semibold (600) | -0.2px         | `#000000` |
| Chat name ("Notebook")                            | 16pt      | Semibold (600) | 0              | `#000000` |
| Action row label ("Create a private group chat")  | 16pt      | Regular (400)  | 0              | `#000000` |
| Contact name in list ("nebula")                   | 16pt      | Regular (400)  | 0              | `#000000` |
| Avatar carousel label ("Explore", "Your profile") | 12pt      | Regular (400)  | 0              | `#000000` |
| Chat subtitle ("controlla: wojak")                | 14pt      | Regular (400)  | 0              | `#8E8E93` |
| Timestamp ("3h")                                  | 13pt      | Regular (400)  | 0              | `#8E8E93` |
| Search placeholder                                | 16pt      | Regular (400)  | 0              | `#C7C7CC` |
| Tab label active ("Chats")                        | 16pt      | Bold (700)     | 0              | `#000000` |
| Tab label inactive ("For You")                    | 16pt      | Regular (400)  | 0              | `#8E8E93` |
| Button text ("New")                               | 14pt      | Regular (400)  | 0              | `#8E8E93` |

### 3.3 Typography Rules

- **No uppercase/all-caps anywhere.** Everything is sentence case or lowercase.
- **Bold is reserved for:** page titles, active tabs, and chat names (primary identifiers).
- **Weight transitions create hierarchy,** not size changes. Many elements share the same font size but differ in weight.
- **Line height:** ~1.3x for single-line elements, ~1.5x for any multi-line body text.

---

## 4. SPACING & LAYOUT

### 4.1 Grid System

| Property                                            | Value                 |
| --------------------------------------------------- | --------------------- |
| Screen padding (horizontal)                         | 16px left and right   |
| Section gap (vertical space between major sections) | 24px                  |
| List item vertical padding                          | 16px top and bottom   |
| Avatar carousel item gap                            | 16–20px between items |

### 4.2 Home Screen Layout (Top to Bottom)

```
┌──────────────────────────────────────┐
│ [16px padding]                       │
│ "Home"  [34pt bold]    [icon][icon][avatar] │
│                                      │
│ [24px gap]                           │
│                                      │
│ ○ ○ ○ ○ ○ ←─ Horizontal scroll      │
│ Explore  Profile  sup  nebula  dom   │
│                                      │
│ [24px gap]                           │
│                                      │
│ Chats   For You          [New ✏️]    │
│ ════                                 │
│                                      │
│ [16px gap]                           │
│                                      │
│ [thumb] Notebook                     │
│         controlla: 🔵 wojak          │
│                                      │
│ [thumb] patchland              3h    │
│         iragaki: hmm                 │
│                                      │
│         ... (scrollable area)        │
│                                      │
│                                      │
│ ┌──────────────────────────────┐     │
│ │ 🔍 Search or jump to        │     │
│ └──────────────────────────────┘     │
└──────────────────────────────────────┘
```

### 4.3 Key Spacing Details

- **Header row:** Title left-aligned, action icons right-aligned, vertically centered. Icons are ~24×24px with ~20px gaps between them. The profile avatar on the far right is ~32px diameter.
- **Avatar carousel:** Each item is ~64px wide circle/image, with a text label below (~8px gap between image and label). Items are ~16–20px apart. The row scrolls horizontally with content clipping at screen edge (the "dom" avatar is partially cut off, indicating scroll).
- **Tab bar:** Tabs left-aligned, ~16px gap between tab labels. Active indicator is a 3px-tall bar, width matches the text width, positioned directly under the text with ~4px gap. The "New" button floats right on the same row.
- **Chat list items:** Thumbnail (left) + text block (middle) + timestamp (right). Thumbnail ~56×56px. Text block starts ~12px from thumbnail edge. Timestamp right-aligned on the first line.

---

## 5. COMPONENT SPECIFICATIONS

### 5.1 Navigation Header (Home Screen)

```
Layout: Flexbox row, space-between
Height: ~56px
Left:   Page title ("Home"), 34pt bold, left-aligned
Right:  Row of icons (24×24px each, 20px gap)
        Final item: circular profile avatar (32px, border-radius: 50%)
Background: transparent (merges with page background)
Border: none
```

**Icons in the header** appear to be outline-style, thin stroke (~1.5px), dark gray (`#3C3C43`). They include what appears to be a chat/message icon and a person-search icon.

### 5.2 Avatar Carousel (Spaces/Communities Row)

```
Layout: Horizontal scroll, overflow-x: auto, no scrollbar visible
Padding: 0 16px (screen padding applies)
Gap between items: 16px

Each item:
├── Image container: 64×64px
│   ├── border-radius: 50% (perfect circle)
│   ├── overflow: hidden
│   ├── object-fit: cover
│   └── No border, no shadow
├── Label: 12pt regular, centered below
│   └── margin-top: 8px
└── Total width per item: ~80px

First item ("Explore"):
├── Background: #DDD5F3 (light lavender)
├── Icon: Saturn/planet illustration, centered
└── This is the discovery entry point — distinct from user profiles

Scrolling behavior:
├── Free horizontal scroll
├── Last item clips at screen edge (visual cue for scrollability)
├── No pagination dots
└── No snap behavior (free scroll)
```

### 5.3 Tab Bar (Chats / For You)

```
Layout: Row, items left-aligned
Alignment: Bottom of tab row acts as a baseline

Active tab:
├── Text: 16pt, bold (700), #000000
├── Underline: 3px height, width = text width
│   ├── Color: #FF2D78 (hot pink)
│   ├── border-radius: 1.5px (slightly rounded ends)
│   └── Position: ~4px below text baseline
└── No background, no border on the tab itself

Inactive tab:
├── Text: 16pt, regular (400), #8E8E93
└── No underline, no other indicator

"New" button (right side):
├── Layout: Pill shape, border-radius: 16px
├── Border: 1px solid #E5E5EA
├── Background: transparent (or very faint #FAFAFA)
├── Padding: 8px 12px
├── Content: Text "New" (14pt, regular, #8E8E93) + compose icon (16px)
├── Gap between text and icon: 6px
└── No shadow, no fill
```

### 5.4 Chat List Item

```
Layout: Flexbox row, align-items: center
Padding: 16px (vertical), 16px (horizontal from screen edge)
Height: ~88px total including padding
Divider: NONE (no lines between items — whitespace only)

Thumbnail:
├── Size: 56×56px
├── border-radius: 12px (rounded square, NOT circle)
├── overflow: hidden
├── object-fit: cover
├── No border, no shadow
└── Can be illustrations, pixel art, 3D renders — rich, textured imagery

Text block:
├── margin-left: 12px
├── Line 1: Chat name, 16pt semibold, #000000
├── Line 2: Sender name + message preview, 14pt regular, #8E8E93
│   ├── Sender name is plain text followed by colon
│   └── May contain inline badges (small rounded pill: icon + text)
└── Line spacing: ~4px between lines

Timestamp (right-aligned on line 1):
├── 13pt regular, #8E8E93
├── Contained in a very subtle badge/chip
│   ├── Background: #E8EDF2 (very light blue-gray)
│   ├── border-radius: 10px
│   └── Padding: 2px 8px
└── Aligned to top of text block

Inline badge (e.g., "wojak" with icon):
├── Background: #F0F0F0
├── border-radius: 10px
├── Padding: 2px 8px
├── Font: 13pt regular, #666666
├── May include a small circular icon (16px) on the left
└── Vertically centered with subtitle text
```

### 5.5 Search Bar (Bottom, Home Screen)

```
Position: Fixed to bottom of screen (above safe area)
Layout: Full width minus 16px padding each side
Height: 48px
Background: #F5F5F5
Border: none (or 1px solid #ECECEC, very subtle)
border-radius: 12px

Content:
├── Search icon: 20px, #8E8E93, left-aligned
├── margin-left: 12px (icon from edge)
├── Placeholder: "Search or jump to", 16pt regular, #C7C7CC
└── margin-left: 8px (text from icon)

Behavior:
├── Tapping opens focused search state (likely slides up)
├── No permanent shadow or elevation
└── Sits in a white region with subtle top fade/gradient possible
```

### 5.6 Modal Header (New Chat Screen)

```
Layout: Center-aligned title with left close button
Height: ~56px
Background: #FFFFFF

Close button (X):
├── Position: left-aligned, vertically centered
├── Size: tap target 44×44px, icon ~20px
├── Color: #000000
├── Weight: medium stroke (~2px)
└── No background/circle behind it

Title ("New chat"):
├── Center-aligned horizontally
├── 17pt semibold (600), #000000
└── Vertically centered in header

Transition:
├── This screen slides up from the bottom (modal presentation)
├── Background dims slightly behind
└── Drag-to-dismiss likely supported
```

### 5.7 Search Field (New Chat Screen)

```
Layout: Full width minus 16px padding
Height: 48px
Background: #FFFFFF
Border: 1px solid #E5E5EA
border-radius: 12px

Content:
├── Search icon: 20px, #8E8E93
├── Placeholder: "Search people", 16pt regular, #C7C7CC
└── Same internal spacing as bottom search bar
```

### 5.8 Action Row (Create Private/Public Chat)

```
Layout: Flexbox row, align-items: center
Padding: 14px 0 (vertical), 16px (horizontal from screen edge)
Height: ~64px including padding

Icon circle:
├── Size: 48×48px
├── border-radius: 50% (perfect circle)
├── Background: #2D7CF6 (solid blue)
├── Icon: white, centered, 22px
│   ├── "Private" uses a lock icon
│   └── "Public" uses a globe/world icon
└── No shadow, no border

Label:
├── margin-left: 16px
├── 16pt regular (400), #000000
└── Single line, vertically centered

Chevron:
├── Position: right-aligned
├── Size: 20px
├── Color: #C7C7CC (very light gray)
├── Style: simple right-pointing angle bracket (>)
└── stroke-width: 2px

Divider:
├── After the action rows group
├── 1px solid #F0F0F0
├── Full width minus left padding (starts from text alignment, not screen edge)
```

### 5.9 Contact List Item (New Chat Screen)

```
Layout: Flexbox row, align-items: center
Padding: 12px 0 (vertical), 16px (horizontal)
Height: ~56px including padding

Avatar:
├── Size: 40×40px
├── border-radius: 50% (circle)
├── Background: varies (light pastel colors — #D0D8E8, #E8E0F0)
│   └── Some have custom images/logos
└── Can show online indicator (green dot)

Online indicator:
├── Size: 10px diameter
├── Color: #34C759 (iOS green)
├── Position: bottom-right of avatar, overlapping edge
├── Border: 2px solid #FFFFFF (creates knockout effect)
└── Only shown for online users

Name:
├── margin-left: 12px
├── 16pt regular (400), #000000
└── Single line

Add button (right side):
├── Position: right-aligned
├── Size: 28×28px tap target, icon ~20px
├── Shape: circle with border
├── Border: 1.5px solid #D1D1D6
├── Background: transparent
├── Icon: "+" symbol, 1.5px stroke, #C7C7CC
└── No fill, no shadow
```

---

## 6. ICONOGRAPHY

### 6.1 Icon Style

```
Style: SF Symbols / Outline
Stroke width: 1.5px (consistent across all icons)
Corners: Rounded (2px radius on line endings)
Size: 20–24px (contextual)
Color: Matches text hierarchy
├── Primary icons (header): #3C3C43
├── Secondary icons (actions): #8E8E93
├── Tertiary icons (add buttons, chevrons): #C7C7CC
└── Inverse icons (on blue circles): #FFFFFF
```

### 6.2 Identified Icons

| Location              | Icon                         | Description           |
| --------------------- | ---------------------------- | --------------------- |
| Header, right         | Chat bubble with corners     | Message/conversations |
| Header, right         | Person with magnifying glass | Find people/contacts  |
| Tab bar, "New" button | Pen on paper / compose       | Create new item       |
| New Chat, action row  | Padlock (locked)             | Private group         |
| New Chat, action row  | Globe with download arrow    | Public/open group     |
| Contact list          | Plus sign in circle          | Add to conversation   |
| Search bars           | Magnifying glass             | Search                |
| New Chat header       | X mark                       | Close/dismiss         |

---

## 7. AVATAR & IMAGERY SYSTEM

### 7.1 Avatar Types

The app supports multiple avatar styles which is key to its personality:

**Illustrated / Artwork avatars (chat thumbnails):**

- Highly textured, detailed illustrations
- Examples: composition notebook with "SUP" sticker, retro Macintosh computer with smiley face
- These are NOT generic icons — they feel hand-crafted, almost collectible
- Displayed as rounded squares (12px radius) at 56×56px

**Profile/Space avatars (carousel and contact list):**

- Simpler, often abstract or logo-based
- Soft pastel fills (#D0D8E8 light blue, #DDD5F3 lavender)
- Some use pixel art or grayscale imagery
- Displayed as circles at 64px (carousel) or 40px (contact list)

**Profile avatar (header):**

- User's own avatar, photographic or illustrated
- Circular, 32px, positioned in top-right header

### 7.2 Imagery Rules

- **No default gray person silhouette.** Even "empty" avatars have a soft color fill.
- Avatars are the ONLY source of visual richness in the UI. The rest is monochrome.
- The contrast between the minimal UI and expressive avatars IS the aesthetic.
- Image content can be anything: 3D renders, pixel art, photography, illustration, abstract art.
- The UI never applies filters, overlays, or borders to avatar images.

---

## 8. INTERACTION PATTERNS & EXPECTED ANIMATIONS

### 8.1 Tap Feedback

```
All tappable elements:
├── Highlight: Very subtle opacity change on press (opacity: 0.7)
├── Duration: instant on press, 150ms fade back
├── No ripple effects (this is iOS-native, not Material)
└── No scale transforms on press

Chat list items:
├── Background highlight on press: #F5F5F5
├── Full row highlights (edge to edge)
└── 200ms fade in/out
```

### 8.2 Navigation Transitions

```
Home → Chat room:
├── Push transition (slide left)
├── Duration: 350ms
├── Easing: iOS spring curve (damping: 1, response: 0.35)
└── Previous screen slides left and dims slightly

Home → New Chat (modal):
├── Slide up from bottom
├── Duration: 400ms
├── Easing: iOS spring curve
├── Background dims to ~40% black overlay
├── Supports interactive dismiss (drag down)
└── Sheet style: full height or near-full (no half-sheet)

Tab switching (Chats ↔ For You):
├── Content crossfades
├── Underline indicator slides horizontally
├── Duration: 250ms
├── Easing: ease-in-out
└── Likely supports swipe between tabs
```

### 8.3 Scroll Behaviors

```
Avatar carousel:
├── Free scroll (no snap points)
├── Momentum scrolling enabled
├── Bounce at edges (iOS rubber band)
├── No scrollbar visible
└── Partial items visible at edges signal scrollability

Chat list:
├── Vertical scroll, standard iOS behavior
├── Pull-to-refresh likely (elastic bounce)
├── List items may support swipe actions (archive, mute, etc.)
└── Search bar likely hides/shows on scroll direction

General:
├── All scrolling uses native iOS momentum
├── Overscroll bounce everywhere
└── No custom scroll indicators
```

### 8.4 Search Interaction

```
Tapping search bar:
├── Bar animates up to top of screen
├── Keyboard slides up
├── Cancel button appears (right side)
├── Background content dims or blurs
├── Transition: 300ms ease-out
└── Results appear below in real-time (as-you-type)
```

---

## 9. BORDER RADIUS SYSTEM

| Element                    | Radius | Notes                                           |
| -------------------------- | ------ | ----------------------------------------------- |
| Chat thumbnails            | 12px   | Rounded square — distinctive choice vs. circles |
| Profile avatars (carousel) | 50%    | Perfect circle                                  |
| Contact avatars (list)     | 50%    | Perfect circle                                  |
| Search bars                | 12px   | Matches thumbnail radius                        |
| "New" button pill          | 16px   | Fully rounded pill                              |
| Timestamp badge            | 10px   | Small pill                                      |
| Inline text badge          | 10px   | Small pill                                      |
| Action button circle       | 50%    | Blue CTA buttons                                |
| "+" add button             | 50%    | Circle                                          |

**Pattern:** Circular for people/identities, rounded-rect for content/containers.

---

## 10. SHADOW & ELEVATION

**There are essentially NO shadows in this interface.** This is a critical design decision.

- No card shadows
- No elevated headers
- No floating action buttons
- No drop shadows on avatars
- No shadow on the bottom search bar
- The search field border is the only depth cue (and it's a 1px line, not a shadow)

**Elevation is communicated through:**

- The modal overlay (New Chat screen dims the background)
- Z-ordering during transitions
- That's it.

---

## 11. DARK MODE CONSIDERATIONS

While the screenshots show light mode only, the design system implies these dark mode mappings:

| Light Token          | Dark Equivalent                                 |
| -------------------- | ----------------------------------------------- |
| `#FFFFFF` background | `#000000` (true black, OLED-friendly)           |
| `#000000` text       | `#FFFFFF`                                       |
| `#8E8E93` secondary  | `#98989D`                                       |
| `#F5F5F5` input bg   | `#1C1C1E`                                       |
| `#E5E5EA` borders    | `#38383A`                                       |
| `#FF2D78` accent     | `#FF2D78` (unchanged — hot pink works on dark)  |
| `#2D7CF6` action     | `#4D9FFF` (slightly brighter for dark contrast) |

---

## 12. RESPONSIVE BEHAVIOR & SAFE AREAS

```
iOS safe areas:
├── Top: Status bar inset (dynamic, ~54px on notch devices)
├── Bottom: Home indicator inset (~34px on notch devices)
├── Search bar respects bottom safe area
└── Content scrolls behind status bar (transparent)

Screen size adaptation:
├── Layout is single-column, full width
├── All horizontal measurements are screen-relative (percentage or screen padding)
├── Avatar carousel items are fixed-size, count adjusts to screen width
├── Chat list is unconstrained vertically (scrolls)
└── On larger screens (iPad): likely centered column with max-width ~428px
```

---

## 13. MICRO-INTERACTION DETAILS

### Tab underline animation

The pink underline bar smoothly translates horizontally when switching tabs, scaling its width to match the new tab's text width. Duration ~250ms with ease-in-out.

### Long press on chat item

Likely reveals a context menu (iOS style: blurred background, menu pops from the pressed item with spring animation). Options might include: Pin, Mute, Archive, Delete.

### Avatar carousel scroll

Uses deceleration rate of ~0.998 (standard iOS momentum). No "snap to item" behavior — items can rest at any position. The partial visibility of the last item on the right serves as a scroll affordance.

### Message badge (unread indicator)

The "3h" timestamp badge would likely be replaced or accompanied by an unread count badge (blue filled circle with white number) when there are unread messages.

### Pull to refresh

Standard iOS pull-to-refresh with a subtle spinner appearing above the content. No custom animation — follows system convention.

---

## 14. DESIGN TOKENS SUMMARY (FOR IMPLEMENTATION)

```css
:root {
  /* Colors */
  --color-bg-primary: #ffffff;
  --color-bg-input: #f5f5f5;
  --color-bg-badge: #e8edf2;

  --color-text-primary: #000000;
  --color-text-secondary: #8e8e93;
  --color-text-placeholder: #c7c7cc;
  --color-text-inverse: #ffffff;

  --color-accent-pink: #ff2d78;
  --color-action-blue: #2d7cf6;
  --color-status-online: #34c759;

  --color-border-default: #e5e5ea;
  --color-border-subtle: #f0f0f0;
  --color-icon-secondary: #c7c7cc;
  --color-icon-primary: #3c3c43;

  /* Typography */
  --font-family:
    -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
    "Segoe UI", Roboto, sans-serif;
  --font-size-title: 34px;
  --font-size-heading: 17px;
  --font-size-body: 16px;
  --font-size-caption: 14px;
  --font-size-small: 13px;
  --font-size-tiny: 12px;

  --font-weight-bold: 700;
  --font-weight-semibold: 600;
  --font-weight-regular: 400;

  /* Spacing */
  --spacing-screen-padding: 16px;
  --spacing-section-gap: 24px;
  --spacing-list-item-padding: 16px;
  --spacing-carousel-gap: 16px;
  --spacing-inline-gap: 12px;

  /* Radii */
  --radius-thumbnail: 12px;
  --radius-circle: 50%;
  --radius-input: 12px;
  --radius-pill: 16px;
  --radius-badge: 10px;

  /* Sizes */
  --size-avatar-carousel: 64px;
  --size-avatar-list: 40px;
  --size-avatar-header: 32px;
  --size-thumbnail-chat: 56px;
  --size-action-circle: 48px;
  --size-icon-default: 24px;
  --size-icon-small: 20px;
  --size-search-height: 48px;

  /* Animation */
  --transition-fast: 150ms ease-out;
  --transition-normal: 250ms ease-in-out;
  --transition-modal: 400ms cubic-bezier(0.2, 0.8, 0.2, 1);
  --transition-push: 350ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

---

## 15. ANTI-PATTERNS (What This Design Explicitly Avoids)

1. **No hamburger menus** — navigation is flat and visible
2. **No bottom tab bar** — the search bar replaces the traditional 5-icon tab bar
3. **No card-based layouts** — no shadows, no elevated surfaces
4. **No color backgrounds on sections** — no alternating gray/white zones
5. **No text badges with counts** — timestamps use subtle pills instead of loud badges
6. **No heavy divider lines** — spacing separates items, not hairlines (except New Chat screen has one subtle divider)
7. **No floating action buttons** — "New" is integrated into the tab row
8. **No onboarding overlays or coach marks visible**
9. **No skeleton screens visible** (though likely used during loading)
10. **No emoji in the UI chrome** — emoji only appears in user content
11. **No rounded-rect buttons with fills** — buttons are either pills with borders or icon circles
12. **No gradient text or gradient backgrounds**

---

## 16. IMPLEMENTATION NOTES FOR CROSS-PLATFORM

### iOS (SwiftUI / UIKit)

- Use native UINavigationBar styling with large titles
- SF Symbols for all icons
- Native UISearchBar with custom styling
- UICollectionView with horizontal flow for avatar carousel
- Standard UITableView for chat list (no custom cells needed beyond layout)

### Android (Jetpack Compose / Material)

- Disable Material elevation/shadows globally
- Override ripple with opacity feedback
- Use custom TopAppBar (don't use Material3 default)
- Replace SF Symbols with equivalent outline icon set (Lucide, Phosphor, or custom)
- Match iOS spring curves with Android spring animation API

### React Native

- Use react-native-reanimated for spring animations
- Custom tab bar component (don't use react-navigation default tabs)
- FlatList with horizontal scroll for carousel
- SectionList for chat list with proper spacing

### Web (React)

- Tailwind CSS maps directly to the token system above
- Use framer-motion for transitions
- CSS scroll-snap: none for carousel (free scroll)
- max-width: 428px centered container for desktop

---

_This specification provides sufficient detail to recreate the visual and interactive design of this interface in any platform or framework. The key to nailing this aesthetic is restraint — resist the urge to add shadows, gradients, or extra color. Let the avatars be the color. Let the whitespace be the structure._

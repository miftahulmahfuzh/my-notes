# Style Guide: Silence

### 1. Overview

This style guide outlines the design system for the "Silence" project. The aesthetic is a modern interpretation of brutalism, characterized by a high-contrast palette, bold and oversized typography, and a structured, grid-based layout. The design is intentional and unapologetic, prioritizing clarity and impact, making it ideal for a developer-focused audience that values function and a strong visual statement.

### 2. Design Philosophy

Our design is guided by the following core principles:

*   **Clarity & Contrast**: We use a stark, high-contrast color palette (primarily black, white, and a vibrant orange) and clean typography to ensure legibility and draw attention to key information.
*   **Intentional Asymmetry**: The layout is built on a strong grid but employs asymmetry and overlapping elements to create visual interest and a dynamic user experience.
*   **Typographic Hierarchy**: Typography is not just for text; it's a primary graphic element. We use dramatic differences in font size and weight to establish a clear and immediate hierarchy.
*   **Minimalism in Elements**: We avoid decorative UI. Every element serves a purpose. Gradients, excessive shadows, and ornamentation are omitted in favor of solid colors, sharp lines, and functional components.

### 3. Color Palette

Our color palette is concise and high-contrast. The colors are defined below for use in your Tailwind CSS configuration.

#### Primary / Accent

The primary color is a vibrant orange, used for calls-to-action, headlines, and key highlights.

| Name      | Hex       | Tailwind Class      |
| :-------- | :-------- | :------------------ |
| Primary   | `#FF4D00` | `bg-primary`        |
| Primary-dark | `#E64500` | `bg-primary-dark`   |

#### Neutral Palette

Neutrals provide the foundation for the interface, from backgrounds to text and borders.

| Name         | Hex       | Tailwind Class           | Usage                               |
| :----------- | :-------- | :----------------------- | :---------------------------------- |
| Neutral 950 (Black) | `#0A0A0A` | `bg-neutral-950`       | Dark backgrounds, footers           |
| Neutral 900 (Text) | `#111111` | `text-neutral-900`       | Body text on light backgrounds     |
| Neutral 500  | `#6B7280` | `text-neutral-500`       | Secondary text, captions, placeholders |
| Neutral 200  | `#EAEAEA` | `border-neutral-200`     | Borders, dividers                 |
| Neutral 100  | `#F3F3F3` | `bg-neutral-100`       | Main light background             |
| Neutral 0 (White) | `#FFFFFF` | `bg-white` / `text-white` | Cards, text on dark backgrounds     |

#### Status Colors

Standard colors for user feedback and notifications. They should be used sparingly.

| Name      | Hex       | Tailwind Class    |
| :-------- | :-------- | :---------------- |
| Success   | `#22C55E` | `bg-success`      |
| Warning   | `#F59E0B` | `bg-warning`      |
| Error     | `#EF4444` | `bg-error`        |

### 4. Typography

Typography is a cornerstone of our brutalist aesthetic. We use two primary font families.

*   **Headings Font**: `Archivo` (from Google Fonts) - A bold, geometric sans-serif for impact.
*   **Body Font**: `Inter` (from Google Fonts) - A highly legible and neutral sans-serif for UI elements and body copy.

#### Typographic Scale

| Element        | Font Family | Weight          | Size (rem/px) | Line Height | Tailwind Classes                                      |
| :------------- | :---------- | :-------------- | :------------ | :---------- | :---------------------------------------------------- |
| **Display**    | Archivo     | Black (900)     | 6rem / 96px   | 1.0         | `font-display text-8xl lg:text-9xl font-black leading-none` |
| **Heading 1**  | Archivo     | Bold (700)      | 4.5rem / 72px | 1.1         | `font-display text-7xl font-bold leading-tight`       |
| **Heading 2**  | Archivo     | Bold (700)      | 3rem / 48px   | 1.2         | `font-display text-5xl font-bold leading-tight`       |
| **Heading 3**  | Inter       | SemiBold (600)  | 1.5rem / 24px | 1.4         | `font-body text-2xl font-semibold`                    |
| **Body Large** | Inter       | Regular (400)   | 1.125rem / 18px | 1.6         | `font-body text-lg leading-relaxed`                   |
| **Body**       | Inter       | Regular (400)   | 1rem / 16px   | 1.75        | `font-body text-base leading-relaxed`                 |
| **Caption**    | Inter       | Regular (400)   | 0.875rem / 14px | 1.5         | `font-body text-sm`                                   |
| **Link**       | Inter       | Medium (500)    | 1rem / 16px   | 1.5         | `font-body text-base font-medium`                     |

### 5. Spacing System

Our spacing is based on a **4px** base unit, which aligns perfectly with Tailwind's default spacing scale. Consistency in spacing is key to achieving our clean, structured layout.

| Spacing (px) | Tailwind Class |
| :----------- | :------------- |
| 4px          | `p-1`, `m-1`   |
| 8px          | `p-2`, `m-2`   |
| 12px         | `p-3`, `m-3`   |
| 16px         | `p-4`, `m-4`   |
| 24px         | `p-6`, `m-6`   |
| 32px         | `p-8`, `m-8`   |
| 48px         | `p-12`, `m-12` |
| 64px         | `p-16`, `m-16` |

### 6. Component Styles

#### Buttons

Buttons are functional and clear. We avoid purely decorative styles.

**Primary Button (Tags)**

Used for primary actions like tags or filters.

```html
<!-- Default -->
<button class="bg-primary text-white font-medium text-sm px-4 py-2 rounded-full hover:bg-primary-dark transition-colors">
  2024 Essentials
</button>

<!-- Disabled -->
<button class="bg-neutral-200 text-neutral-500 font-medium text-sm px-4 py-2 rounded-full cursor-not-allowed">
  2024 Essentials
</button>
```

**Secondary Button (Ghost Style)**

Used for secondary actions like "Contact Us".

```html
<!-- Default -->
<button class="border border-neutral-900 text-neutral-900 font-medium text-sm px-4 py-2 rounded-md hover:bg-neutral-900 hover:text-white transition-colors">
  Contact Us
</button>

<!-- On Dark Background -->
<button class="border border-white text-white font-medium text-sm px-4 py-2 rounded-md hover:bg-white hover:text-neutral-900 transition-colors">
  Let's Dive In
</button>

<!-- Disabled -->
<button class="border border-neutral-200 text-neutral-500 font-medium text-sm px-4 py-2 rounded-md cursor-not-allowed">
  Contact Us
</button>
```

**Tertiary Button (Text Link)**

Used for the least prominent actions, often with an icon.

```html
<!-- Default -->
<a href="#" class="text-primary font-medium group inline-flex items-center gap-2 hover:underline">
  Book a Call
  <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" ...>...</svg>
</a>

<!-- Disabled -->
<span class="text-neutral-500 group inline-flex items-center gap-2 cursor-not-allowed">
  Book a Call
</span>
```

#### Inputs

Inputs are minimal and high-contrast.

```html
<div>
  <label for="email" class="block text-sm font-medium text-neutral-900 mb-2">Email</label>
  <input
    type="email"
    id="email"
    placeholder="you@example.com"
    class="w-full px-3 py-2 bg-white border border-neutral-200 rounded-md placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
  />
</div>

<!-- Disabled -->
<div>
  <label for="email_disabled" class="block text-sm font-medium text-neutral-500 mb-2">Email</label>
  <input
    type="email"
    id="email_disabled"
    placeholder="you@example.com"
    disabled
    class="w-full px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-md cursor-not-allowed"
  />
</div>
```

#### Cards

Cards are used to contain distinct pieces of content. They have a subtle shadow and border-radius.

```html
<div class="bg-white rounded-xl border border-neutral-200 p-4 shadow-md hover:shadow-lg transition-shadow">
  <!-- Card Content -->
</div>
```

### 7. Shadows & Elevation

Shadows are subtle and crisp, used to create a sense of elevation for interactive elements like cards.

| Name        | Tailwind Class | Value                                                     |
| :---------- | :------------- | :-------------------------------------------------------- |
| Small       | `shadow-sm`    | `0 1px 2px 0 rgb(0 0 0 / 0.05)`                           |
| Medium (Default) | `shadow-md`    | `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)` |
| Large       | `shadow-lg`    | `0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05)` |

### 8. Animations & Transitions

Transitions should be quick and subtle to provide feedback without being distracting.

| Property    | Tailwind Class                            |
| :---------- | :---------------------------------------- |
| Default     | `transition-all duration-200 ease-in-out` |
| Colors      | `transition-colors duration-200 ease-in-out` |
| Transform   | `transition-transform duration-200 ease-in-out` |
| Shadow      | `transition-shadow duration-300 ease-in-out` |

### 9. Border Styles

Borders are thin and light, used to define containers like cards and inputs.

*   **Default Width**: 1px (`border`)
*   **Default Color**: `neutral-200` (`border-neutral-200`)
*   **Input Focus Color**: `primary` (`focus:border-primary`)

### 10. Border Radius

A consistent radius scale is used for all components.

| Name         | Tailwind Class | Value |
| :----------- | :------------- | :---- |
| Small        | `rounded-sm`   | 2px   |
| Medium (Inputs) | `rounded-md`   | 6px   |
| Large (Cards) | `rounded-lg`   | 8px   |
| X-Large (Images) | `rounded-xl`   | 12px  |
| Full (Tags)  | `rounded-full` | 9999px|

### 11. Opacity & Transparency

Use standard opacity values for subtle effects like disabled states.

| Value | Tailwind Class |
| :---- | :------------- |
| 100%  | `opacity-100`  |
| 75%   | `opacity-75`   |
| 50%   | `opacity-50`   |
| 25%   | `opacity-25`   |
| 0%    | `opacity-0`    |

### 12. Z-Index Layers

A z-index scale ensures proper stacking of elements like modals and dropdowns.

| Layer     | Tailwind Class |
| :-------- | :------------- |
| Default   | `z-0`          |
| Base      | `z-10`         |
| Dropdowns | `z-20`         |
| Tooltips  | `z-30`         |
| Modals    | `z-40`         |
| Overlays  | `z-50`         |

### 13. Responsive Breakpoints

We use Tailwind's standard responsive breakpoints.

| Breakpoint | Value     |
| :--------- | :-------- |
| `sm`       | 640px     |
| `md`       | 768px     |
| `lg`       | 1024px    |
| `xl`       | 1280px    |
| `2xl`      | 1536px    |

### 14. Common Tailwind CSS Usage

Here are examples of how to combine utilities to build common patterns from the design.

**Page Section Header:**

```html
<div class="py-16 lg:py-24">
  <h2 class="font-display text-5xl md:text-7xl font-bold leading-tight text-neutral-900">
    / Enhance Your Skills <br />
    Skateboarding Experience.
  </h2>
  <p class="mt-6 text-lg text-neutral-500 max-w-2xl">
    One of the most exciting aspects of skateboarding is discovering new places to skate.
    Our online communities offer feature threads or maps dedicated to skate spots.
  </p>
</div>
```

**Grid of Cards:**

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  <!-- Card 1 -->
  <div class="bg-white rounded-xl border border-neutral-200 p-4 shadow-md hover:shadow-lg transition-shadow">
    <p class="font-medium text-neutral-900">Card Title</p>
  </div>
  <!-- Card 2 -->
  <div class="bg-white rounded-xl border border-neutral-200 p-4 shadow-md hover:shadow-lg transition-shadow">
     <p class="font-medium text-neutral-900">Card Title</p>
  </div>
  <!-- Card 3 -->
  <div class="bg-white rounded-xl border border-neutral-200 p-4 shadow-md hover:shadow-lg transition-shadow">
     <p class="font-medium text-neutral-900">Card Title</p>
  </div>
</div>
```

### 15. Example Component Reference

Here is a complete, copy-pastable React component (TSX) for the "Product Card" seen in the screenshot. It demonstrates the application of the style guide's principles.

```tsx
import React from 'react';

type ProductCardProps = {
  imageUrl: string;
  category: string;
  title: string;
  artist: string;
  price: number;
  description: string;
};

// A simple plus icon for the button
const PlusIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 3.33331V12.6666"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.33337 8H12.6667"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);


export const ProductCard: React.FC<ProductCardProps> = ({
  imageUrl,
  category,
  title,
  artist,
  price,
  description,
}) => {
  return (
    <div className="flex w-full max-w-sm flex-col bg-white p-4 rounded-xl border border-neutral-200 shadow-md transition-shadow hover:shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-body text-lg font-semibold text-neutral-900">{title}</h3>
          <p className="font-body text-sm text-neutral-500">Hand-signed by the artist</p>
        </div>
        <span className="text-right font-body text-sm font-medium text-neutral-500 whitespace-nowrap">
          {category}
        </span>
      </div>

      <div className="mb-4">
        <p className="font-body text-4xl font-bold text-neutral-900">${price}</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-grow">
          <p className="font-body text-sm text-neutral-500 leading-relaxed mb-4">
            {description}
          </p>
          <button className="group inline-flex items-center gap-2 text-primary font-medium text-sm transition-colors hover:text-primary-dark">
            <PlusIcon />
            Add to Cart
          </button>
        </div>
        <div className="flex-shrink-0 w-24">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-auto object-contain rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};

// Example Usage:
// <ProductCard
//   imageUrl="https://placehold.co/96x200"
//   category="2024 ESSENTIALS PRODUCT"
//   title="Jesus (Hand Signed)"
//   artist="Andy Hope"
//   price={499}
//   description="Andy Hope 1930 acts here as a DJ from the future, a gateway that allows the artists to travel in different directions freely."
// />
```